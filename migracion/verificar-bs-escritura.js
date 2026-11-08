/* verificar-bs-escritura.js — solo lectura: dónde están las tablas de Bienestar (deben estar TODAS en rl) y qué search_path usa la conexión.
   Uso: cd C:\sistema-rl-verfrut\migracion ; node verificar-bs-escritura.js   (usa SUPABASE_DB_URL de .env, no la muestra) */
'use strict';
const fs = require('fs'), path = require('path'), { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  const sp = await c.query('show search_path'); console.log('search_path de la conexión:', sp.rows[0].search_path);
  const t = await c.query("select table_schema, table_name from information_schema.tables where table_name in ('bs_auditoria','bs_rendiciones','bs_rendiciones__carga','bs_sugerencias','bs_sugerencias__carga','bs_buzones','bs_buzones__carga','bs_fuente') order by 1,2");
  console.log('tablas encontradas (' + t.rows.length + '/8, todas deben ser rl.):'); t.rows.forEach(r => console.log('   ' + (r.table_schema === 'rl' ? '✓ ' : '✗ ') + r.table_schema + '.' + r.table_name));
  const pub = await c.query("select table_name from information_schema.tables where table_schema='public' and table_name like 'bs\\_%' order by 1"); console.log('tablas bs_* que quedan en public:', pub.rows.map(r => r.table_name).join(', ') || '(ninguna)');
  const tr = await c.query("select trigger_schema, event_object_table, trigger_name from information_schema.triggers where trigger_name like 'bs_auditoria_inmutable%'");
  console.log('triggers:', tr.rows.map(r => r.trigger_schema + '.' + r.event_object_table + ':' + r.trigger_name).join(', ') || '(ninguno)');
  const fn = await c.query("select n.nspname as esquema from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = 'bs_auditoria_inmutable'");
  console.log('función bs_auditoria_inmutable en:', fn.rows.map(r => r.esquema).join(', ') || '(ninguno)');
  for (const r of t.rows) { if (['bs_rendiciones', 'bs_sugerencias', 'bs_buzones', 'bs_fuente'].indexOf(r.table_name) >= 0) { const n = await c.query(`select count(*)::int n from "${r.table_schema}"."${r.table_name}"`); console.log('   ' + r.table_schema + '.' + r.table_name + ': ' + n.rows[0].n + ' filas'); } }
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
