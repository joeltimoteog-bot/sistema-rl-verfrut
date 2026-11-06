/* programar-eti-sync.js — _ETI_SYNC_V1 (05-nov-2026)
   Programa en Supabase (pg_cron + pg_net) la copia Firestore -> Supabase de Capacitaciones ETI
   cada 10 minutos (ruta api/eti-sync). Usa la MISMA llave que ya tiene la tarea rl-kpi-reloj
   (se toma de esa tarea; no se escribe ni se muestra en ningun lado).
   Uso: node programar-eti-sync.js           -> programa / actualiza y ejecuta una copia ahora
        node programar-eti-sync.js estado    -> ultimas ejecuciones y respuestas */
'use strict';
const fs = require('fs'), path = require('path');
const { Client } = require('pg');
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const m = env.match(/^SUPABASE_DB_URL=(.+)$/m);
if (!m) { console.error('Falta migracion\\.env con SUPABASE_DB_URL'); process.exit(1); }
const URL_RELOJ = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/_reloj/kpi-reloj';
const URL_SYNC = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/eti-sync';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const c = new Client({ connectionString: m[1].trim().replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const ver = async () => {
    const r = await c.query(`SELECT d.start_time, d.status FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
                             WHERE j.jobname = 'rl-eti-sync' ORDER BY d.start_time DESC LIMIT 3`);
    console.log('Ultimas ejecuciones:', JSON.stringify(r.rows));
    const h = await c.query(`SELECT created, status_code, LEFT(content, 400) AS respuesta FROM net._http_response
                             WHERE content LIKE '%colecciones%' OR content LIKE '%eti-sync%' OR content LIKE '%Firestore%' ORDER BY created DESC LIMIT 3`);
    h.rows.forEach((x) => console.log(String(x.created), x.status_code, x.respuesta));
  };
  if (process.argv[2] === 'estado') { await ver(); await c.end(); return; }
  const k = await c.query("SELECT command FROM cron.job WHERE jobname = 'rl-kpi-reloj'");
  if (!k.rows.length || k.rows[0].command.indexOf(URL_RELOJ) < 0) throw new Error('No encuentro la tarea rl-kpi-reloj para tomar su llave');
  const cmd = k.rows[0].command.split(URL_RELOJ).join(URL_SYNC).replace(/timeout_milliseconds\s*:=\s*\d+/, 'timeout_milliseconds := 120000');
  await c.query("SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rl-eti-sync'");
  const r = await c.query("SELECT cron.schedule('rl-eti-sync', '*/10 * * * *', $1) AS id", [cmd]);
  console.log('OK copia Capacitaciones ETI programada: rl-eti-sync (cada 10 min), tarea ' + r.rows[0].id);
  console.log('Ejecutando una copia ahora...');
  await c.query(cmd);
  await espera(15000);
  await ver();
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
