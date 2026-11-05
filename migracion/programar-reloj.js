/* programar-reloj.js — _FASE3_V1 (05-nov-2026)
   Programa en Supabase (pg_cron + pg_net) el reloj kpi-reloj que hoy corre en Azure.
   Mismo horario que Azure: cada 15 min entre 06:00 y 19:59 de Lima (11-23 y 0 UTC).
   La llave del reloj llega por la variable RL_CRON_KEY (no se muestra).
   Uso: node programar-reloj.js            -> programa / actualiza
        node programar-reloj.js estado     -> muestra las ultimas ejecuciones */
'use strict';
const fs = require('fs'), path = require('path');
const { Client } = require('pg');
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const m = env.match(/^SUPABASE_DB_URL=(.+)$/m);
if (!m) { console.error('Falta migracion\\.env con SUPABASE_DB_URL'); process.exit(1); }
const URL_API = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/_reloj/kpi-reloj';

(async () => {
  const c = new Client({ connectionString: m[1].trim().replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  if (process.argv[2] === 'estado') {
    const j = await c.query("SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'rl-%'");
    console.log('Tareas:', JSON.stringify(j.rows));
    const r = await c.query(`SELECT d.start_time, d.status, d.return_message FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
                             WHERE j.jobname = 'rl-kpi-reloj' ORDER BY d.start_time DESC LIMIT 5`);
    console.log('Ultimas ejecuciones:', JSON.stringify(r.rows));
    const h = await c.query(`SELECT created, status_code, LEFT(content, 160) AS respuesta, error_msg FROM net._http_response ORDER BY created DESC LIMIT 5`);
    console.log('Respuestas de la funcion:', JSON.stringify(h.rows));
    await c.end(); return;
  }
  const llave = process.env.RL_CRON_KEY;
  if (!llave) { console.error('Falta RL_CRON_KEY'); process.exit(1); }
  await c.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
  await c.query('CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions');
  const cmd = `SELECT net.http_post(url := '${URL_API}', headers := jsonb_build_object('Content-Type', 'application/json', 'x-functions-key', '${llave.replace(/'/g, "''")}'), body := '{}'::jsonb, timeout_milliseconds := 150000)`;
  await c.query("SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rl-kpi-reloj'");
  const r = await c.query("SELECT cron.schedule('rl-kpi-reloj', '*/15 0,11-23 * * *', $1) AS id", [cmd]);
  console.log('OK reloj programado en Supabase: rl-kpi-reloj (cada 15 min, 06:00-19:59 Lima), tarea ' + r.rows[0].id);
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
