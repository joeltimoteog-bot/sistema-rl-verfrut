/* ═══════════════════════════════════════════════════════════════════════════
   mant-resp (_MANT_RESP_V1, 17-nov-2026) — Responsables de unidades en Supabase
   POST /api/mant/resp/{listar|buscar|guardar|sembrar}   (con el token del login)
   Quien es y su rol salen del TOKEN FIRMADO, no de lo que manda el navegador.
   ═══════════════════════════════════════════════════════════════════════════ */
const R = require('../shared/mant-resp');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return require('../shared/auth.js').verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    const f = R.ACCIONES[accion];
    if (!f) { context.res = { status: 404, body: { ok: false, msg: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { ok: false, msg: 'Sin sesion valida' } }; return; }
    const r = await f(req.body || {}, t);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[mant-resp] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { ok: false, msg: err.message } };
  }
};
