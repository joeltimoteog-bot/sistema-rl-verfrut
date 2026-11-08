/* revisar-sintoken.js — SOLO LECTURA (08-nov-2026). Muestra qué rutas de la API reciben llamadas SIN token
   (tabla Auth_SinToken) en los últimos 14 días, para activar el modo estricto sin romper nada.
   Uso: cd C:\sistema-rl-verfrut\migracion ; node revisar-sintoken.js */
require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const t = (await c.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE lower(table_name) LIKE '%sintoken%'`)).rows;
  if (!t.length) { console.log('No existe la tabla Auth_SinToken en Supabase (nunca se anotó una llamada sin token).'); await c.end(); return; }
  const T = '"' + t[0].table_schema + '"."' + t[0].table_name + '"';
  const r = await c.query(`SELECT ruta, motivo, SUM(n)::int AS llamadas, MAX(dia)::text AS ultimo_dia, COUNT(DISTINCT origen)::int AS origenes
                           FROM ${T} WHERE dia >= CURRENT_DATE - 14 GROUP BY ruta, motivo ORDER BY llamadas DESC LIMIT 40`);
  console.log('Llamadas sin token / token inválido, últimos 14 días (' + T + '):'); console.table(r.rows);
  const o = await c.query(`SELECT ruta, origen, SUM(n)::int AS llamadas FROM ${T} WHERE dia >= CURRENT_DATE - 14 GROUP BY ruta, origen ORDER BY llamadas DESC LIMIT 25`);
  console.log('Por página de origen:'); console.table(o.rows);
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
