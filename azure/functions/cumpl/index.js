/* ═══════════════════════════════════════════════════════════════════════════
   cumpl (_CUMPL_AZURE_V1, 26-set-2026) — CONTROL DE CUMPLIMIENTO desde Azure
   POST /api/cumpl/cumplPendientes  { usuario, rol }   (campana / bloqueo)
   POST /api/cumpl/cumplPanel       { usuario, rol }   (panel del coordinador)
   POST /api/cumpl/getCumplimiento  { usuario }        (aviso del dashboard)
   Mismo calculo que el Apps Script (ver shared/cumpl-motor.js). Lee los datos
   que manda cumpl-importar + visitas y casos de dbo.CV_Visitas / CV_Casos.
   Si aun no hay datos -> 503 y la pantalla usa Google, como siempre.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const cumplDb = require('../shared/cumpl-db');
const cvDb = require('../shared/cv-db');
const { crearMotor, ausParse, _t } = require('../shared/cumpl-motor');
const TC = require('../shared/tablas-cv');   /* _TABLAS_CV_V2 */
const CUW = require('../shared/cumpl-guardar');   /* _CUMPL_W_V1: config y restricciones desde sus tablas reales */
const TH = require('../shared/tablas-hoja');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}

/* cache corto en memoria: 200 personas entrando a la vez no leen 200 veces la base */
let cache = { t: 0, D: null, recientes: null };
const CACHE_MS = 30000;
async function datos() {
  const pool = await getPool();
  /* _CUMPL_W_V1: si cambio la config o una restriccion (guardado en Azure), no esperar los 30 s */
  let marcaW = null;
  try { marcaW = await TH.marcas(pool, ['cumpl_config', 'cumpl_restricc']); } catch (e) {}
  if (cache.D && Date.now() - cache.t < CACHE_MS && cache.marcaW === marcaW) return cache;
  await cumplDb.asegurarTablas(pool); await cvDb.asegurarTablas(pool);
  const r = await pool.request().query('SELECT clave, datos FROM dbo.CUMPL_Datos');
  const D = {};
  r.recordset.forEach(f => { D[f.clave] = JSON.parse(f.datos); });
  if (cumplDb.CLAVES.some(k => D[k] === undefined)) return null;
  let recientes;
  const T = await TC.leerCV(pool);   /* _TABLAS_CV_V2: tablas reales dbo.Casos / dbo.Visitas */
  if (T) { D.visitas = JSON.parse(JSON.stringify(T.visitas)); recientes = JSON.parse(JSON.stringify(T.recientes)); }   /* copia: el motor no toca la memoria compartida */
  else {
    const v = await pool.request().query('SELECT datos FROM dbo.CV_Visitas ORDER BY orden');
    D.visitas = v.recordset.map(x => JSON.parse(x.datos));
    const c = await pool.request().query('SELECT datos FROM dbo.CV_Casos WHERE reciente = 1 ORDER BY orden');
    recientes = c.recordset.map(x => JSON.parse(x.datos)).filter(x => x.nro !== '' && x.nro !== null && x.nro !== undefined);
  }
  if (marcaW) { try { const w = await CUW.paraMotor(pool); if (w) { D.config = w.config; D.restricc = w.restricc; } } catch (e) {} }   /* _CUMPL_W_V1 */
  cache = { t: Date.now(), D, recientes, marcaW };
  return cache;
}

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  if (['cumplPendientes', 'cumplPanel', 'getCumplimiento', 'cumplAusencias'].indexOf(accion) < 0) {   /* _AUSENCIAS_V1: + cumplAusencias */
    context.res = { status: 404, body: { success: false, error: 'Accion desconocida: ' + accion } }; return;
  }
  try {
    const c = await datos();
    if (!c) { context.res = { status: 503, body: { success: false, error: 'Cumplimiento aun no migrado a Azure' } }; return; }
    const b = Object.assign({}, req.body || {});
    const t = token(req);
    if (accion === 'cumplAusencias') {   /* _AUSENCIAS_V1: lista para Gestion Usuarios (solo con login de administrador) */
      const rolT = String((t && t.rol) || '').trim().toLowerCase();
      if (!t || !(String(t.usuario || '').trim().toLowerCase() === 'jtimoteo' || ['administrador', 'coordinador', 'jefa_rl'].indexOf(rolT) >= 0)) { context.res = { status: 403, body: { success: false, error: 'Sin permiso' } }; return; }
      context.res = { status: 200, body: { success: true, hoy: _t.ymd(_t.hoyLima()), ausencias: ausParse(c.D.config && c.D.config.raw && c.D.config.raw.ausencias), fuente: 'azure' } };
      return;
    }
    const m = crearMotor(c.D);
    if (accion === 'cumplPanel' && t && t.rol) b.rol = t.rol;       // el rol del panel sale del login firmado
    let out;
    if (accion === 'cumplPendientes') out = m.cumplPendientes(b);
    else if (accion === 'cumplPanel') out = m.cumplPanel(b);
    else out = m.getCumplimiento(b, c.recientes);
    out.fuente = 'azure';
    context.res = { status: 200, body: out };
  } catch (err) {
    context.log.error('[cumpl] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
