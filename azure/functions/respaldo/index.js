/* ═══════════════════════════════════════════════════════════════════════════
   respaldo (_RESPALDO_V1, 05-nov-2026) — Exportar la base para el respaldo semanal en Google Drive.
   Solo lectura. Requiere la llave de funcion. Lo usa Apps Script (respaldo-semanal.js).
     POST /api/respaldo/tablas { esquema? }           -> [{ tabla, filas }]  (esquema rl, sin _resp_*)
   _RESPALDO_ETI_V1 (21-nov-2026): tambien el esquema "eti" (Evaluaciones y Capacitaciones ETI), que no entraba en la copia a Drive.
     Sus tablas se nombran "eti.<tabla>". Con { esquema: 'eti' } se listan solo esas (copia de cada noche).
     POST /api/respaldo/leer { tabla, desde, cantidad } -> { filas: [...], siguiente, fin }
   El orden es por ctid (orden fisico): estable mientras dura la lectura de la tabla.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { getPool, sql } = require('../shared/db');

async function tablas(pool, esquema) {
  const r = await pool.request().query(`SELECT CASE WHEN n.nspname = 'eti' THEN 'eti.' || c.relname ELSE c.relname END AS tabla, GREATEST(c.reltuples, 0)::bigint AS filas
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE (n.nspname = current_schema() OR n.nspname = 'eti') AND c.relkind = 'r' AND c.relname NOT LIKE '\\_resp\\_%' AND c.relname NOT LIKE '%\\_stage'
     ORDER BY (n.nspname = 'eti'), c.relname`);
  const todas = r.recordset;
  if (esquema === 'eti') return todas.filter(x => String(x.tabla).indexOf('eti.') === 0);   /* _RESPALDO_ETI_V1 */
  return todas;
}

async function leer(pool, b) {
  const t = String(b.tabla || '');
  if (!/^(eti\.)?[a-z0-9_]+$/.test(t)) throw new Error('Tabla invalida');
  const lista = (await tablas(pool)).map(x => x.tabla);
  if (lista.indexOf(t) < 0) throw new Error('Tabla desconocida: ' + t);
  const desde = Math.max(0, parseInt(b.desde, 10) || 0), cant = Math.max(1, Math.min(5000, parseInt(b.cantidad, 10) || 2000));
  const r = await pool.request().input('d', sql.Int, desde).input('c', sql.Int, cant + 1)
    .query(`SELECT * FROM ${t.indexOf('eti.') === 0 ? '"eti"."' + t.slice(4) + '"' : '"' + t + '"'} ORDER BY ctid OFFSET @d LIMIT @c`);   /* _RESPALDO_ETI_V1 */
  const filas = r.recordset.slice(0, cant);
  return { success: true, tabla: t, desde, filas, siguiente: desde + filas.length, fin: r.recordset.length <= cant };
}

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  try {
    const pool = await getPool(), b = (req.body && typeof req.body === 'object') ? req.body : {};
    let r;
    if (accion === 'tablas') r = { success: true, tablas: await tablas(pool, b.esquema === 'eti' ? 'eti' : '') };
    else if (accion === 'leer') r = await leer(pool, b);
    else { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    context.res = { status: 200, body: r };
  } catch (e) {
    context.log.error('[respaldo] ' + accion + ': ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
