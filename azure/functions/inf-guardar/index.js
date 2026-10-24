/* ═══════════════════════════════════════════════════════════════════════════
   inf-guardar (_INF_AZURE_V1, 24-oct-2026)
   POST /api/inf/{saveInformeIntegral|updateInformeIntegral|getInformesIntegrales}
   Con el token del login. Respuestas = las del Apps Script.
   Apagado (CV_Estado inf_azure_primero <> '1'), sin token o tabla sin cargar -> 503/401
   y la pantalla usa Google como siempre.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const CG = require('../shared/cv-guardar');
const TH = require('../shared/tablas-hoja');
const H = require('../shared/inf-guardar');

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
    if (!(await H.encendido(pool))) { context.res = { status: 503, body: { success: false, apagado: true, error: 'Informes integrales en Azure apagado' } }; return; }
    if (accion === 'getInformesIntegrales') {
      const T = await TH.leer(pool, H.CLAVE);
      if (!T) { context.res = { status: 503, body: { success: false, error: 'Tabla de informes aun no cargada' } }; return; }
      context.res = { status: 200, body: H.getInformesIntegrales(T, req.body || {}) };
      return;
    }
    const r = await H.ejecutar(pool, accion, req.body || {}, String(t.usuario), false);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[inf-guardar] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
