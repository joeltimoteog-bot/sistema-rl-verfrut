/* verificar-destino.js — _VERIFICAR_DESTINO_V1 (05-nov-2026)
   ¿Donde se esta guardando lo que registra el personal: Supabase o Azure SQL?
   Compara TABLA POR TABLA (solo lectura): cantidad de filas y el registro mas reciente en cada base.
   - Si Supabase tiene MAS filas o registros mas nuevos que Azure  -> lo nuevo entra a Supabase (correcto).
   - Si Azure tiene MAS filas o registros mas nuevos que Supabase  -> algo se esta guardando en Azure (revisar).
   Uso (en C:\sistema-rl-verfrut\migracion):   node verificar-destino.js
   No escribe nada en ninguna base y no muestra claves. */
'use strict';
const fs = require('fs'), path = require('path');
const { Client } = require('pg'); const sql = require('mssql');
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const m = env.match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m); if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const ls = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'azure', 'functions', 'local.settings.json'), 'utf8').replace(/^\uFEFF/, '')).Values || {};
const PREF = /(creado|creacion|registro|fecha_hora|created|actualizado|updated|fecha)/i;
const f = (d) => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '—';

(async () => {
  const pg = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await pg.connect();
  const az = await sql.connect({ server: ls.SQL_SERVER, database: ls.SQL_DATABASE, user: ls.SQL_USER, password: ls.SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 60000, requestTimeout: 120000 });
  const tablas = (await pg.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='rl' AND table_type='BASE TABLE' ORDER BY 1`)).rows.map(r => r.table_name);
  const cols = (await pg.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='rl' AND data_type IN ('timestamp without time zone','timestamp with time zone','date')`)).rows;
  const azTablas = new Set((await az.request().query(`SELECT name FROM sys.tables`)).recordset.map(r => r.name.toLowerCase()));
  const res = [];
  for (const t of tablas) {
    if (!azTablas.has(t.toLowerCase())) continue;
    const c = cols.filter(x => x.table_name === t).map(x => x.column_name).sort((a, b) => (PREF.test(b) ? 1 : 0) - (PREF.test(a) ? 1 : 0))[0];
    try {
      const s = (await pg.query(`SELECT COUNT(*)::int n${c ? `, MAX("${c}") ult` : ''} FROM rl."${t}"`)).rows[0];
      const a = (await az.request().query(`SELECT COUNT(*) n${c ? `, MAX([${c}]) ult` : ''} FROM dbo.[${t}]`)).recordset[0];
      res.push({ t, c, sn: s.n, an: a.n, su: s.ult, au: a.ult });
    } catch (e) { res.push({ t, err: e.message.slice(0, 80) }); }
  }
  const nuevosSB = res.filter(r => !r.err && (r.sn > r.an || (r.su && r.au && new Date(r.su) > new Date(r.au))));
  const nuevosAZ = res.filter(r => !r.err && (r.an > r.sn || (r.su && r.au && new Date(r.au) > new Date(r.su))));
  console.log('\n=== Tablas con registros NUEVOS solo en SUPABASE (lo correcto) ===');
  nuevosSB.forEach(r => console.log(`  ${r.t.padEnd(34)} Supabase ${String(r.sn).padStart(7)} | Azure ${String(r.an).padStart(7)} | ultimo SB ${f(r.su)} | ultimo AZ ${f(r.au)}`));
  console.log('\n=== Tablas donde AZURE tiene algo que Supabase no (REVISAR) ===');
  if (!nuevosAZ.length) console.log('  ninguna ✅');
  nuevosAZ.forEach(r => console.log(`  ${r.t.padEnd(34)} Supabase ${String(r.sn).padStart(7)} | Azure ${String(r.an).padStart(7)} | ultimo SB ${f(r.su)} | ultimo AZ ${f(r.au)}`));
  const err = res.filter(r => r.err); if (err.length) { console.log('\n(no comparadas: ' + err.map(r => r.t).join(', ') + ')'); }
  console.log('\nTablas comparadas: ' + res.length + ' · iguales: ' + (res.length - nuevosSB.length - nuevosAZ.length - err.length));
  await pg.end(); await az.close();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
