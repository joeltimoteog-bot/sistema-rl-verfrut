/* ═══════════════════════════════════════════════════════════════════════════
   padron (_PADRON_EXCEL_V1, 17-nov-2026) — Padron de trabajadores desde el Excel "BB.DD_ SISTEMA WEB.xlsm"
   POST /api/padron/estado   -> cuantos trabajadores hay por empresa y de donde se cargo el padron
   POST /api/padron/cargar   { empresa: 'RAPEL'|'VERFRUT', filas: [...] }   (solo administradores)
   La pantalla lee el Excel en la computadora del administrador y envia una empresa por vez.
   Se usa el MISMO motor de trabajadores-sync (incremental: solo cambia lo distinto; freno si llega menos
   de la mitad; si algo falla, no se toca nada). Tras la primera carga, la subida automatica desde las
   hojas de Google queda en pausa (CV_Estado.padron_fuente = 'excel|fecha|usuario').
   Quien es y su rol salen del TOKEN FIRMADO.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql, getPool } = require('../shared/db');
const EMP = require('../shared/empresas');
const SYNC = require('../trabajadores-sync/index.js');
const ADMIN_ROLES = ['administrador', 'admin', 'administrador 01', 'administrador 02', 'admin01', 'admin02'];
const HABILITADAS = ['RAPEL', 'VERFRUT'];   /* OLMOS se habilita cuando tenga su hoja y su tabla */

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return require('../shared/auth.js').verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
/* _PADRON_SOLO_CREADOR_V1 (25-nov-2026, decision de Joel): solo el creador del sistema actualiza el padron de trabajadores */
function esAdmin(t) { return String(t.usuario || '').toLowerCase() === 'jtimoteo'; }
function sello() {
  const d = new Date(Date.now() - 5 * 3600e3), z = (n) => String(n).padStart(2, '0');
  return z(d.getUTCDate()) + '/' + z(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + z(d.getUTCHours()) + ':' + z(d.getUTCMinutes());
}
async function fuente(pool) {
  try { const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'padron_fuente'"); return String((r.recordset[0] || {}).valor || ''); } catch (e) { return ''; }
}

async function estado(pool) {
  const ex = await EMP.tablasExistentes(pool, sql), empresas = [];
  for (const e of EMP.EMPRESAS) {
    if (!ex.has(e.tabla)) { empresas.push({ empresa: e.codigo, existe: false, total: 0 }); continue; }
    const r = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.${e.tabla}`);
    empresas.push({ empresa: e.codigo, existe: true, total: Number(r.recordset[0].n) || 0, habilitada: HABILITADAS.indexOf(e.codigo) >= 0 });
  }
  return { ok: true, empresas, fuente: await fuente(pool) };
}

async function cargar(pool, b, t, log) {
  const e = EMP.porCodigo(b.empresa);
  if (!e || HABILITADAS.indexOf(e.codigo) < 0) return { status: 200, body: { ok: false, msg: 'Empresa no habilitada para carga: ' + (b.empresa || '(vacia)') } };
  if (!Array.isArray(b.filas) || !b.filas.length) return { status: 200, body: { ok: false, msg: 'No llegaron filas de ' + e.codigo } };
  if (b.filas.length > 60000) return { status: 200, body: { ok: false, msg: 'Demasiadas filas (' + b.filas.length + ')' } };
  const r = await SYNC.syncTabla(pool, e.tabla, b.filas, log);
  EMP.invalidarTablas();
  if (r && !r.abortado) {
    const v = 'excel|' + sello() + '|' + String(t.usuario || '').slice(0, 40);
    await pool.request().input('v', sql.NVarChar(200), v)
      .query(`MERGE dbo.CV_Estado AS x USING (SELECT 'padron_fuente' AS clave) AS s ON x.clave = s.clave
        WHEN MATCHED THEN UPDATE SET valor = @v WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES ('padron_fuente', @v);`);
  }
  return { status: 200, body: { ok: !(r && r.abortado), empresa: e.codigo, resultado: r, msg: r && r.abortado ? r.motivo : '' } };
}

module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { ok: false, msg: 'Sin sesion valida' } }; return; }
    if (!esAdmin(t)) { context.res = { status: 403, body: { ok: false, msg: 'Solo el creador del sistema puede actualizar el padron' } }; return; }
    const pool = await getPool();
    if (accion === 'estado') { context.res = { status: 200, body: await estado(pool) }; return; }
    if (accion === 'cargar') { const r = await cargar(pool, req.body || {}, t, context.log); context.res = { status: r.status, body: r.body }; return; }
    context.res = { status: 404, body: { ok: false, msg: 'Accion desconocida' } };
  } catch (err) {
    const det = (SYNC.detalleError ? SYNC.detalleError(err) : err.message);
    context.log.error('[padron] ' + accion + ': ' + det);
    context.res = { status: 500, body: { ok: false, msg: det, paso: err._paso || null } };
  }
};
