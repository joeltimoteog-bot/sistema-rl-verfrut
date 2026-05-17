const { sql, getPool } = require('../shared/db');

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

    // 5. Validar password (texto plano por ahora — TODO: bcrypt en el futuro)
    if (String(u.password).trim() !== password) {
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

    context.res = {
      status: 200,
      body: {
        success: true,
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
