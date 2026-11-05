/* ═══════════════════════════════════════════════════════════════════════════
   respaldo (_RESPALDO_V1, 05-nov-2026) — Exportar la base para el respaldo semanal en Google Drive.
   Solo lectura. Requiere la llave de funcion. Lo usa Apps Script (respaldo-semanal.js).
     POST /api/respaldo/tablas                       -> [{ tabla, filas }]  (esquema rl, sin _resp_*)
     POST /api/respaldo/leer { tabla, desde, cantidad } -> { filas: [...], siguiente, fin }
   El orden es por ctid (orden fisico): estable mientras dura la lectura de la tabla.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { getPool, sql } = require('../shared/db');

async function tablas(pool) {
  const r = await pool.request().query(`SELECT c.relname AS tabla, GREATEST(c.reltuples, 0)::bigint AS filas
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = current_schema() AND c.relkind = 'r' AND c.relname NOT LIKE '\\_resp\\_%' AND c.relname NOT LIKE '%\\_stage'
     ORDER BY c.relname`);
  return r.recordset;
}

async function leer(pool, b) {
  const t = String(b.tabla || '');
  if (!/^[a-z0-9_]+$/.test(t)) throw new Error('Tabla invalida');
  const lista = (await tablas(pool)).map(x => x.tabla);
  if (lista.indexOf(t) < 0) throw new Error('Tabla desconocida: ' + t);
  const desde = Math.max(0, parseInt(b.desde, 10) || 0), cant = Math.max(1, Math.min(5000, parseInt(b.cantidad, 10) || 2000));
  const r = await pool.request().input('d', sql.Int, desde).input('c', sql.Int, cant + 1)
    .query(`SELECT * FROM "${t}" ORDER BY ctid OFFSET @d LIMIT @c`);
  const filas = r.recordset.slice(0, cant);
  return { success: true, tabla: t, desde, filas, siguiente: desde + filas.length, fin: r.recordset.length <= cant };
}

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  try {
    const pool = await getPool(), b = (req.body && typeof req.body === 'object') ? req.body : {};
    let r;
    if (accion === 'tablas') r = { success: true, tablas: await tablas(pool) };
    else if (accion === 'leer') r = await leer(pool, b);
    else { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    context.res = { status: 200, body: r };
  } catch (e) {
    context.log.error('[respaldo] ' + accion + ': ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
