/* ═══════════════════════════════════════════════════════════════════════════
   eti-eval-guardar (_ETI_EVAL_AZURE_V1, 30-set-2026)
   POST /api/etieval/guardar   body: { registros: [ {...}, ... ] }  (max 100 por llamada)
   Lo usan: la pagina del trabajador (QR, anonima), la evaluacion manual y el boton
   "Sincronizar con Azure" del admin. Es idempotente por id (no duplica al reenviar).
   ═══════════════════════════════════════════════════════════════════════════ */
const { getPool } = require('../shared/db');
const E = require('../shared/eti-eval');

module.exports = async function (context, req) {
  try {
    const b = req.body || {};
    const lista = Array.isArray(b.registros) ? b.registros : (b.id ? [b] : []);
    if (!lista.length) { context.res = { status: 400, body: { success: false, error: 'Sin registros' } }; return; }
    if (lista.length > 100) { context.res = { status: 413, body: { success: false, error: 'Maximo 100 registros por llamada' } }; return; }
    const pool = await getPool(); await E.asegurarTablas(pool);
    const r = await E.guardar(pool, lista);
    context.res = { status: 200, body: { success: true, ...r } };
  } catch (err) {
    context.log.error('[eti-eval-guardar] ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
