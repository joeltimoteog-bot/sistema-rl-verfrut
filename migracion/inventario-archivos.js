/* inventario-archivos.js — _FASE4_V1 (05-nov-2026): SOLO LEE. Cuenta, por tabla y columna de Supabase,
   cuantas filas guardan direcciones de Azure Blob (blob.core.windows.net). No muestra datos ni claves. */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^SUPABASE_DB_URL=(.+)$/m);
(async () => {
  const c = new Client({ connectionString: m[1].trim().replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  const cols = (await c.query(`SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'rl' AND (data_type IN ('text','character varying') OR udt_name = 'citext')`)).rows;
  let total = 0; const out = [];
  for (const { table_name: t, column_name: k } of cols) {
    const r = await c.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM((length("${k}") - length(replace("${k}", 'blob.core.windows.net', ''))) / 21), 0)::int AS refs
                             FROM rl."${t}" WHERE "${k}" LIKE '%blob.core.windows.net%'`);
    if (r.rows[0].n) { out.push(`${t}.${k}: ${r.rows[0].n} filas, ${r.rows[0].refs} direcciones`); total += r.rows[0].refs; }
  }
  console.log(out.length ? out.join('\n') : '(ninguna columna con direcciones de Azure Blob)');
  console.log('TOTAL direcciones de Azure Blob en Supabase: ' + total);
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
