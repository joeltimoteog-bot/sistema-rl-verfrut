/* ═══════════════════════════════════════════════════════════════════════════
   e360-guardar (_E360_AZURE_V1, 27-set-2026)
   POST /api/e360/guardar/{saveEvaluacion360|deleteEvaluacion360|getEvaluaciones360}   (con el token del login)
   Guarda DIRECTO en Azure; quien elimina sale del token firmado. Respuesta = la del Apps Script.
   Apagado (CV_Estado e360_azure_primero <> '1') o sin token -> 503/401 y la pantalla usa Google.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');
const CG = require('../shared/cv-guardar');
const H = require('../shared/e360-guardar');
const TH = require('../shared/tablas-hoja');   /* _E360_LEER_AZURE_V1 */

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return require('../shared/auth.js').verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
/* _E360_LEER_AZURE_V1 (01-nov-2026): lectura getEvaluaciones360 desde Azure (misma forma que el Apps Script).
   Columnas de la hoja/tabla: 0 id · 1 fecha · 2 evaluador · 3 supervisor · 4 empresa · 5 sector · 6-11 competencias planas
   · 12 total · 13 porcentaje · 14 clasificacion · 15 obs · 17 evaluadorUser · 18 fechaRegistro · Periodo/Detalle por encabezado */
const S = v => (v && typeof v === 'object' && typeof v.$d === 'string') ? v.$s || v.$d : String(v == null ? '' : v);
function fechaYmd(v) {
  if (v && typeof v === 'object' && typeof v.$d === 'string') { const d = new Date(v.$d); if (!isNaN(d)) { const x = new Date(d.getTime() - 5 * 3600e3); return x.toISOString().slice(0, 10); } }
  const t = String(v == null ? '' : v).trim(); let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  const d = new Date(t); return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}
async function getEvaluaciones360(pool, p) {
  const T = await TH.leer(pool, 'e360_evaluaciones');
  if (!T) return { success: false, error: 'Tabla de evaluaciones aun no cargada' };
  const heads = (T.encabezado || []).map(h => S(h).trim()), iP = heads.indexOf('Periodo'), iD = heads.indexOf('Detalle');
  let data = [];
  (T.filas || []).forEach(r => {
    if (!r || !S(r[0])) return;
    const fecha = fechaYmd(r[1]);
    const periodo = (iP >= 0 && S(r[iP]).trim()) ? S(r[iP]).trim() : fecha.slice(0, 7);
    let comps = [];
    if (iD >= 0 && S(r[iD])) { try { comps = JSON.parse(S(r[iD])); } catch (e) { comps = []; } }
    if (!comps.length) {
      [['Liderazgo', r[6]], ['Comunicación', r[7]], ['Cumplimiento', r[8]], ['Gestión de Equipo', r[9]], ['Resolución de Problemas', r[10]], ['Planificación', r[11]]]
        .forEach(pc => { const v = Number(S(pc[1])) || 0; if (v > 0) comps.push({ nombre: pc[0], promedio: v, respondidas: 0, total: 0, respuestas: [] }); });
    }
    data.push({ id: S(r[0]), fecha, periodo, evaluador: S(r[2]), supervisor: S(r[3]).trim(), empresa: S(r[4]), sector: S(r[5]), competencias: comps,
      total: Number(S(r[12])) || 0, porcentaje: Number(S(r[13])) || 0, clasificacion: S(r[14]), obs: S(r[15]), evaluadorUser: S(r[17]), fechaRegistro: fechaYmd(r[18]) });
  });
  if (p && p.empresa && p.empresa !== 'AMBAS') data = data.filter(e => e.empresa === p.empresa);
  if (p && p.supervisor) { const q = String(p.supervisor).toLowerCase(); data = data.filter(e => e.supervisor.toLowerCase().indexOf(q) !== -1); }
  if (p && p.periodo) data = data.filter(e => e.periodo === String(p.periodo));
  data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  return { success: true, data, fuente: 'azure' };
}

module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    if (accion !== 'getEvaluaciones360' && H.ACCIONES.indexOf(accion) < 0) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const pool = await getPool(); await CG.asegurarTablas(pool);
    if (accion === 'getEvaluaciones360') { context.res = { status: 200, body: await getEvaluaciones360(pool, req.body || {}) }; return; }   /* _E360_LEER_AZURE_V1 */
    if (!(await H.encendido(pool))) { context.res = { status: 503, body: { success: false, apagado: true, error: 'Guardado en Azure apagado' } }; return; }
    const r = await H.ejecutar(pool, accion, req.body || {}, String(t.usuario), false);
    context.res = { status: r.status, body: r.body };
  } catch (err) {
    context.log.error('[e360-guardar] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
