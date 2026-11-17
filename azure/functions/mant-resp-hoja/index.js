/* ═══════════════════════════════════════════════════════════════════════════
   mant-resp-hoja (_MANT_RESP_V1, 17-nov-2026) — SOLO con la llave (la usa el Apps Script)
   POST /api/mantenimiento/resp/sembrar  { items:[...] }  agrega a rl.mant_responsables los DNI de la
   hoja "BB.DD. RESPONSABLES" que aun no esten. Nunca pisa lo que ya esta en Supabase.
   ═══════════════════════════════════════════════════════════════════════════ */
const R = require('../shared/mant-resp');
const HOJA = { usuario: 'hoja', rol: 'administrador' };   /* la llave ya probo que es el Apps Script */

module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    if (accion !== 'sembrar') { context.res = { status: 404, body: { ok: false, msg: 'Accion desconocida' } }; return; }
    const r = await R.ACCIONES.sembrar(req.body || {}, HOJA);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[mant-resp-hoja] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { ok: false, msg: err.message } };
  }
};
