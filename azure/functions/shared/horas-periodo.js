/* ═══════════════════════════════════════════════════════════════════════════
   _HORAS_PERIODO_V1 (17-nov-2026) — ACUMULACION DE HORAS: el saldo cuenta desde el INGRESO ACTUAL
   ---------------------------------------------------------------------------
   Problema: quien volvio a ingresar (reingreso) arrastraba las horas y la deuda de su periodo anterior.
   Regla (decidida por Joel, 17-nov): se toma la fecha de ingreso del padron de trabajadores (fecha_inicio,
   la mas reciente si esta en varias empresas). Los registros con fecha ANTERIOR a esa fecha no suman al
   saldo (siguen visibles, marcados "Periodo anterior"). Excepcion: si el ultimo registro anterior esta a
   menos de 30 dias del ingreso, es una RENOVACION de contrato, no un reingreso: no se corta nada.
   Sin fecha de ingreso en el padron -> no se corta nada (como antes).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const DIAS_RENOVACION = 30;
const DIA = 86400000;

function normDni(x) {
  const v = (x && typeof x === 'object' && typeof x.$s === 'string') ? x.$s : x;
  let s = String(v == null ? '' : v).replace(/\D/g, ''); if (!s) return '';
  while (s.length < 8) s = '0' + s; return s;
}
/* dia (Lima) 'AAAA-MM-DD' de una celda/valor de fecha; '' si no se puede */
function dia(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'object' && !(v instanceof Date)) {
    if (typeof v.$d === 'string' && v.$d) return dia(new Date(v.$d));
    return '';
  }
  if (v instanceof Date) { const t = v.getTime(); if (isNaN(t)) return ''; return new Date(t - 5 * 3600e3).toISOString().slice(0, 10); }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(T(\d{2}):(\d{2}))?/);
  if (m) { if (!m[4]) return m[1] + '-' + m[2] + '-' + m[3]; return dia(new Date(s)); }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

/* fecha de ingreso por DNI desde el padron (memoria 10 min). Nunca lanza: si falla, {} (sin cortes) */
let _cache = { t: 0, v: null };
async function ingresos(pool, sql) {
  if (_cache.v && Date.now() - _cache.t < 600000) return _cache.v;
  const out = {};
  try {
    const EMP = require('./empresas');
    const tablas = Array.from(await EMP.tablasExistentes(pool, sql));
    for (const t of tablas) {
      const r = await pool.request().query(`SELECT dni, fecha_inicio FROM dbo.${t} WHERE fecha_inicio IS NOT NULL`);
      (r.recordset || []).forEach(x => {
        const d = normDni(x.dni);
        /* el padron guarda una fecha (date): llega como medianoche UTC -> se toma el dia tal cual */
        const f = x.fecha_inicio instanceof Date ? x.fecha_inicio.toISOString().slice(0, 10) : dia(x.fecha_inicio);
        if (d && f && (!out[d] || f > out[d])) out[d] = f;
      });
    }
    _cache = { t: Date.now(), v: out };
  } catch (e) { return _cache.v || {}; }
  return out;
}

/* corte por DNI: { dni: 'AAAA-MM-DD' } solo para quien de verdad tiene registros de un periodo anterior */
function cortes(ing, registros, dniDe, fechaDe) {
  const ultimoViejo = {};
  (registros || []).forEach(r => {
    const d = dniDe(r), fi = ing && ing[d]; if (!fi) return;
    const f = fechaDe(r); if (!f || f >= fi) return;
    if (!ultimoViejo[d] || f > ultimoViejo[d]) ultimoViejo[d] = f;
  });
  const out = {};
  Object.keys(ultimoViejo).forEach(d => {
    const fi = ing[d], uv = ultimoViejo[d];
    const pausa = (Date.parse(fi + 'T00:00:00Z') - Date.parse(uv + 'T00:00:00Z')) / DIA;
    if (pausa >= DIAS_RENOVACION) out[d] = fi;   /* reingreso real; si la pausa es corta es renovacion: no se corta */
  });
  return out;
}

module.exports = { ingresos, cortes, dia, normDni, DIAS_RENOVACION };
