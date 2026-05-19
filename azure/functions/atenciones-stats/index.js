const { sql, getPool } = require('../shared/db');

module.exports = async function (context, req) {
  context.log('atenciones-stats triggered');
  const startTime = Date.now();

  try {
    const { anio, empresa, supervisor } = req.query;
    const pool = await getPool();

    const filtros = ['1=1'];
    const inputs = {};
    if (anio) {
      filtros.push('anio = @anio');
      inputs.anio = { type: sql.Int, value: parseInt(anio) };
    }
    if (empresa) {
      filtros.push('empresa = @empresa');
      inputs.empresa = { type: sql.NVarChar, value: empresa };
    }
    if (supervisor) {
      filtros.push('supervisor LIKE @supervisor');
      inputs.supervisor = { type: sql.NVarChar, value: '%' + supervisor + '%' };
    }
    const whereClause = filtros.join(' AND ');

    const runQuery = async (query) => {
      const request = pool.request();
      Object.keys(inputs).forEach(k => request.input(k, inputs[k].type, inputs[k].value));
      return await request.query(query);
    };

    const resumenResult = await runQuery(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN CONVERT(date, fecha_atencion) = CONVERT(date, GETDATE()) THEN 1 ELSE 0 END) AS hoy,
        SUM(CASE WHEN YEAR(fecha_atencion) = YEAR(GETDATE()) AND MONTH(fecha_atencion) = MONTH(GETDATE()) THEN 1 ELSE 0 END) AS este_mes,
        SUM(CASE WHEN YEAR(fecha_atencion) = YEAR(GETDATE()) THEN 1 ELSE 0 END) AS este_anio,
        SUM(CASE WHEN estado = 'EN PROCESO' THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado = 'FINALIZADO' THEN 1 ELSE 0 END) AS finalizados
      FROM Atenciones
      WHERE ${whereClause}
    `);

    const porMesResult = await runQuery(`
      SELECT CONCAT(anio, '-', RIGHT('00' + CAST(mes AS VARCHAR), 2)) AS mes_label,
        COUNT(*) AS cantidad
      FROM Atenciones
      WHERE ${whereClause} AND anio IS NOT NULL AND mes IS NOT NULL
      GROUP BY anio, mes
      ORDER BY anio DESC, mes DESC
    `);

    const porAnioResult = await runQuery(`
      SELECT anio, COUNT(*) AS cantidad
      FROM Atenciones
      WHERE ${whereClause} AND anio IS NOT NULL
      GROUP BY anio
      ORDER BY anio DESC
    `);

    const porEmpresaResult = await runQuery(`
      SELECT empresa, COUNT(*) AS cantidad
      FROM Atenciones
      WHERE ${whereClause} AND empresa IS NOT NULL AND empresa != ''
      GROUP BY empresa
      ORDER BY cantidad DESC
    `);

    const porEstadoResult = await runQuery(`
      SELECT estado, COUNT(*) AS cantidad
      FROM Atenciones
      WHERE ${whereClause} AND estado IS NOT NULL AND estado != ''
      GROUP BY estado
      ORDER BY cantidad DESC
    `);

    const porTipoResult = await runQuery(`
      SELECT detalle_documento AS tipo, COUNT(*) AS cantidad
      FROM Atenciones
      WHERE ${whereClause} AND detalle_documento IS NOT NULL AND detalle_documento != ''
      GROUP BY detalle_documento
      ORDER BY cantidad DESC
    `);

    const porSupervisorResult = await runQuery(`
      SELECT TOP 20 supervisor, COUNT(*) AS cantidad
      FROM Atenciones
      WHERE ${whereClause} AND supervisor IS NOT NULL AND supervisor != ''
      GROUP BY supervisor
      ORDER BY cantidad DESC
    `);

    const por_mes = {};
    porMesResult.recordset.forEach(r => { por_mes[r.mes_label] = r.cantidad; });

    const por_anio = {};
    porAnioResult.recordset.forEach(r => { por_anio[r.anio] = r.cantidad; });

    const por_empresa = {};
    porEmpresaResult.recordset.forEach(r => { por_empresa[r.empresa] = r.cantidad; });

    const por_estado = {};
    porEstadoResult.recordset.forEach(r => { por_estado[r.estado] = r.cantidad; });

    const por_tipo = {};
    porTipoResult.recordset.forEach(r => { por_tipo[r.tipo] = r.cantidad; });

    const por_supervisor = {};
    porSupervisorResult.recordset.forEach(r => { por_supervisor[r.supervisor] = r.cantidad; });

    const elapsed = Date.now() - startTime;
    context.log('Stats calculadas en', elapsed, 'ms');

    context.res = {
      status: 200,
      body: {
        success: true,
        resumen_global: resumenResult.recordset[0],
        por_mes: por_mes,
        por_anio: por_anio,
        por_empresa: por_empresa,
        por_estado: por_estado,
        por_tipo: por_tipo,
        por_supervisor: por_supervisor,
        elapsed: elapsed,
        fuente: 'AZURE_SQL'
      }
    };
  } catch (e) {
    context.log.error('Error en atenciones-stats:', e);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: e.message,
        code: e.code
      }
    };
  }
};
