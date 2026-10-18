const { sql, getPool } = require('../shared/db');
const bcrypt = require('bcryptjs');
const { firmarToken } = require('../shared/auth');
const POL = require('../shared/clave-politica');

/* _LOGIN_INTENTOS_V1 (18-oct-2026): 5 intentos fallidos seguidos -> 15 min de espera para ese usuario.
   Tabla dbo.Login_Intentos (se crea sola). Un ingreso correcto limpia el contador.
   Interruptor: LOGIN_INTENTOS_MAX (por defecto 5; 0 = apagado) y LOGIN_BLOQUEO_MIN (por defecto 15). */
const INT_MAX = (() => { const n = parseInt(process.env.LOGIN_INTENTOS_MAX || '5', 10); return isNaN(n) ? 5 : n; })();
const INT_MIN = (() => { const n = parseInt(process.env.LOGIN_BLOQUEO_MIN || '15', 10); return isNaN(n) ? 15 : n; })();
async function intentosAsegurar(pool) {
  await pool.request().query(`IF OBJECT_ID('dbo.Login_Intentos','U') IS NULL CREATE TABLE dbo.Login_Intentos (
    usuario NVARCHAR(100) NOT NULL PRIMARY KEY, fallos INT NOT NULL DEFAULT 0, ultimo DATETIME2(0) NULL,
    bloqueado_hasta DATETIME2(0) NULL, ip NVARCHAR(60) NULL, bloqueos INT NOT NULL DEFAULT 0)`);
}
function ipDe(req) { try { return String(((req.headers || {})['x-forwarded-for'] || '')).split(',')[0].replace(/:\d+$/, '').trim().slice(0, 60) || null; } catch (e) { return null; } }
async function intentosEstado(pool, usuario) {
  const r = await pool.request().input('u', sql.NVarChar(100), usuario).query('SELECT fallos, bloqueado_hasta FROM dbo.Login_Intentos WHERE usuario = @u');
  const x = r.recordset[0]; if (!x) return { fallos: 0, bloqueadoMin: 0 };
  const hasta = x.bloqueado_hasta ? new Date(x.bloqueado_hasta).getTime() : 0;
  return { fallos: x.fallos || 0, bloqueadoMin: hasta > Date.now() ? Math.ceil((hasta - Date.now()) / 60000) : 0 };
}
async function intentosFallo(pool, usuario, ip) {
  const r = await pool.request().input('u', sql.NVarChar(100), usuario).input('ip', sql.NVarChar(60), ip).input('max', sql.Int, INT_MAX).input('min', sql.Int, INT_MIN)
    .query(`MERGE dbo.Login_Intentos AS t USING (SELECT @u AS usuario) s ON t.usuario = s.usuario
            WHEN MATCHED THEN UPDATE SET fallos = CASE WHEN t.bloqueado_hasta IS NOT NULL AND t.bloqueado_hasta < SYSUTCDATETIME() THEN 1 ELSE t.fallos + 1 END, ultimo = SYSUTCDATETIME(), ip = @ip
            WHEN NOT MATCHED THEN INSERT (usuario, fallos, ultimo, ip) VALUES (@u, 1, SYSUTCDATETIME(), @ip);
            UPDATE dbo.Login_Intentos SET bloqueado_hasta = DATEADD(minute, @min, SYSUTCDATETIME()), bloqueos = bloqueos + 1, fallos = 0
              WHERE usuario = @u AND fallos >= @max;
            SELECT fallos, bloqueado_hasta FROM dbo.Login_Intentos WHERE usuario = @u;`);
  const x = r.recordset[0] || {};
  const hasta = x.bloqueado_hasta ? new Date(x.bloqueado_hasta).getTime() : 0;
  return { fallos: x.fallos || 0, bloqueadoMin: hasta > Date.now() ? Math.ceil((hasta - Date.now()) / 60000) : 0 };
}
async function intentosLimpiar(pool, usuario) {
  await pool.request().input('u', sql.NVarChar(100), usuario).query('DELETE FROM dbo.Login_Intentos WHERE usuario = @u');
}

const BCRYPT_ROUNDS = 10;
const esHashBcrypt = (s) => /^\$2[aby]\$/.test(String(s || ''));

// Constantes que estaban en GAS — replicadas para el endpoint
const FUNDOS_SUPERVISOR = {
  'ptamayo':    ['El Papayo', 'Limones'],
  'atineo':     ['Olivares Bajo'],
  'fpulache':   ['Los Olivares'],
  'yluzon':     ['Santa Rosa'],
  'sviera':     ['Algarrobos'],
  'ecastro':    ['San Vicente'],
  'almartinez': ['Punta Arenas'],
  'fzapata':    ['Aproa'],
  'rmolero':    ['Planta Rapel'],
  'mmechato':   []
};

const SUP_MULTI = ['ptamayo', 'mmechato', 'rmolero'];

