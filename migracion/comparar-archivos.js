/* comparar-archivos.js — _FASE4_ARCHIVOS_V1: SOLO LEE. Compara nombre por nombre los archivos de Azure
   (lista en azure-<contenedor>.json, generada con az) contra storage.objects de Supabase. */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^SUPABASE_DB_URL=(.+)$/m);
(async () => {
  const c = new Client({ connectionString: m[1].trim().replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  for (const cont of ['casos-rl', 'visitas-campo']) {
    const f = path.join(process.env.TEMP || '.', 'azure-' + cont + '.json');
    const az = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')).map(b => ({ n: b.name, t: b.properties.contentLength }));
    const sb = (await c.query(`SELECT name, (metadata->>'size')::bigint AS t FROM storage.objects WHERE bucket_id = $1`, [cont])).rows;
    const mapa = new Map(sb.map(x => [x.name, Number(x.t)]));
    const faltan = az.filter(x => !mapa.has(x.n)), distintos = az.filter(x => mapa.has(x.n) && mapa.get(x.n) !== Number(x.t));
    const enSub = sb.filter(x => x.name.includes('/')).length;
    console.log(`${cont}: Azure ${az.length} · Supabase ${sb.length} (en subcarpetas: ${enSub}) · faltan ${faltan.length} · tamaño distinto ${distintos.length}`);
    faltan.slice(0, 10).forEach(x => console.log('   FALTA: ' + x.n));
    distintos.slice(0, 10).forEach(x => console.log('   TAMAÑO: ' + x.n + ' azure=' + x.t + ' supabase=' + mapa.get(x.n)));
  }
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
