/* ═══════════════════════════════════════════════════════════════════════════
   eti-eval-admin (_ETI_EVAL_ADMIN_V1, 30-set-2026)
   POST /api/etieval/admin/{eliminar|editar}   Authorization: Bearer <token del login ETI>
   body: { filtro: {ids|sesion_id|sector|ruta|codigo|desde|hasta|modalidad}, cambios: {sector|ruta|codigo} }
   Solo el administrador (jtimoteo o rol admin). Un filtro vacio se rechaza.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const E = require('../shared/eti-eval');

function admin(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try {
    const t = jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET);
    const u = String(t.usuario || '').toLowerCase(), r = String(t.rol || '').toLowerCase();
    return (u === 'jtimoteo' || r === 'admin' || r === 'administrador') ? t : null;
  } catch (e) { return null; }
}
module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    const t = admin(req);
    if (!t) { context.res = { status: 401, body: { success: false, error: 'Solo el administrador' } }; return; }
    const b = req.body || {};
    const pool = await getPool(); await E.asegurarTablas(pool);
    let r;
    if (accion === 'eliminar') r = await E.eliminar(pool, b.filtro || {});
    else if (accion === 'editar') r = await E.editar(pool, b.filtro || {}, b.cambios || {});
    else { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    context.log('[eti-eval-admin] ' + accion + ' por ' + t.usuario + ': ' + JSON.stringify(r));
    context.res = { status: 200, body: { success: true, ...r } };
  } catch (err) {
    context.log.error('[eti-eval-admin] ' + accion + ': ' + err.message);
    context.res = { status: err.message === 'Filtro demasiado amplio' || err.message === 'Sin cambios' ? 400 : 500, body: { success: false, error: err.message } };
  }
};
