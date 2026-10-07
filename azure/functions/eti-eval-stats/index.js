/* ═══════════════════════════════════════════════════════════════════════════
   eti-eval-stats (_ETI_EVAL_AZURE_V1, 30-set-2026)
   GET /api/etieval/stats?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&empresa=&sector=&modalidad=QR|MANUAL
   Devuelve filas agregadas (dia, empresa, supervisor, sector, ruta, codigo, modalidad) con
   evaluados, suma de resultados, aprobados y % por tema. La pagina arma los indicadores.
   Datos anonimos: no hay DNI ni nombres de trabajadores.
   ═══════════════════════════════════════════════════════════════════════════ */
const { getPool } = require('../shared/db');
const E = require('../shared/eti-eval');

module.exports = async function (context, req) {
  try {
    const pool = await getPool(); await E.asegurarTablas(pool);
    const filas = await E.stats(pool, req.query || {});
    context.res = { status: 200, headers: { 'Cache-Control': 'no-store' }, body: { success: true, filas, generado: new Date().toISOString() } };
  } catch (err) {
    context.log.error('[eti-eval-stats] ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
