/* ═══════════════════════════════════════════════════════════════════════════
   sup-guardar (_SUP_AZURE_V1, 24-oct-2026)
   POST /api/sup/{saveSupervisor|addMotivoCaso|getSupervisores|getMotivosCasos}
   Con el token del login. Respuestas = las del Apps Script.
   Apagado (CV_Estado sup_azure_primero <> '1'), sin token o tabla sin cargar -> 503/401
   y la pantalla sigue por el camino de siempre (copia JSON mod/… o Google).
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const CG = require('../shared/cv-guardar');
const TH = require('../shared/tablas-hoja');
const H = require('../shared/sup-guardar');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    if (H.LECTURAS.indexOf(accion) < 0 && H.ACCIONES.indexOf(accion) < 0) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const pool = await getPool(); await CG.asegurarTablas(pool);
    if (!(await H.encendido(pool))) { context.res = { status: 503, body: { success: false, apagado: true, error: 'Supervisores/Motivos en Azure apagado' } }; return; }
    if (H.LECTURAS.indexOf(accion) >= 0) {
      const T = await TH.leer(pool, accion === 'getSupervisores' ? H.K_SUP : H.K_MOT);
      if (!T) { context.res = { status: 503, body: { success: false, error: 'Tabla aun no cargada' } }; return; }
      context.res = { status: 200, body: accion === 'getSupervisores' ? H.getSupervisores(T) : H.getMotivosCasos(T) };
      return;
    }
    const r = await H.ejecutar(pool, accion, req.body || {}, String(t.usuario), false, null, t.rol);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[sup-guardar] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
