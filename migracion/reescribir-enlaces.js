/* reescribir-enlaces.js — _FASE4_ARCHIVOS_V1 (05-nov-2026)
   Cambia en la base de Supabase las direcciones de Azure Blob por las de Supabase Storage.
     node reescribir-enlaces.js            -> SOLO cuenta (no cambia nada)
     node reescribir-enlaces.js aplicar    -> respalda cada tabla afectada (rl._resp_enl_<tabla>) y reemplaza
   Solo toca los contenedores casos-rl, visitas-campo y documentos de la cuenta sistemarlverfrut. */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^SUPABASE_DB_URL=(.+)$/m);
const RE = 'https://sistemarlverfrut\\.blob\\.core\\.windows\\.net/(casos-rl|visitas-campo|documentos)/([^?"\'\\s<>\\\\]+)(\\?[^"\'\\s<>\\\\]*)?';
const NUEVO = 'https://exdjzbfinppzatjyimxn.supabase.co/storage/v1/object/public/\\1/\\2';
const aplicar = process.argv[2] === 'aplicar';

(async () => {
  const c = new Client({ connectionString: m[1].trim().replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  /* autoprueba del reemplazo */
  const p = await c.query(`SELECT regexp_replace($1, $2, $3, 'g') AS r`, ['{"f":"https://sistemarlverfrut.blob.core.windows.net/visitas-campo/foto_1.jpg?sv=2024&sig=a%2Fb","g":"x"}', RE, NUEVO]);
  if (p.rows[0].r !== '{"f":"https://exdjzbfinppzatjyimxn.supabase.co/storage/v1/object/public/visitas-campo/foto_1.jpg","g":"x"}') { console.error('ALTO: autoprueba fallo: ' + p.rows[0].r); process.exit(1); }
  const cols = (await c.query(`SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'rl' AND table_name NOT LIKE '\\_resp\\_%' AND (data_type IN ('text','character varying') OR udt_name = 'citext')`)).rows;
  const porTabla = {};
  for (const { table_name: t, column_name: k } of cols) {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM rl."${t}" WHERE "${k}" ~ $1`, [RE]);
    if (r.rows[0].n) (porTabla[t] = porTabla[t] || []).push([k, r.rows[0].n]);
  }
  const tablas = Object.keys(porTabla);
  if (!tablas.length) { console.log('No hay direcciones de Azure Blob en la base.'); await c.end(); return; }
  for (const t of tablas) console.log(`${t}: ` + porTabla[t].map(([k, n]) => `${k} (${n} filas)`).join(', '));
  if (!aplicar) { console.log('\nSOLO CONTEO. Para aplicar: node reescribir-enlaces.js aplicar'); await c.end(); return; }
  await c.query('BEGIN');
  try {
    let total = 0;
    for (const t of tablas) {
      const resp = '_resp_enl_' + t;
      await c.query(`DROP TABLE IF EXISTS rl."${resp}"; CREATE TABLE rl."${resp}" AS SELECT * FROM rl."${t}"`);
      for (const [k] of porTabla[t]) {
        const u = await c.query(`UPDATE rl."${t}" SET "${k}" = regexp_replace("${k}", $1, $2, 'g') WHERE "${k}" ~ $1`, [RE, NUEVO]);
        total += u.rowCount;
      }
      console.log(`OK ${t}: respaldo en rl.${resp}`);
    }
    const quedan = [];
    for (const t of tablas) for (const [k] of porTabla[t]) { const r = await c.query(`SELECT COUNT(*)::int AS n FROM rl."${t}" WHERE "${k}" ~ $1`, [RE]); if (r.rows[0].n) quedan.push(`${t}.${k}=${r.rows[0].n}`); }
    if (quedan.length) throw new Error('quedaron direcciones sin cambiar: ' + quedan.join(', '));
    await c.query('COMMIT');
    console.log(`\nLISTO: ${total} filas actualizadas. Respaldos: rl._resp_enl_<tabla>`);
  } catch (e) { await c.query('ROLLBACK'); console.error('ERROR (no se cambio nada): ' + e.message); process.exit(1); }
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
