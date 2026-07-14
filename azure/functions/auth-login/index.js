const { sql, getPool } = require('../shared/db');
const bcrypt = require('bcryptjs');
const { firmarToken } = require('../shared/auth');

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
      context.res = {
        status: 401,
        body: { success: false, error: 'Usuario o contrasena incorrectos.' }
      };
      return;
    }

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
        empresa: (u.empresa || '').trim().toUpperCase()
      });
    } catch (tErr) {
      context.log.warn('No se pudo firmar JWT (¿falta JWT_SECRET?):', tErr.message);
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        token: token,
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
