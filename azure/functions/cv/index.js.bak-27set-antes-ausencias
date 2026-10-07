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

const ROLES_ADMIN_CASOS = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'];

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
  const rolNorm = String((t && t.rol) || p.rol || '').trim().toLowerCase();
  const esAdmin = ROLES_ADMIN_CASOS.indexOf(rolNorm) >= 0;
  if (!esAdmin) {
    const usuarioNorm = String((t && t.usuario) || p.usuario || '').trim().toLowerCase();
    const nombreNorm = String(p.nombre || '').trim().toLowerCase();
    data = data.filter(c => {
      const sup = String(c.supervisor || '').trim().toLowerCase();
      const reg = String(c.registrado_por || '').trim().toLowerCase();
      if (!sup && !reg) return false;
      return reg === usuarioNorm || reg === nombreNorm || sup === usuarioNorm || sup === nombreNorm
        || (sup && usuarioNorm && sup.indexOf(usuarioNorm) >= 0)
        || (sup && nombreNorm && sup.indexOf(nombreNorm) >= 0)
        || nombreMatch(sup, nombreNorm);
    });
  }
  if (p.empresa) data = data.filter(c => c.empresa === p.empresa);
  if (p.motivo) data = data.filter(c => c.motivo === p.motivo);
  if (p.supervisor) data = data.filter(c => String(c.supervisor || '').toLowerCase().includes(String(p.supervisor).toLowerCase()) || nombreMatch(c.supervisor, p.supervisor));
  return { success: true, data, fuente: 'azure' };
}

async function getVisitas(p) {
  const pool = await getPool(); await asegurarTablas(pool);
  const T = await TC.leerCV(pool);   /* _TABLAS_CV_V2 */
  let data;
  if (T) data = T.visitas;
  else data = (await pool.request().query('SELECT datos FROM dbo.CV_Visitas ORDER BY orden')).recordset.map(x => JSON.parse(x.datos));
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
