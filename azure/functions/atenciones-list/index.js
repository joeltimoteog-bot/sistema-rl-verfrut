const { sql, getPool } = require('../shared/db');

module.exports = async function (context, req) {
  context.log('atenciones-list triggered');

  // Diagnostico: verificar variables de entorno
  const envCheck = {
    sqlServer: process.env.SQL_SERVER ? 'OK' : 'MISSING',
    sqlDatabase: process.env.SQL_DATABASE ? 'OK' : 'MISSING',
    sqlUser: process.env.SQL_USER ? 'OK' : 'MISSING',
    sqlPassword: process.env.SQL_PASSWORD ? 'OK (length=' + process.env.SQL_PASSWORD.length + ')' : 'MISSING'
  };

  context.log('ENV CHECK:', JSON.stringify(envCheck));

  try {
    if (!process.env.SQL_SERVER || !process.env.SQL_USER || !process.env.SQL_PASSWORD) {
      context.res = {
        status: 500,
        body: {
          success: false,
          error: 'Variables de entorno faltantes',
          envCheck: envCheck
        }
      };
      return;
    }

    context.log('Intentando conectar al pool...');
    const pool = await getPool();
    context.log('Pool conectado OK');

    const { supervisor, empresa, desde, hasta, dni, estado, limite, pagina } = req.query || {};
    const request = pool.request();

    const where = ['1=1'];
    if (supervisor) { where.push('supervisor LIKE @supervisor'); request.input('supervisor', sql.NVarChar, '%' + supervisor + '%'); }
    if (empresa)    { where.push('empresa = @empresa');          request.input('empresa', sql.NVarChar, empresa); }
    if (desde)      { where.push('fecha_atencion >= @desde');    request.input('desde', sql.Date, desde); }
    if (hasta)      { where.push('fecha_atencion <= @hasta');    request.input('hasta', sql.Date, hasta); }
    if (dni)        { where.push('dni = @dni');                  request.input('dni', sql.NVarChar, dni); }
    if (estado)     { where.push('estado = @estado');            request.input('estado', sql.NVarChar, estado); }

    const lim = parseInt(limite) || 100;
    const off = ((parseInt(pagina) || 1) - 1) * lim;

    context.log('Ejecutando query...');
    const result = await request.query('SELECT * FROM Atenciones WHERE ' + where.join(' AND ') + ' ORDER BY fecha_atencion DESC, id DESC OFFSET ' + off + ' ROWS FETCH NEXT ' + lim + ' ROWS ONLY');

    const countResult = await pool.request().query('SELECT COUNT(*) AS total FROM Atenciones WHERE ' + where.join(' AND '));

    context.res = {
      status: 200,
      body: {
        success: true,
        data: result.recordset,
        total: countResult.recordset[0].total,
        pagina: parseInt(pagina) || 1,
        limite: lim
      }
    };
  } catch (e) {
    context.log.error('Error completo:', e);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: e.message || 'Error desconocido',
        code: e.code || null,
        name: e.name || null,
        envCheck: envCheck,
        stackPreview: e.stack ? e.stack.substring(0, 300) : null
      }
    };
  }
};
