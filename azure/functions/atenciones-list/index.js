const { sql, getPool } = require('../shared/db');

module.exports = async function (context, req) {
  context.log('atenciones-list triggered');

  try {
    const { supervisor, empresa, desde, hasta, dni, estado, limite, pagina } = req.query;
    const pool = await getPool();
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

    const result = await request.query(`
      SELECT * FROM Atenciones
      WHERE ${where.join(' AND ')}
      ORDER BY fecha_atencion DESC, id DESC
      OFFSET ${off} ROWS FETCH NEXT ${lim} ROWS ONLY
    `);

    const countResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM Atenciones WHERE ${where.join(' AND ')}
    `);

    context.res = {
      body: {
        success: true,
        data: result.recordset,
        total: countResult.recordset[0].total,
        pagina: parseInt(pagina) || 1,
        limite: lim
      }
    };
  } catch (e) {
    context.log.error('Error en atenciones-list:', e);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