module.exports = async function (context, req) {
  const startTime = Date.now();
  context.log('auth-login triggered');

  try {
    // 1. Validar body
    const body = req.body || {};
    const usuario = String(body.usuario || '').trim();
    const password = String(body.password || '').trim();

    if (!usuario || !password) {
      context.res = {
        status: 400,
        body: { success: false, error: 'Usuario y password son requeridos' }
      };
      return;
    }

    // 2. Conectar a Azure SQL
    const pool = await getPool();

    /* _LOGIN_INTENTOS_V1: ¿usuario en espera por intentos fallidos? */
    let intentosOn = INT_MAX > 0;
    if (intentosOn) {
      try {
        await intentosAsegurar(pool);
        const e = await intentosEstado(pool, usuario.toLowerCase());
        if (e.bloqueadoMin > 0) {
          context.log('Login bloqueado por intentos →', usuario, e.bloqueadoMin + ' min');
          context.res = { status: 429, body: { success: false, rechazado: true, bloqueado: true, minutos: e.bloqueadoMin,
            error: 'Demasiados intentos fallidos. Espera ' + e.bloqueadoMin + ' minuto(s) e intenta de nuevo, o pide ayuda a Coordinación RR.LL.' } };
          return;
        }
      } catch (eI) { intentosOn = false; context.log.warn('[_LOGIN_INTENTOS_V1] ' + eI.message); }
    }

    // 3. Query con index (usuario + activo)
    const result = await pool.request()
      .input('usuario', sql.NVarChar, usuario)
      .query(`
        SELECT TOP 1
          id_sistema, usuario, password, nombre, rol, empresa,
          activo, correo, cargo, sector
        FROM dbo.usuarios
        WHERE usuario = @usuario AND activo = 1
      `);

    // 4. Validar que existe
    if (result.recordset.length === 0) {
      context.log('Login fallido: usuario no encontrado o inactivo →', usuario);
      /* usuario inexistente: no se cuenta (evita bloquear nombres al azar) y la pantalla puede probar Google */
      context.res = {
        status: 401,
        body: { success: false, error: 'Usuario o contrasena incorrectos.' }
      };
      return;
    }

    const u = result.recordset[0];

    // 5. Validar password — bcrypt con auto-migración desde texto plano
    const stored = String(u.password || '').trim();
    let passwordOk = false;

    if (esHashBcrypt(stored)) {
      passwordOk = await bcrypt.compare(password, stored);
    } else {
      // Registro legado en texto plano: comparar y, si es correcto,
      // reemplazarlo por su hash bcrypt (migración transparente).
      passwordOk = (stored === password);
      if (passwordOk) {
        try {
          const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
          await pool.request()
            .input('usuario', sql.NVarChar, usuario)
            .input('hash', sql.NVarChar, hash)
            .query('UPDATE dbo.usuarios SET password = @hash WHERE usuario = @usuario');
          context.log('Password migrado a bcrypt →', usuario);
        } catch (mErr) {
          // No bloquear el login si falla la migración; se reintenta en el próximo login
          context.log.warn('No se pudo migrar password a bcrypt:', mErr.message);
        }
      }
    }

    if (!passwordOk) {
      context.log('Login fallido: password incorrecto →', usuario);
      let extra = {};
      if (intentosOn) { try { const f = await intentosFallo(pool, usuario.toLowerCase(), ipDe(req)); extra = f.bloqueadoMin > 0
        ? { bloqueado: true, minutos: f.bloqueadoMin, error: 'Demasiados intentos fallidos. Espera ' + f.bloqueadoMin + ' minuto(s) e intenta de nuevo, o pide ayuda a Coordinación RR.LL.' }
        : { intentosRestantes: Math.max(0, INT_MAX - f.fallos) }; } catch (e) {} }
      /* rechazado: la clave es incorrecta en Azure -> la pantalla NO debe probar por Google (evitaria el limite) */
      context.res = {
        status: extra.bloqueado ? 429 : 401,
        body: Object.assign({ success: false, rechazado: true, error: 'Usuario o contrasena incorrectos.' }, extra)
      };
      return;
    }
    if (intentosOn) { try { await intentosLimpiar(pool, usuario.toLowerCase()); } catch (e) {} }
    /* _CLAVE_POLITICA_V1: ¿la clave cumple la regla minima? (solo se informa; el cambio lo hace el usuario) */
    const pol = POL.evaluar(password, usuario);
    const cambioObligatorio = process.env.CLAVE_CAMBIO_OBLIGATORIO === '1';

    // 6. Armar respuesta (mismo formato que GAS login())
    const fundos = FUNDOS_SUPERVISOR[usuario] || [];
    const necesitaElegirFundo = SUP_MULTI.includes(usuario);

    const elapsed = Date.now() - startTime;
    context.log('Login OK →', usuario, '(' + elapsed + 'ms)');

    // 7. Firmar JWT de sesión (8 horas)
    let token = null;
    try {
      token = firmarToken({
        sub:     u.id_sistema,
        usuario: u.usuario,
        rol:     (u.rol || '').trim().toLowerCase(),
        empresa: (u.empresa || '').trim().toUpperCase(),
        cd:      pol.ok ? 0 : 1,              /* _CLAVE_POLITICA_V1: clave debil (la pantalla lo lee del token) */
        co:      cambioObligatorio ? 1 : 0    /* cambio obligatorio (CLAVE_CAMBIO_OBLIGATORIO=1) */
      });
    } catch (tErr) {
      context.log.warn('No se pudo firmar JWT (¿falta JWT_SECRET?):', tErr.message);
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        token: token,
        claveDebil: !pol.ok, claveMotivos: pol.motivos, cambioObligatorio: cambioObligatorio,   /* _CLAVE_POLITICA_V1 */
        user: {
          id:                  u.id_sistema,
          usuario:             u.usuario,
          nombre:              (u.nombre || '').trim(),
          rol:                 (u.rol || '').trim().toLowerCase(),
          empresa:             (u.empresa || '').trim().toUpperCase(),
          correo:              (u.correo || '').trim(),
          cargo:               (u.cargo || '').trim(),
          sector:              (u.sector || '').trim(),
          fundos:              fundos,
          necesitaElegirFundo: necesitaElegirFundo
        },
        elapsed_ms: elapsed
      }
    };

  } catch (e) {
    context.log.error('auth-login error:', e.message, e.stack);
    context.res = {
      status: 500,
      body: { success: false, error: 'Error interno: ' + e.message }
    };
  }
};
