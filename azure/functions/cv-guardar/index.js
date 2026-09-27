/* ═══════════════════════════════════════════════════════════════════════════
   cv-guardar (_CV_AZURE_PRIMERO_V1, 26-set-2026)
   POST /api/cv/guardar/{saveCaso|updateCaso|eliminarCaso|saveVisita|updateVisita|eliminarVisita}
   La pantalla (con el token del login) guarda DIRECTO en dbo.Casos / dbo.Visitas.
   Respuesta = la misma que daria el Apps Script. Apagado (CV_Estado azure_primero
   <> '1') o sin token -> 503/401 y la pantalla guarda por Google como siempre.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const G = require('../shared/cv-guardar');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}

module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    if (!G.TIPO[accion]) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const pool = await getPool(); await G.asegurarTablas(pool);
    if (!(await G.encendido(pool))) { context.res = { status: 503, body: { success: false, apagado: true, error: 'Guardado en Azure apagado' } }; return; }
    const r = await G.ejecutar(pool, accion, req.body || {}, t.usuario, false);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[cv-guardar] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
