/* ═══════════════════════════════════════════════════════════════════════════
   shared/modulos-guard.js — _MODULOS_GUARD_V1 (21-nov-2026, decision de Joel)
   Control central: el SERVIDOR comprueba que el usuario tenga asignado en "Acceso a Modulos" el modulo de la ruta que llama
   (hasta ahora, salvo Bienestar, eso solo lo hacia el menu de la pantalla).
   Modo (secreto MODULOS_GUARD en Supabase):
     · log (por defecto): NO bloquea a nadie; solo anota en rl.acceso_registro lo que se habria bloqueado.
     · on : responde 403 "modulo no asignado".
     · off: apagado.
   Reglas: jtimoteo nunca se revisa · usuario sin permisos definidos (sin filas) no se revisa · modulo sin fila = no se revisa
   · si algo falla al revisar, se deja pasar (nunca tumba una llamada) · rutas que no estan en el mapa no se revisan.
   Ver el registro:  SELECT * FROM rl.acceso_registro ORDER BY ultimo DESC;
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');
const DUENOS = ['jtimoteo'];
const TTL = 60000, CADA_REG = 600000;
const _perm = {};      // usuario -> { t, m: { modulo: bool } | null }
const _anotado = {};   // clave -> t

/* ruta (carpeta de la funcion) -> modulo de "Acceso a Modulos". Funcion = depende de la accion / del modulo de la URL. */
const POR_MOD = { horas: 'navHoras', cap: 'mod_capacitaciones', fus: 'navFusiones', mant: 'navMantenimiento', sol: 'navSolicitudes' };
const MAPA = {
  'cv': b => /isita/i.test(String(b.accion || '')) ? 'navVisitas' : (/aso/i.test(String(b.accion || '')) ? 'navCasos' : null),
  'cv-guardar': b => /isita/i.test(String(b.accion || '')) ? 'navVisitas' : (/aso/i.test(String(b.accion || '')) ? 'navCasos' : null),
  'mod': b => POR_MOD[String(b.modulo || '')] || null,
  'fus-guardar': 'navFusiones', 'sol-guardar': 'navSolicitudes', 'mant-guardar': 'navMantenimiento', 'mant-resp': 'navMantenimiento',
  'horas-guardar': 'navHoras', 'alm-guardar': 'navAlmuerzos', 'inv-guardar': 'navInventario', 'preav-guardar': 'navPreaviso',
  'cap-guardar': 'mod_capacitaciones', 'cap-firmas': 'mod_capacitaciones', 'kpi': 'navKpis', 'informe-gh': 'navInformeGH',
  'padron': 'navPadron', 'cumpl-guardar': 'navCumpl'
};
function modo() { const m = String(process.env.MODULOS_GUARD || 'log').toLowerCase(); return m === 'on' || m === 'off' ? m : 'log'; }
function usuarioDe(req) {
  try {
    const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
    const m = h.match(/^Bearer\s+(.+)$/i); if (!m || !process.env.JWT_SECRET) return '';
    const t = jwt.verify(m[1], process.env.JWT_SECRET);
    return String((t && t.usuario) || '').trim().toLowerCase();
  } catch (e) { return ''; }
}
async function permisosDe(pool, u) {
  const c = _perm[u];
  if (c && Date.now() - c.t < TTL) return c.m;
  const r = await pool.request().input('u', u).query('SELECT modulo, permitido FROM dbo.permisosmodulos WHERE LOWER(LTRIM(RTRIM(usuario))) = @u');
  let m = null;
  if (r.recordset && r.recordset.length) { m = {}; r.recordset.forEach(x => { const v = x.permitido; m[String(x.modulo || '').trim()] = v === true || v === 1 || String(v).trim() === '1' || String(v).trim().toLowerCase() === 'true'; }); }
  _perm[u] = { t: Date.now(), m };
  return m;
}
async function anotar(pool, u, fn, accion, mod) {
  const dia = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  const k = [dia, u, fn, accion, mod].join('|');
  if (_anotado[k] && Date.now() - _anotado[k] < CADA_REG) return;
  _anotado[k] = Date.now();
  const rq = () => pool.request().input('d', dia).input('u', u).input('f', fn).input('a', accion).input('m', mod);
  const up = await rq().query('UPDATE dbo.acceso_registro SET n = n + 1, ultimo = SYSUTCDATETIME() WHERE dia = @d AND usuario = @u AND fn = @f AND accion = @a AND modulo = @m');
  if (!up.rowsAffected || !up.rowsAffected[0]) await rq().query('INSERT INTO dbo.acceso_registro (dia, usuario, fn, accion, modulo, n, ultimo) VALUES (@d, @u, @f, @a, @m, 1, SYSUTCDATETIME())');
}
/* Devuelve null (pasa) o { bloquear: true, modulo } (solo en modo on). Nunca lanza. */
async function revisar(fn, req, binding) {
  try {
    const md = modo(); if (md === 'off') return null;
    const regla = MAPA[fn]; if (!regla) return null;
    const mod = typeof regla === 'function' ? regla(binding || {}) : regla; if (!mod) return null;
    const u = usuarioDe(req); if (!u || DUENOS.indexOf(u) >= 0) return null;
    const pool = await getPool();
    const P = await permisosDe(pool, u); if (!P || P[mod] !== false) return null;
    try { await anotar(pool, u, fn, String((binding && (binding.accion || binding.modulo)) || '').slice(0, 60), mod); } catch (e) {}
    return md === 'on' ? { bloquear: true, modulo: mod } : null;
  } catch (e) { return null; }
}
module.exports = { revisar, MAPA, modo, _reset: () => { Object.keys(_perm).forEach(k => delete _perm[k]); Object.keys(_anotado).forEach(k => delete _anotado[k]); } };
