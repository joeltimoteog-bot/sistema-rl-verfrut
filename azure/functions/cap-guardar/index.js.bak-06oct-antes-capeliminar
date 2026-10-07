/* ═══════════════════════════════════════════════════════════════════════════
   cap-guardar (_CAP_AZURE_PRIMERO_V1, 26-set-2026)
   POST /api/cap/guardar/{guardarCapacitacion|duplicarCapacitacion}  (con el token del login)
   Guarda la capacitacion y sus asistentes DIRECTO en Azure. Respuesta = la del Apps Script.
   Apagado (CV_Estado cap_azure_primero <> '1') o sin token -> 503/401 y la pantalla usa Google.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const CG = require('../shared/cv-guardar');
const C = require('../shared/cap-guardar');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    if (accion !== 'guardarCapacitacion' && accion !== 'duplicarCapacitacion') { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const pool = await getPool(); await CG.asegurarTablas(pool);
    if (!(await C.encendido(pool))) { context.res = { status: 503, body: { success: false, apagado: true, error: 'Guardado en Azure apagado' } }; return; }
    const r = await C.ejecutar(pool, accion, req.body || {}, t.usuario, t.rol, false);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[cap-guardar] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
