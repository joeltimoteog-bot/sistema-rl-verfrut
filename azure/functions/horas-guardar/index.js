/* ═══════════════════════════════════════════════════════════════════════════
   horas-guardar (_HORAS_AZURE_PRIMERO_V1, 27-set-2026)
   POST /api/horas/guardar/{horasRegistrar|horasEditar|horasEliminar|horasAprobar|
                            horasAgregarMotivo|horasEliminarMotivo}   (con el token del login)
   Guarda DIRECTO en Azure con las reglas del Apps Script. Respuesta = la del Apps Script
   (tambien las negativas, p. ej. "Solo administradores", con HTTP 200: Azure manda).
   Apagado (CV_Estado horas_azure_primero <> '1') o sin token -> 503/401 y la pantalla usa Google.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const CG = require('../shared/cv-guardar');
const H = require('../shared/horas-guardar');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    if (H.ACCIONES.indexOf(accion) < 0) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const pool = await getPool(); await CG.asegurarTablas(pool);
    if (!(await H.encendido(pool))) { context.res = { status: 503, body: { success: false, apagado: true, error: 'Guardado en Azure apagado' } }; return; }
    const r = await H.ejecutar(pool, accion, req.body || {}, String(t.usuario), false);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[horas-guardar] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
