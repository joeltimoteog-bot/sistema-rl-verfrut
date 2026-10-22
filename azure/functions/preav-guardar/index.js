/* ═══════════════════════════════════════════════════════════════════════════
   preav-guardar (_PREAV_AZURE_V1, 21-oct-2026)
   POST /api/preav/{savePreaviso|updatePreavisoDesenlace|registrarApelacionPreaviso|getPreavisos}
   Con el token del login. Respuestas = las del Apps Script.
   Apagado (CV_Estado preav_azure_primero <> '1'), sin token o tabla sin cargar -> 503/401
   y la pantalla usa Google como siempre.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const CG = require('../shared/cv-guardar');
const TH = require('../shared/tablas-hoja');
const H = require('../shared/preav-guardar');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    if (accion !== 'getPreavisos' && H.ACCIONES.indexOf(accion) < 0) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const pool = await getPool(); await CG.asegurarTablas(pool);
    if (!(await H.encendido(pool))) { context.res = { status: 503, body: { success: false, apagado: true, error: 'Preavisos en Azure apagado' } }; return; }
    if (accion === 'getPreavisos') {
      const T = await TH.leer(pool, H.CLAVE);
      if (!T) { context.res = { status: 503, body: { success: false, error: 'Tabla de preavisos aun no cargada' } }; return; }
      context.res = { status: 200, body: H.getPreavisos(T, String(t.usuario)) };
      return;
    }
    const r = await H.ejecutar(pool, accion, req.body || {}, String(t.usuario), false);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[preav-guardar] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
