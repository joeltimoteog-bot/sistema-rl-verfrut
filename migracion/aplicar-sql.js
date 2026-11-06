/* aplicar-sql.js — aplica un archivo .sql de esta carpeta en Supabase (usa SUPABASE_DB_URL de migracion\.env).
   Uso:  cd C:\sistema-rl-verfrut\migracion ; node aplicar-sql.js kpi-fix-v2.sql */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const arch = process.argv[2]; if (!arch || !/^[\w.-]+\.sql$/.test(arch)) { console.error('Indica el archivo .sql de esta carpeta'); process.exit(1); }
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  await c.query(fs.readFileSync(path.join(__dirname, arch), 'utf8'));
  const t = await c.query(`SELECT event_object_table AS t, trigger_name AS n FROM information_schema.triggers WHERE trigger_schema = 'rl' AND trigger_name LIKE 'tr_kpi_%' GROUP BY 1, 2 ORDER BY 1`);
  console.log('OK ' + arch + ' -> ' + t.rows.map(r => r.t + ':' + r.n).join(', '));
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
