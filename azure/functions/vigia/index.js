/* ════════════════════════════════════════════════════════════════════════
   vigia — _VIGIA_V1 (02-nov-2026) · Marcas de cambio de TODAS las tablas, en una sola consulta
   GET vigia/marcas  →  { success, marcas: { atenciones, atenciones_hoy, tablas_casos, tablas_visitas,
                          mant_registro, fus_buses, sol_edicion, acc_solicitudes, cumpl_*, horas_*, cap_*,
                          alm_*, inv_*, preav_registro, sup_registro, inf_registro, e360_evaluaciones, bs_* ... },
                          hoy, ms }
   Cada pestaña del sistema consulta esto cada 15–20 s (caché 6 s por instancia) y, si una marca cambió,
   refresca SOLO ese módulo. Así cualquier registro de cualquier usuario (PC, laptop, celular) aparece en
   todas las pantallas en segundos, sin depender de Firebase ni del Apps Script.
   · Atenciones: MAX(id) + MAX(modificado) (índice IX_At_modificado) + total de hoy.
   · Casos / Visitas: CV_Estado 'tablas_casos' / 'tablas_visitas' (cambian en cada guardado Azure-first).
   · Resto de módulos: TH_Estado.marca (cambia en cada guardado / carga).
   Exige sesión (Bearer).
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

let _c = { ts: 0, body: null };
const CACHE_MS = 6000;

module.exports = async function (context, req) {
  const u = exigirAuth(context, req); if (u === null) return;
  const t0 = Date.now();
  if (_c.body && t0 - _c.ts < CACHE_MS) { context.res = { status: 200, headers: { 'X-Cache': 'HIT' }, body: _c.body }; return; }
  try {
    const pool = await getPool();
    const hoyLima = new Date(t0 - 5 * 3600e3).toISOString().slice(0, 10);
    const r = await pool.request().input('hoy', sql.Date, hoyLima).query(`
      SELECT 'atenciones' AS clave, CONCAT(MAX(id), '|', CONVERT(VARCHAR(30), MAX(modificado), 126)) AS marca FROM Atenciones
      UNION ALL SELECT 'atenciones_hoy', CAST(COUNT(*) AS VARCHAR(20)) FROM Atenciones WHERE fecha_atencion = @hoy
      UNION ALL SELECT clave, CAST(valor AS NVARCHAR(100)) FROM dbo.CV_Estado WHERE clave IN ('tablas_casos', 'tablas_visitas')
      UNION ALL SELECT clave, marca FROM dbo.TH_Estado WHERE marca IS NOT NULL`);
    const marcas = {}; (r.recordset || []).forEach(x => { marcas[x.clave] = x.marca == null ? '' : String(x.marca); });
    /* _AT_ELIMINADAS_VIVO_V1 (12-nov-2026): marca de BAJAS de atenciones (ultima copia 'eliminada…' del respaldo), para que las
       demas pantallas quiten lo que otro usuario elimino. Va en consulta aparte: si falla, el resto del vigia sigue igual. */
    try {
      const e = await pool.request().query("SELECT COALESCE(MAX(rid), 0) AS m FROM dbo.Atenciones_Respaldo WHERE motivo LIKE 'eliminada%'");
      marcas.at_eliminadas = String((e.recordset[0] && e.recordset[0].m) || 0);
    } catch (eE) { /* sin la tabla o sin permiso: no hay marca, nada mas cambia */ }
    const body = { success: true, marcas, hoy: parseInt(marcas.atenciones_hoy || '0', 10) || 0, ms: Date.now() - t0 };
    _c = { ts: Date.now(), body };
    context.res = { status: 200, headers: { 'X-Cache': 'MISS' }, body };
  } catch (e) {
    context.log.error('vigia/marcas: ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
