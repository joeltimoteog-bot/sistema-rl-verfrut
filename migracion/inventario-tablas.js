/* inventario-tablas.js — _INVENTARIO_TABLAS_V1 (10-nov-2026): SOLO LECTURA. Lista todas las tablas de Supabase
   (esquemas rl y eti), cuantas filas y columnas tiene cada una, y marca las que estan "amontonadas"
   (la informacion va dentro de una sola columna JSON en vez de columnas propias).
   Usa SUPABASE_DB_URL de migracion\.env (no se muestra).  Uso:  cd C:\sistema-rl-verfrut\migracion ; node inventario-tablas.js */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  await c.query('SET default_transaction_read_only = on');
  const cols = await c.query(`SELECT table_schema AS s, table_name AS t, column_name AS c, data_type AS d
    FROM information_schema.columns WHERE table_schema IN ('rl','eti') ORDER BY 1,2,ordinal_position`);
  const tipo = await c.query(`SELECT table_schema AS s, table_name AS t FROM information_schema.tables WHERE table_schema IN ('rl','eti') AND table_type = 'BASE TABLE'`);
  const base = new Set(tipo.rows.map(r => r.s + '.' + r.t));
  const T = {};
  for (const r of cols.rows) { const k = r.s + '.' + r.t; if (!base.has(k)) continue; (T[k] = T[k] || []).push(r); }
  const filas = [];
  for (const k of Object.keys(T)) {
    const [s, t] = k.split('.'); let n = null;
    try { n = (await c.query('SELECT COUNT(*)::int AS n FROM "' + s + '"."' + t + '"')).rows[0].n; } catch (e) { n = 'error'; }
    const cs = T[k], json = cs.filter(x => /json/.test(x.d)).map(x => x.c), propias = cs.length - json.length;
    /* amontonada: casi todo el contenido vive en una columna JSON (pocas columnas propias: id, fechas) */
    const amont = json.length > 0 && propias <= 4;
    filas.push({ k, n, cols: cs.length, json, amont });
  }
  const pinta = (tit, lista) => { console.log('\n== ' + tit + ' (' + lista.length + ') =='); for (const f of lista) console.log('  ' + f.k.padEnd(40) + String(f.n).padStart(8) + ' filas  ' + String(f.cols).padStart(3) + ' columnas' + (f.json.length ? '  [JSON: ' + f.json.join(', ') + ']' : '')); };
  pinta('TABLAS CON COLUMNAS PROPIAS', filas.filter(f => !f.amont));
  pinta('TABLAS AMONTONADAS (contenido dentro de una columna JSON)', filas.filter(f => f.amont));
  console.log('\nTOTAL: ' + filas.length + ' tablas · con columnas propias: ' + filas.filter(f => !f.amont).length + ' · amontonadas: ' + filas.filter(f => f.amont).length);
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
