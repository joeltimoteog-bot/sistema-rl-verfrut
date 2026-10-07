/* ═══════════════════════════════════════════════════════════════════════════
   kpi-admin (_KPI_RRLL_V1, 30-set-2026) — solo con la llave (lo usa el Apps Script)
   GET  mantenimiento/kpi/estado              resumen (personas, alertas pendientes, ultima copia ETI)
   GET  mantenimiento/kpi/alertasPendientes   alertas nuevas aun sin correo
   POST mantenimiento/kpi/alertasMarcar       { ids:[..], destinatarios }  anota UNA vez que salio el correo
   POST mantenimiento/kpi/atRegistro          { filas:[[anio, nro, 'aaaa-mm-dd hh:mm'], ...] }  hora de registro de atenciones (hoja)
   POST mantenimiento/kpi/recalcular          copia ETI + recalcula + registra alertas
   POST mantenimiento/kpi/resumen             KPIs por persona (para el log del editor)
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const KDB = require('../shared/kpi-db');
const ETI = require('../shared/kpi-eti');

module.exports = async function (context, req) {
  const accion = context.bindingData.accion, b = req.body || {};
  const res = (status, body) => { context.res = { status, body }; };
  try {
    const pool = await getPool();
    await KDB.asegurarTablas(pool);
    if (accion === 'estado') {
      const r = await pool.request().query(`SELECT
        (SELECT COUNT(*) FROM dbo.KPI_Personas WHERE activo = 1) AS personas,
        (SELECT COUNT(*) FROM dbo.KPI_Alertas) AS alertas, (SELECT COUNT(*) FROM dbo.KPI_Alertas WHERE enviado IS NULL) AS pendientes,
        (SELECT COUNT(*) FROM dbo.KPI_AtRegistro) AS at_registro,
        (SELECT valor FROM dbo.CV_Estado WHERE clave = 'kpi_eti_sync') AS eti_sync`);
      return res(200, Object.assign({ success: true }, r.recordset[0]));
    }
    if (accion === 'alertasPendientes') {
      const r = await pool.request().query(`SELECT TOP 100 id, CONVERT(NVARCHAR(30), creado, 126) AS creado, usuario, nombre, codigo, tipo, mensaje, detalle
        FROM dbo.KPI_Alertas WHERE enviado IS NULL ORDER BY id`);
      return res(200, { success: true, alertas: r.recordset });
    }
    if (accion === 'alertasMarcar') {
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(x => parseInt(x, 10)).filter(x => x > 0);
      if (!ids.length) return res(400, { success: false, error: 'Faltan ids' });
      const r = await pool.request().input('d', sql.NVarChar(400), String(b.destinatarios || '').slice(0, 400))
        .query(`UPDATE dbo.KPI_Alertas SET enviado = SYSUTCDATETIME(), destinatarios = @d WHERE enviado IS NULL AND id IN (${ids.join(',')})`);
      return res(200, { success: true, marcadas: r.rowsAffected[0] });
    }
    if (accion === 'atRegistro') {
      const filas = (Array.isArray(b.filas) ? b.filas : []).filter(f => Array.isArray(f) && f.length >= 3);
      let n = 0;
      for (let i = 0; i < filas.length; i += 300) {
        const lote = filas.slice(i, i + 300).map(f => [parseInt(f[0], 10), parseInt(f[1], 10), String(f[2] || '').slice(0, 16)])
          .filter(f => f[0] > 2000 && f[1] > 0 && /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(f[2]));
        if (!lote.length) continue;
        const r = await pool.request().input('j', sql.NVarChar(sql.MAX), JSON.stringify(lote)).query(`
          INSERT INTO dbo.KPI_AtRegistro (anio, nro, fecha_registro, fuente)
          SELECT t.anio, t.nro, MIN(t.f), 'hoja'
          FROM (SELECT CAST(JSON_VALUE(v.value, '$[0]') AS INT) AS anio, CAST(JSON_VALUE(v.value, '$[1]') AS INT) AS nro,
                       CAST(JSON_VALUE(v.value, '$[2]') AS DATETIME2(0)) AS f FROM OPENJSON(@j) v) t
          WHERE NOT EXISTS (SELECT 1 FROM dbo.KPI_AtRegistro x WHERE x.anio = t.anio AND x.nro = t.nro)
          GROUP BY t.anio, t.nro`);
        n += r.rowsAffected[0] || 0;
      }
      return res(200, { success: true, nuevas: n, recibidas: filas.length });
    }
    if (accion === 'recalcular') {
      let eti; try { eti = await ETI.sincronizar(pool); } catch (e) { eti = { error: e.message }; }
      const d = await KDB.calcular(pool, b.hoy);
      const r = b.soloVer ? null : await KDB.registrar(pool, d);
      return res(200, { success: true, eti, registro: r, hoy: d.hoy });
    }
    if (accion === 'resumen') {
      const d = await KDB.calcular(pool, b.hoy);
      return res(200, { success: true, hoy: d.hoy, eti_sync: d.eti_sync, personas: d.personas.map(p => ({ usuario: p.usuario, nombre: p.nombre, encontrado: p.usuario_encontrado, enlace: p.enlace,
        nota: p.nota, kpis: p.kpis.map(k => ({ c: k.codigo, e: k.estado, num: k.num, den: k.den, pct: k.pct == null ? null : Math.round(k.pct * 1000) / 10, nivel: k.nivel || null })) })) });
    }
    return res(404, { success: false, error: 'Accion desconocida: ' + accion });
  } catch (err) {
    context.log.error('[kpi-admin] ' + accion + ': ' + err.message);
    return res(500, { success: false, error: err.message });
  }
};
