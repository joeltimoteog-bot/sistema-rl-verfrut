/* ═══════════════════════════════════════════════════════════════════════════
   shared/at-bloqueo.js — _AT_BLOQUEO_V1 (12-nov-2026)
   Bloqueo TEMPORAL del Registro de Atenciones (cierre de quincena / de mes) mientras Bienestar
   descarga la base para validar. Lo programa el administrador (tabla rl.at_bloqueos).
   · vigentes()  -> bloqueos activos o por venir (memoria 10 s)
   · activo()    -> el bloqueo que rige AHORA, o null
   · exento(t)   -> administradores, coordinador y jefatura siguen trabajando
   · revisar(t)  -> null si se puede guardar; si no, el cuerpo de la respuesta (HTTP 423)
   REGLA DE ORO: si la tabla no existe o la base falla, NO se bloquea a nadie (se informa en el
   registro del servidor). Un error aqui nunca debe impedir registrar una atencion.
   Apagar todo: secreto AT_BLOQUEO=0.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const env = (k) => (typeof process !== 'undefined' && process.env && process.env[k]) || '';
const ROLES_EXENTOS = ['coordinador', 'jefa_rl', 'jefe_rl'];
let memo = { t: 0, v: [] };

function pool() {
  const db = require('./db');
  if (typeof db.pgDirecto !== 'function') return null;
  return db.pgDirecto();
}
function exento(t) {
  if (!t) return false;
  const u = String(t.usuario || '').toLowerCase().trim(), r = String(t.rol || '').toLowerCase().trim();
  return u === 'jtimoteo' || /^admin/.test(r) || ROLES_EXENTOS.indexOf(r) >= 0;
}
function fila(x) {
  return { id: x.id, motivo: x.motivo, mensaje: x.mensaje, desdeMs: new Date(x.desde).getTime(), hastaMs: new Date(x.hasta).getTime() };
}
/* bloqueos no cancelados que aun no terminan (activos o programados), el mas proximo primero */
async function vigentes(forzar) {
  if (env('AT_BLOQUEO') === '0') return [];
  if (!forzar && Date.now() - memo.t < 10000) return memo.v;
  try {
    const p = pool(); if (!p) return [];
    const r = await p.query(`SELECT id, motivo, mensaje, desde, hasta FROM rl.at_bloqueos
                             WHERE cancelado = false AND hasta > now() ORDER BY desde LIMIT 20`);
    memo = { t: Date.now(), v: r.rows.map(fila) };
  } catch (e) {
    memo = { t: Date.now(), v: [] };   /* sin tabla o sin base: nadie queda bloqueado */
    try { console.warn('[_AT_BLOQUEO_V1] no se pudo leer rl.at_bloqueos (no se bloquea a nadie): ' + e.message); } catch (x) {}
  }
  return memo.v;
}
async function activo() {
  const ah = Date.now();
  return (await vigentes()).filter((b) => b.desdeMs <= ah && ah < b.hastaMs)[0] || null;
}
const hhmm = (ms) => { const d = new Date(ms - 5 * 3600000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
async function revisar(t) {
  try {
    if (exento(t)) return null;
    const b = await activo();
    if (!b) return null;
    return { success: false, bloqueado: true, motivo: b.motivo, hastaMs: b.hastaMs, abre: hhmm(b.hastaMs), error: String(b.mensaje || '').replace(/\s+$/, '') + ' Se abre a las ' + hhmm(b.hastaMs) + '.' };
  } catch (e) { return null; }
}
function olvidar() { memo = { t: 0, v: [] }; }
module.exports = { vigentes, activo, exento, revisar, olvidar, hhmm, pool };
