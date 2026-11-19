/* ═══════════════════════════════════════════════════════════════════════════
   calc-param (_CALC_SUPABASE_V1, 19-nov-2026) — Parametros oficiales del Calculo Remunerativo
   GET/POST /api/calc/leer     -> { success, params, version, fecha, por }   (cualquier sesion del RR.LL.)
   POST     /api/calc/guardar  { params }  -> { success, version }          (solo jtimoteo, administrador)
   Antes: Apps Script calcParamsLeer / guardarCalcParams sobre la hoja CALCULO_PARAMETROS. Mismas
   respuestas y mismas validaciones. Tabla rl.calc_parametros (migracion/calc-parametros.sql).
   Quien es y su rol salen del TOKEN FIRMADO, no de lo que mande la pantalla.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql, getPool } = require('../shared/db');
const DUENOS = ['jtimoteo'];   /* _CALC_DUENO_V1: solo el administrador del sistema publica los oficiales */
let cache = null, cacheHasta = 0;

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return require('../shared/auth.js').verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
function fechaLima(d) {
  const x = new Date(new Date(d).getTime() - 5 * 3600e3), z = (n) => String(n).padStart(2, '0');
  return z(x.getUTCDate()) + '/' + z(x.getUTCMonth() + 1) + '/' + x.getUTCFullYear() + ' ' + z(x.getUTCHours()) + ':' + z(x.getUTCMinutes());
}
function versionAhora() {
  const x = new Date(Date.now() - 5 * 3600e3), z = (n) => String(n).padStart(2, '0');
  return 'v' + x.getUTCFullYear() + z(x.getUTCMonth() + 1) + z(x.getUTCDate()) + '-' + z(x.getUTCHours()) + z(x.getUTCMinutes()) + z(x.getUTCSeconds());
}

async function leer(pool) {
  if (cache && Date.now() < cacheHasta) return cache;
  const r = await pool.request().query('SELECT TOP 1 version, fecha, publicado_por, parametros_json FROM dbo.calc_parametros ORDER BY fecha DESC, version DESC');
  const f = r.recordset[0];
  let res = { success: true, params: null };
  if (f) {
    try { res = { success: true, params: JSON.parse(String(f.parametros_json || 'null')), version: String(f.version), fecha: fechaLima(f.fecha), por: String(f.publicado_por || '') }; }
    catch (e) { res = { success: true, params: null }; }
  }
  cache = res; cacheHasta = Date.now() + 60000;
  return res;
}

async function guardar(pool, b, t) {
  const usuario = String(t.usuario || '').trim().toLowerCase(), rol = String(t.rol || '').toLowerCase().trim();
  if (!/admin/.test(rol) || DUENOS.indexOf(usuario) < 0) return { success: false, error: 'Solo el administrador del sistema puede publicar los parámetros oficiales.' };
  const p = b && b.params;
  if (!p || typeof p !== 'object') return { success: false, error: 'Parámetros vacíos.' };
  const num = (x, min, max) => { const n = Number(x); return isFinite(n) && n >= min && n <= max; };
  if (!num(p.remBruta, 100, 100000) || !num(p.rmv, 100, 100000) || !num(p.factorBruta, 1, 2) ||
      !num(p.pctCTS, 0, 1) || !num(p.pctGratif, 0, 1) || !num(p.pctAF, 0, 1) || !num(p.pctBETA, 0, 1) ||
      !Array.isArray(p.afps) || !Array.isArray(p.feriados)) {
    return { success: false, error: 'Algún parámetro está fuera de rango o vacío. Revisa los valores.' };
  }
  const json = JSON.stringify(p);
  if (json.length > 40000) return { success: false, error: 'Parámetros demasiado grandes.' };
  const version = versionAhora();
  await pool.request()
    .input('v', sql.NVarChar(40), version).input('u', sql.NVarChar(60), usuario)
    .input('rmv', sql.Float, Number(p.rmv)).input('rb', sql.Float, Number(p.remBruta))
    .input('b', sql.NVarChar(20), String(p.baseBetaAF || 'rmv')).input('j', sql.NVarChar(sql.MAX), json)
    .query('INSERT INTO dbo.calc_parametros (version, publicado_por, rmv, rem_bruta, base_beta_af, parametros_json) VALUES (@v, @u, @rmv, @rb, @b, @j)');
  cache = null;
  return { success: true, version };
}

module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  try {
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const pool = await getPool();
    if (accion === 'leer') { context.res = { status: 200, body: await leer(pool) }; return; }
    if (accion === 'guardar' && String(req.method || '').toUpperCase() === 'POST') { context.res = { status: 200, body: await guardar(pool, req.body || {}, t) }; return; }
    context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } };
  } catch (err) {
    context.log.error('[calc-param] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: 'No se pudo ' + (accion === 'guardar' ? 'publicar' : 'leer') + ' los parametros: ' + err.message } };
  }
};
