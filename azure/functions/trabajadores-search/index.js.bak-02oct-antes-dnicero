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

    /* _BUSCAR_NOMBRE_V1 (23-set-2026): busqueda por NOMBRE (?q=juan perez).
       Cada palabra debe aparecer en el nombre completo. Maximo 30 resultados.
       La busqueda por DNI de siempre no cambia. */
    const q = (req.query.q || '').toString().trim();
    if (!dni && q.length >= 3) {
      const palabras = q.split(/\s+/).filter(function (w) { return w.length >= 2; }).slice(0, 5);
      const poolQ = await getPool();
      const rq = poolQ.request();
      const conds = palabras.map(function (w, i) { rq.input('w' + i, sql.NVarChar(120), '%' + w + '%'); return 'nombre_completo LIKE @w' + i; }).join(' AND ') || '1=0';
      const partes = [];
      if (empresa !== 'VERFRUT') partes.push(`SELECT TOP 30 *, 'RAPEL' AS empresa_origen FROM dbo.Trabajadores_RAPEL WHERE ${conds}`);
      if (empresa !== 'RAPEL')   partes.push(`SELECT TOP 30 *, 'VERFRUT' AS empresa_origen FROM dbo.Trabajadores_VERFRUT WHERE ${conds}`);
      const rs = await rq.query(partes.map(function (x) { return '(' + x + ')'; }).join(' UNION ALL '));
      const lista = (rs.recordset || []).slice(0, 30);
      context.res = { status: 200, body: { success: true, encontrados: lista.length, trabajadores: lista, elapsed_ms: Date.now() - startTime, fuente: 'AZURE_SQL' } };
      return;
    }

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