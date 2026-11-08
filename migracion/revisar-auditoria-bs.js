/* revisar-auditoria-bs.js — SOLO LECTURA: estado de la copia de BS_Auditoria en Supabase (diagnóstico 07-nov) */
require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  console.log('tablas:', JSON.stringify(await q(`SELECT table_schema, table_name FROM information_schema.tables WHERE lower(table_name) LIKE '%auditoria%' OR lower(table_name) LIKE '%th_estado%'`)));
  const est = await q(`SELECT clave, encabezado, ancho, marca::text FROM dbo.th_estado WHERE lower(clave) LIKE '%audit%'`).catch(e => 'th_estado: ' + e.message);
  console.log('estado:', JSON.stringify(est));
  for (const t of ['dbo.bs_auditoria', 'dbo."BS_Auditoria"']) {
    try { const n = await q(`SELECT count(*)::int AS n FROM ${t}`); const s = await q(`SELECT * FROM ${t} ORDER BY fila DESC LIMIT 2`); console.log(t, 'filas=', n[0].n, 'muestra=', JSON.stringify(s)); } catch (e) { console.log(t, '->', e.message); }
  }
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
