/* crear-eti.js — _ETI_SUPABASE_V1: crea el esquema eti en Supabase (solo CREA, nunca borra). */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^SUPABASE_DB_URL=(.+)$/m);
(async () => {
  const c = new Client({ connectionString: m[1].trim().replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  await c.query(fs.readFileSync(path.join(__dirname, 'crear-eti.sql'), 'utf8'));
  const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'eti' ORDER BY 1`);
  console.log('OK esquema eti: ' + t.rows.length + ' tablas -> ' + t.rows.map(r => r.table_name).join(', '));
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
