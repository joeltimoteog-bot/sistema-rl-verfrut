/* ═══════════════════════════════════════════════════════════════════════════
   cv  (_CV_AZURE_V1, 26-set-2026) — REGISTRO DE CASOS y VISITAS DE CAMPO
   leidos desde Azure.   POST /api/cv/getCasos   |   POST /api/cv/getVisitas
   Devuelve EXACTAMENTE lo mismo que getCasos / getVisitas del Apps Script
   (mismos campos y mismos filtros por rol), porque Azure guarda los registros
   tal como los arma el propio Apps Script (ver cv-importar).
   Quien es y su rol salen del token firmado del login cuando existe.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../shared/db');
const { asegurarTablas } = require('../shared/cv-db');
const TC = require('../shared/tablas-cv');   /* _TABLAS_CV_V2: tablas reales dbo.Casos / dbo.Visitas */
const MOTOR = require('../shared/cumpl-motor');   /* _AUSENCIAS_V1 */

/* _AUSENCIAS_V1 (27-set-2026): a quien cubre HOY un usuario (titulares ausentes de los que es reemplazo).
   Asi el reemplazo ve y puede trabajar los casos del titular mientras dure la ausencia. Cache 30 s. */
let ausCache = { t: 0, v: null };
async function cubiertos(pool, usuarioNorm) {
  if (!ausCache.v || Date.now() - ausCache.t > 30000) {
    let raw = {}, usuarios = [];
    try {
      const r = await pool.request().query("SELECT clave, datos FROM dbo.CUMPL_Datos WHERE clave IN ('usuarios', 'config')");
      r.recordset.forEach(f => { const d = JSON.parse(f.datos); if (f.clave === 'usuarios') usuarios = d; else raw = (d && d.raw) || {}; });
      const TH = require('../shared/tablas-hoja'), T = await TH.leer(pool, 'cumpl_config');   /* la config real manda si ya esta en su tabla */
      if (T) { const CUW = require('../shared/cumpl-guardar'); raw = CUW.configDe(T).raw; }
    } catch (e) {}
    ausCache = { t: Date.now(), v: { raw, usuarios } };
  }
  const { raw, usuarios } = ausCache.v, hoy = MOTOR._t.ymd(MOTOR._t.hoyLima());
  const A = MOTOR.crearAus(raw, usuarios, () => false, () => true);
  const yo = usuarios.filter(x => x.usuario === usuarioNorm)[0];
  return yo ? A.coberturas(yo, hoy).map(a => { const t = A.titular(a); return [t.usuario, String(t.nombre || '').trim().toLowerCase()]; }) : [];
}

const ROLES_ADMIN_CASOS = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'];
/* _CV_PRIVADO_V1 (27-oct-2026): Casos y Visitas son privados. Solo el dueno del sistema ve TODO;
   cualquier otro usuario (supervisor o administrador) ve solo lo suyo (+ a quien cubre por ausencia).
   Quien pregunta sale SIEMPRE del token firmado; el rol/usuario que manda la pantalla ya no cuenta.
   Sin token (llamada interna del Apps Script con clave) se mantiene el comportamiento anterior.
   Para dar vista completa a otra persona: agregar su usuario a esta lista y publicar. */
const VER_TODO_CV = ['jtimoteo'];
const _nomCache = { t: 0, m: {} };
async function nombreDe(pool, usuarioNorm) {
  if (Date.now() - _nomCache.t > 600000) {
    const r = await pool.request().query('SELECT usuario, nombre FROM dbo.usuarios');
    const m = {}; r.recordset.forEach(x => { m[String(x.usuario || '').trim().toLowerCase()] = String(x.nombre || '').trim().toLowerCase(); });
    _nomCache.t = Date.now(); _nomCache.m = m; _nomCache.todos = Object.keys(m).map(k => m[k]).filter(Boolean);
  }
  return _nomCache.m[usuarioNorm] || '';
}
/* decide quien pregunta y si ve todo. Devuelve { todo:true } o { todo:false, quienes:[[usuario, nombre], ...] } */
async function alcance(pool, p, t) {
  if (t && t.usuario) {
    const un = String(t.usuario).trim().toLowerCase();
    if (VER_TODO_CV.indexOf(un) >= 0) return { todo: true };
    let quienes = [[un, await nombreDe(pool, un)]];
    try { quienes = quienes.concat(await cubiertos(pool, un)); } catch (e) {}   /* _AUSENCIAS_V1 */
    return { todo: false, quienes, todos: _nomCache.todos || [] };
  }
  /* sin token: llamada interna (Apps Script) -> como antes, por el rol que envia */
  const rolNorm = String(p.rol || '').trim().toLowerCase();
  if (ROLES_ADMIN_CASOS.indexOf(rolNorm) >= 0 || !p.usuario) return { todo: true };
  const un = String(p.usuario).trim().toLowerCase();
  let quienes = [[un, String(p.nombre || '').trim().toLowerCase()]];
  try { quienes = quienes.concat(await cubiertos(pool, un)); } catch (e) {}
  try { await nombreDe(pool, un); } catch (e) {}
  return { todo: false, quienes, todos: _nomCache.todos || [] };
}
/* comparacion: usuario exacto o nombre completo exacto (sin tildes ni espacios dobles). Si el nombre esta
   incompleto, se acepta SOLO si ese texto corresponde a una unica persona del sistema; si podria ser de dos
   (JAIRO FERNANDEZ SULLON / JAIRO OMAR FERNANDEZ SULLON) no se le muestra a ninguno (solo al dueno). */
