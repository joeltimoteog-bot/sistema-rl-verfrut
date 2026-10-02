const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');
const AC = require('../shared/at-cambios');   /* _AT_CAMBIOS_V1 */

module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  context.log('atenciones-list triggered');

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
        body: { success: false, error: 'Variables de entorno faltantes', envCheck: envCheck }
      };
      return;
    }

    context.log('Intentando conectar al pool...');
    const pool = await getPool();
    context.log('Pool conectado OK');

    const q = req.query || {};
    const { supervisor, empresa, desde, hasta, dni, estado, usuario } = q;

    // Aceptar tanto limit/limite y page/pagina (ingles + espanol)
    const limiteParam = q.limit || q.limite;
    const paginaParam = q.page || q.pagina;

    // Cap maximo 1000, minimo 1 (previene abuso y queries negativos)
    const lim = Math.max(1, Math.min(parseInt(limiteParam) || 100, 1000));
    const pag = Math.max(1, parseInt(paginaParam) || 1);
    const off = (pag - 1) * lim;

    const request = pool.request();
    const where = ['1=1'];
    if (supervisor) { where.push('supervisor LIKE @supervisor'); request.input('supervisor', sql.NVarChar, '%' + supervisor + '%'); }
    if (empresa)    { where.push('empresa = @empresa');          request.input('empresa', sql.NVarChar, empresa); }
    if (desde)      { where.push('fecha_atencion >= @desde');    request.input('desde', sql.Date, desde); }
    if (hasta)      { where.push('fecha_atencion <= @hasta');    request.input('hasta', sql.Date, hasta); }
    if (dni)        { where.push('dni = @dni');                  request.input('dni', sql.NVarChar, dni); }
    if (estado)     { where.push('estado = @estado');            request.input('estado', sql.NVarChar, estado); }
    if (usuario)    { where.push('usuario_sistema = @usuario'); request.input('usuario', sql.NVarChar, usuario); }
    /* _AT_CAMBIOS_V1 (01-oct-2026): ?cambiosDesde=<ISO UTC> -> solo lo que cambio desde esa hora (+ 'ahora' de Azure) */
    let ahora = null;
    if (q.cambiosDesde !== undefined) {
      const cd = new Date(String(q.cambiosDesde));
      if (isNaN(cd.getTime())) { context.res = { status: 400, body: { success: false, error: 'cambiosDesde invalido' } }; return; }
      await AC.asegurar(pool);
      ahora = (await pool.request().query('SELECT SYSUTCDATETIME() AS a')).recordset[0].a;   /* antes de leer: no se pierde nada entre consultas */
      where.push('modificado >= @cambiosDesde'); request.input('cambiosDesde', sql.DateTime2(3), cd);
    }

    context.log('Ejecutando query: limite=' + lim + ', pagina=' + pag + ', offset=' + off);

    const result = await request.query(
      'SELECT * FROM Atenciones WHERE ' + where.join(' AND ') +
      ' ORDER BY fecha_atencion DESC, id DESC' +
      ' OFFSET ' + off + ' ROWS FETCH NEXT ' + lim + ' ROWS ONLY'
    );

    const countResult = await request.query(
      'SELECT COUNT(*) AS total FROM Atenciones WHERE ' + where.join(' AND ')
    );

    context.res = {
      status: 200,
      body: {
        success: true,
        data: result.recordset,
        total: countResult.recordset[0].total,
        ...(ahora ? { ahora: new Date(ahora).toISOString() } : {}),   /* _AT_CAMBIOS_V1 */
        pagina: pag,
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