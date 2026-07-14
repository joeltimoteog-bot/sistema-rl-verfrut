const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  context.log('trabajadores-search triggered');
  const startTime = Date.now();

  try {
    const dni = (req.query.dni || '').toString().trim();
    const empresa = (req.query.empresa || '').toString().trim().toUpperCase();

    if (!dni) {
      context.res = {
        status: 400,
        body: {
          success: false,
          error: 'Parametro dni es requerido. Ej: ?dni=12345678'
        }
      };
      return;
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('dni', sql.NVarChar(20), dni);

    let query;
    if (empresa === 'RAPEL') {
      query = `SELECT *, 'RAPEL' AS empresa_origen FROM dbo.Trabajadores_RAPEL WHERE dni = @dni`;
    } else if (empresa === 'VERFRUT') {
      query = `SELECT *, 'VERFRUT' AS empresa_origen FROM dbo.Trabajadores_VERFRUT WHERE dni = @dni`;
    } else {
      query = `
        SELECT *, 'RAPEL' AS empresa_origen FROM dbo.Trabajadores_RAPEL WHERE dni = @dni
        UNION ALL
        SELECT *, 'VERFRUT' AS empresa_origen FROM dbo.Trabajadores_VERFRUT WHERE dni = @dni
      `;
    }

    const result = await request.query(query);
    const elapsed = Date.now() - startTime;
    context.log('Busqueda DNI ' + dni + ' en ' + elapsed + 'ms - ' + result.recordset.length + ' resultado(s)');

    if (result.recordset.length === 0) {
      context.res = {
        status: 404,
        body: {
          success: false,
          mensaje: 'Trabajador no encontrado',
          dni: dni,
          elapsed_ms: elapsed,
          fuente: 'AZURE_SQL'
        }
      };
      return;
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        encontrados: result.recordset.length,
        trabajadores: result.recordset,
        elapsed_ms: elapsed,
        fuente: 'AZURE_SQL'
      }
    };
  } catch (e) {
    context.log.error('Error en trabajadores-search:', e);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: e.message,
        code: e.code,
        name: e.name
      }
    };
  }
};