function _nrm(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
function esDeAlguno(reg0, sup0, quienes, todos) {
  const sup = _nrm(sup0), reg = _nrm(reg0);
  if (!sup && !reg) return false;
  const supTok = ' ' + sup.replace(/[^a-z0-9]+/g, ' ') + ' ';
  const estricto = quienes.some(q => { const un = _nrm(q[0]), nn = _nrm(q[1]);
    return (un && (reg === un || sup === un || supTok.indexOf(' ' + un + ' ') >= 0))
      || (nn && (reg === nn || sup === nn)); });
  if (estricto) return true;
  if (!sup || !todos || !todos.length) return false;
  const candidatos = todos.filter(n => nombreMatch(sup, n));
  if (candidatos.length !== 1) return false;
  const c = _nrm(candidatos[0]);
  return quienes.some(q => _nrm(q[1]) === c);
}

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}

/* copia fiel de _casoNombreMatch */
function nombreMatch(a, b) {
  const norm = (s) => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim() + ' ';
  const A = norm(a), B = norm(b);
  if (A === '  ' || B === '  ') return false;
  const toks = B.trim().split(' ').filter(t => t.length >= 3);
  if (!toks.length) return false;
  const need = Math.min(2, toks.length);
  let hit = 0;
  for (const t of toks) if (A.indexOf(' ' + t + ' ') !== -1) hit++;
  return hit >= need;
}

async function getCasos(p, t) {
  const pool = await getPool(); await asegurarTablas(pool);
  let data;
  const T = await TC.leerCV(pool);   /* _TABLAS_CV_V2 */
  if (T) data = p.historial ? T.casos : T.recientes;
  else {
    const r = await pool.request().input('h', sql.Bit, p.historial ? 1 : 0)
      .query('SELECT datos FROM dbo.CV_Casos WHERE (@h = 1 OR reciente = 1) ORDER BY orden');
    data = r.recordset.map(x => JSON.parse(x.datos));
    if (!p.historial) data = data.filter(c => c.nro !== '' && c.nro !== null && c.nro !== undefined);
  }
  const A = await alcance(pool, p, t);   /* _CV_PRIVADO_V1 */
  if (!A.todo) data = data.filter(c => esDeAlguno(c.registrado_por, c.supervisor, A.quienes, A.todos));
  if (p.empresa) data = data.filter(c => c.empresa === p.empresa);
  if (p.motivo) data = data.filter(c => c.motivo === p.motivo);
  if (p.supervisor) data = data.filter(c => String(c.supervisor || '').toLowerCase().includes(String(p.supervisor).toLowerCase()) || nombreMatch(c.supervisor, p.supervisor));
  return { success: true, data, fuente: 'azure' };
}

async function getVisitas(p, t) {
  const pool = await getPool(); await asegurarTablas(pool);
  const T = await TC.leerCV(pool);   /* _TABLAS_CV_V2 */
  let data;
  if (T) data = T.visitas;
  else data = (await pool.request().query('SELECT datos FROM dbo.CV_Visitas ORDER BY orden')).recordset.map(x => JSON.parse(x.datos));
  const A = await alcance(pool, p, t);   /* _CV_PRIVADO_V1: antes Visitas devolvia TODO a cualquiera */
  if (!A.todo) data = data.filter(v => esDeAlguno(v.registrado_por, v.supervisor, A.quienes, A.todos));
  if (p.empresa && p.empresa !== 'AMBAS') data = data.filter(v => v.empresa === p.empresa);
  if (p.mes) data = data.filter(v => v.fecha_reg && new Date(v.fecha_reg).getMonth() + 1 == p.mes);
  if (p.supervisor) {
    const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const b = n(p.supervisor);
    data = data.filter(v => n(v.supervisor).indexOf(b) !== -1);
  }
  return { success: true, data, fuente: 'azure' };
}

module.exports = async function (context, req) {
  /* _LECTURAS_SESION_V1 (18-oct-2026): con LECTURAS_CON_SESION=1 las lecturas exigen sesion (o clave interna del Apps Script) */
  if (require('../shared/auth').exigirSesionLectura(context, req) === null) return;
  const accion = context.bindingData && context.bindingData.accion;
  const fn = { getCasos, getVisitas }[accion];
  if (!fn) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida: ' + accion } }; return; }
  try {
    /* sin datos cargados todavia -> 503 para que la pantalla use la hoja */
    const pool = await getPool(); await asegurarTablas(pool);
    const e = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'ultima_carga'");
    if (!e.recordset.length && !(await TC.leerCV(pool))) { context.res = { status: 503, body: { success: false, error: 'Casos/visitas aun no migrados a Azure' } }; return; }
    context.res = { status: 200, body: await fn(req.body || {}, token(req)) };
  } catch (err) {
    context.log.error('[cv] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
