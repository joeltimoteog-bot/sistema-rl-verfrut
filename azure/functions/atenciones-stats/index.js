const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

async function calcularOriginal(context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

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
        -- _STATS_LIMA_V1: GETDATE() es UTC en Azure; desde las 19:00 de Lima ya era "manana"
        -- y "hoy" daba 0. Ahora se compara contra la fecha de Lima (UTC-5).
        SUM(CASE WHEN CONVERT(date, fecha_atencion) = CONVERT(date, SWITCHOFFSET(SYSDATETIMEOFFSET(), '-05:00')) THEN 1 ELSE 0 END) AS hoy,
        SUM(CASE WHEN YEAR(fecha_atencion) = YEAR(SWITCHOFFSET(SYSDATETIMEOFFSET(), '-05:00')) AND MONTH(fecha_atencion) = MONTH(SWITCHOFFSET(SYSDATETIMEOFFSET(), '-05:00')) THEN 1 ELSE 0 END) AS este_mes,
        SUM(CASE WHEN YEAR(fecha_atencion) = YEAR(SWITCHOFFSET(SYSDATETIMEOFFSET(), '-05:00')) THEN 1 ELSE 0 END) AS este_anio,
        SUM(CASE WHEN estado = 'EN PROCESO' THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado = 'FINALIZADO' THEN 1 ELSE 0 END) AS finalizados
      FROM Atenciones WITH (NOLOCK)
      WHERE ${whereClause}
    `);

    const porMesResult = await runQuery(`
      SELECT CONCAT(anio, '-', RIGHT('00' + CAST(mes AS VARCHAR), 2)) AS mes_label,
        COUNT(*) AS cantidad
      FROM Atenciones WITH (NOLOCK)
      WHERE ${whereClause} AND anio IS NOT NULL AND mes IS NOT NULL
      GROUP BY anio, mes
      ORDER BY anio DESC, mes DESC
    `);

    const porAnioResult = await runQuery(`
      SELECT anio, COUNT(*) AS cantidad
      FROM Atenciones WITH (NOLOCK)
      WHERE ${whereClause} AND anio IS NOT NULL
      GROUP BY anio
      ORDER BY anio DESC
    `);

    const porEmpresaResult = await runQuery(`
      SELECT empresa, COUNT(*) AS cantidad
      FROM Atenciones WITH (NOLOCK)
      WHERE ${whereClause} AND empresa IS NOT NULL AND empresa != ''
      GROUP BY empresa
      ORDER BY cantidad DESC
    `);

    const porEstadoResult = await runQuery(`
      SELECT estado, COUNT(*) AS cantidad
      FROM Atenciones WITH (NOLOCK)
      WHERE ${whereClause} AND estado IS NOT NULL AND estado != ''
      GROUP BY estado
      ORDER BY cantidad DESC
    `);

    const porTipoResult = await runQuery(`
      SELECT detalle_documento AS tipo, COUNT(*) AS cantidad
      FROM Atenciones WITH (NOLOCK)
      WHERE ${whereClause} AND detalle_documento IS NOT NULL AND detalle_documento != ''
      GROUP BY detalle_documento
      ORDER BY cantidad DESC
    `);

    const porSupervisorResult = await runQuery(`
      SELECT TOP 20 supervisor, COUNT(*) AS cantidad
      FROM Atenciones WITH (NOLOCK)
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


/* ═══════════════════════════════════════════════════════════════════════════
   _STATS_CACHE_V1 (24-set-2026) — que las estadisticas no saturen la base
   ---------------------------------------------------------------------------
   Cada llamada recorria la tabla Atenciones 7 veces. Con varios usuarios
   abriendo el Dashboard a la vez la base (S1) se saturaba y TODO se ponia
   lento (login, busqueda por DNI, guardados). Ahora:
     1) cache en memoria 2 min por (anio, empresa, supervisor);
     2) peticiones iguales simultaneas esperan UNA sola consulta;
     3) si la base falla, se devuelve la ultima respuesta buena (hasta 30 min).
   El calculo (calcularOriginal) es EXACTAMENTE el mismo de antes.
   ═══════════════════════════════════════════════════════════════════════════ */
const _cache = new Map();
const _enCurso = new Map();
const TTL_MS = 120000, TTL_VIEJO_MS = 30 * 60000;

module.exports = async function (context, req) {
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;
  const q = req.query || {};
  const k = [q.anio || '', q.empresa || '', q.supervisor || ''].join('|').toUpperCase();
  const c = _cache.get(k), ahora = Date.now();
  if (c && (ahora - c.ts) < TTL_MS) {
    context.res = { status: 200, headers: { 'X-Cache': 'HIT' }, body: c.body };
    return;
  }
  if (_enCurso.has(k)) {
    const b = await _enCurso.get(k);
    if (b) { context.res = { status: 200, headers: { 'X-Cache': 'SHARED' }, body: b }; return; }
  }
  let resolver;
  _enCurso.set(k, new Promise(function (r) { resolver = r; }));
  try {
    await calcularOriginal(context, req);
    const ok = context.res && context.res.status === 200 && context.res.body && context.res.body.success;
    if (ok) {
      if (_cache.size > 300) _cache.clear();
      _cache.set(k, { ts: Date.now(), body: context.res.body });
      resolver(context.res.body);
    } else {
      resolver(null);
      if (c && (ahora - c.ts) < TTL_VIEJO_MS) {
        context.res = { status: 200, headers: { 'X-Cache': 'STALE' }, body: Object.assign({}, c.body, { _viejo: true }) };
      }
    }
  } catch (e) {
    resolver(null);
    throw e;
  } finally {
    _enCurso.delete(k);
  }
};
