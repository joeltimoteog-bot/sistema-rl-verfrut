/* verificar-archivos-azure.js — _VERIF_AZURE_V3 (11-nov-2026; V3: varias fotos en un mismo campo van separadas por | y no se leian bien): SOLO LEE. No cambia nada en Azure ni en Supabase.
   Responde: ¿queda algun archivo que este SOLO en Azure y no en Supabase?
     1) Lista TODAS las cuentas de almacenamiento y TODOS sus contenedores en Azure (con az, sesion ya iniciada)
        y compara archivo por archivo (nombre y tamaño) contra Supabase Storage.
     2) Busca en TODA la base de Supabase (texto y JSON, todos los esquemas propios) direcciones que
        todavia apunten a Azure (blob.core.windows.net) y dice si ese archivo ya esta en Supabase o no.
     3) Revisa que los enlaces a Supabase Storage guardados en la base apunten a archivos que existen.
   Uso:  node verificar-archivos-azure.js
   No muestra claves ni contenido de las filas: solo conteos y nombres de archivo. */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^SUPABASE_DB_URL=(.+)$/m);
if (!m) { console.error('Falta migracion\\.env con SUPABASE_DB_URL'); process.exit(1); }
const SIM = process.env.VERIF_SIMULADO || '';   /* solo para pruebas: carpeta con las respuestas de az */
const CORTE = '2026-11-05';                      /* dia en que se copiaron los archivos a Supabase */
const SISTEMA = /^(azure-webjobs-|scm-releases|function-releases|insights-|\$logs|\$web|\$blobchangefeed|app-package-|bootdiagnostics-)/i;
const corta = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

function az(args, clave) {
  if (SIM) { const f = path.join(SIM, clave + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; }
  const r = cp.spawnSync('az ' + args + ' -o json --only-show-errors', { shell: true, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONWARNINGS: 'ignore' }) });
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || 'az no respondio').trim().split('\n').slice(-2).join(' ').slice(0, 300));
  const t = String(r.stdout || '').replace(/^﻿/, '').trim();
  return t ? JSON.parse(t) : [];
}

(async () => {
  let solos = 0, dudas = 0;   /* solos = archivos que estan SOLO en Azure · dudas = cosas que no se pudieron revisar */
  /* _VERIF_AZURE_V2: si la base corta la conexion a mitad de camino, se vuelve a conectar y se repite esa consulta */
  let cli = null;
  const conectar = async () => { cli = new Client({ connectionString: m[1].trim().replace(/^"|"$/g, ''), ssl: SIM ? false : { rejectUnauthorized: false }, keepAlive: true });
    cli.on('error', () => {}); await cli.connect(); };
  const c = { query: async (sql, v) => { let ult; for (let i = 0; i < 4; i++) { try { if (!cli) await conectar(); return await cli.query(sql, v); }
        catch (e) { ult = e; if (!/ECONNRESET|terminated|Connection|socket|EPIPE|ETIMEDOUT|not queryable/i.test(String(e.message))) throw e;
          try { await cli.end(); } catch (x) {} cli = null; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); } } throw ult; },
    end: async () => { try { if (cli) await cli.end(); } catch (e) {} } };
  await conectar();

  /* ── Supabase Storage: todo lo que hay ── */
  const sb = new Map();   /* bucket -> Map(nombre -> tamaño) */
  (await c.query(`SELECT bucket_id, name, COALESCE((metadata->>'size')::bigint, -1) AS t FROM storage.objects`)).rows
    .forEach((x) => { if (!sb.has(x.bucket_id)) sb.set(x.bucket_id, new Map()); sb.get(x.bucket_id).set(x.name, Number(x.t)); });
  console.log('\n== SUPABASE STORAGE (lo que ya esta guardado) ==');
  if (!sb.size) console.log('  (sin archivos)');
  [...sb.keys()].sort().forEach((b) => console.log('  ' + b + ': ' + sb.get(b).size + ' archivos'));

  /* ── 1) Azure: todas las cuentas y contenedores ── */
  console.log('\n== 1) AZURE: cuentas de almacenamiento y contenedores ==');
  let cuentas = [];
  try { cuentas = az('storage account list --query "[].{n:name,g:resourceGroup}"', 'cuentas'); }
  catch (e) { dudas++; console.log('  NO SE PUDO LEER AZURE: ' + e.message + '\n  (abre PowerShell, ejecuta  az login  y vuelve a correr este script)'); }
  if (cuentas.length === 0 && !dudas) console.log('  Azure no tiene ninguna cuenta de almacenamiento en esta suscripcion.');
  for (const cu of cuentas) {
    console.log('\n  Cuenta ' + cu.n + ' (grupo ' + cu.g + ')');
    let conts = [];
    try { conts = az('storage container list --account-name ' + cu.n + ' --auth-mode key --num-results * --query "[].name"', cu.n + '__contenedores'); }
    catch (e) { dudas++; console.log('    NO SE PUDO LISTAR SUS CONTENEDORES: ' + e.message); continue; }
    if (!conts.length) console.log('    (sin contenedores)');
    try { const sh = az('storage share list --account-name ' + cu.n + ' --auth-mode key --query "[].name"', cu.n + '__carpetas');
      if (sh.length) console.log('    carpetas compartidas (Azure Files, normalmente el codigo de las Functions, no documentos): ' + sh.join(', ')); } catch (e) {}
    for (const co of conts) {
      let blobs = [];
      try { blobs = az('storage blob list --account-name ' + cu.n + ' -c "' + co + '" --auth-mode key --num-results * --query "[].{n:name,t:properties.contentLength,f:properties.lastModified}"', cu.n + '__' + co); }
      catch (e) { dudas++; console.log('    ' + co + ': NO SE PUDO LISTAR: ' + e.message); continue; }
      const esSis = SISTEMA.test(co), mapa = sb.get(co) || new Map();
      const faltan = blobs.filter((b) => !mapa.has(b.n));
      const distintos = blobs.filter((b) => mapa.has(b.n) && mapa.get(b.n) !== Number(b.t));
      const nuevos = blobs.filter((b) => String(b.f || '').slice(0, 10) >= CORTE);
      const nuevosFaltan = nuevos.filter((b) => !mapa.has(b.n));
      if (esSis) { console.log('    ' + co + ': ' + blobs.length + ' archivos · es de uso interno de Azure (no son documentos del sistema)'); continue; }
      console.log('    ' + co + ': Azure ' + blobs.length + ' · en Supabase ' + (blobs.length - faltan.length) + ' · FALTAN ' + faltan.length
        + ' · tamaño distinto ' + distintos.length + ' · subidos a Azure desde el ' + CORTE + ': ' + nuevos.length + ' (de esos faltan ' + nuevosFaltan.length + ')');
      solos += faltan.length + distintos.length;
      faltan.slice(0, 15).forEach((b) => console.log('       FALTA: ' + corta(b.n, 90) + '  (' + b.t + ' bytes, ' + String(b.f || '').slice(0, 10) + ')'));
      if (faltan.length > 15) console.log('       … y ' + (faltan.length - 15) + ' mas');
      distintos.slice(0, 10).forEach((b) => console.log('       TAMAÑO DISTINTO: ' + corta(b.n, 90) + '  azure=' + b.t + ' supabase=' + mapa.get(b.n)));
    }
  }

  /* ── 2) y 3) enlaces guardados en la base ── */
  console.log('\n== 2) BASE DE DATOS: enlaces que todavia apuntan a Azure ==');
  const cols = (await c.query(`SELECT table_schema AS s, table_name AS t, column_name AS k FROM information_schema.columns
     WHERE table_schema NOT IN ('pg_catalog','information_schema','storage','auth','cron','net','vault','extensions','graphql','graphql_public','realtime','pgsodium','pgsodium_masks','supabase_functions','supabase_migrations','pgbouncer','_realtime','_analytics','pg_toast')
       AND table_schema NOT LIKE 'pg\\_%'
       AND (data_type IN ('text','character varying','json','jsonb') OR udt_name = 'citext')
       AND (table_schema, table_name) IN (SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE')
     ORDER BY 1, 2, 3`)).rows;
  const RE_AZ = 'https?://([a-z0-9]+)\\.blob\\.core\\.windows\\.net/([^/?"\'\\s<>\\\\]+)/([^?"\'\\s<>\\\\|,;]+)';
  const RE_SB = 'supabase\\.co/storage/v1/object/(?:public|sign)/([^/?"\'\\s<>\\\\]+)/([^?"\'\\s<>\\\\|,;]+)';
  const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  let filasAz = 0, refAzSolo = 0, refAzYa = 0, rotos = 0, refSb = 0; const solosNombres = new Set(), rotosNombres = new Set();
  const porTabla = new Map();
  cols.forEach((x) => { const id = x.s + '\u0000' + x.t; if (!porTabla.has(id)) porTabla.set(id, []); porTabla.get(id).push(x.k); });
  const conteo = new Map(); let tablasVistas = 0;
  for (const [id, ks] of porTabla) {
    const [s, t] = id.split('\u0000'), tabla = `"${s}"."${t}"`;
    try {
      const r = (await c.query('SELECT ' + ks.map((k, i) => `COUNT(*) FILTER (WHERE "${k}"::text LIKE '%blob.core.windows.net%')::int AS a${i}, COUNT(*) FILTER (WHERE "${k}"::text LIKE '%supabase.co/storage/v1/object/%')::int AS b${i}`).join(', ') + ' FROM ' + tabla)).rows[0];
      ks.forEach((k, i) => conteo.set(id + '\u0000' + k, [r['a' + i], r['b' + i]])); tablasVistas++;
    } catch (e) { dudas++; console.log('  no se pudo leer ' + s + '.' + t + ': ' + e.message.slice(0, 80)); }
  }
  console.log('  (revisadas ' + tablasVistas + ' de ' + porTabla.size + ' tablas, ' + cols.length + ' columnas de texto o JSON)');
  for (const { s, t, k } of cols) {
    const esResp = /^_resp_|__carga$|_bak|_backup|_respaldo/i.test(t), tabla = `"${s}"."${t}"`;
    const cc = conteo.get(s + '\u0000' + t + '\u0000' + k); if (!cc) continue;
    const n = cc[0];
    if (n) {
      const u = (await c.query(`SELECT DISTINCT x[2] AS cont, x[3] AS nom FROM ${tabla}, regexp_matches("${k}"::text, $1, 'g') AS x`, [RE_AZ])).rows;
      const sinCopia = u.filter((r) => !((sb.get(r.cont) || new Map()).has(dec(r.nom)) || (sb.get(r.cont) || new Map()).has(r.nom)));
      console.log('  ' + s + '.' + t + '.' + k + ': ' + n + ' filas, ' + u.length + ' archivos distintos · ya estan en Supabase ' + (u.length - sinCopia.length) + ' · SOLO EN AZURE ' + sinCopia.length + (esResp ? '   (tabla de respaldo: no la usa el sistema)' : ''));
      if (!esResp) { filasAz += n; refAzYa += u.length - sinCopia.length; refAzSolo += sinCopia.length; sinCopia.forEach((r) => solosNombres.add(r.cont + '/' + dec(r.nom))); }
    }
    const nb = cc[1];
    if (nb && !esResp) {
      const u = (await c.query(`SELECT DISTINCT x[1] AS cont, x[2] AS nom FROM ${tabla}, regexp_matches("${k}"::text, $1, 'g') AS x`, [RE_SB])).rows;
      refSb += u.length;
      u.filter((r) => !((sb.get(r.cont) || new Map()).has(dec(r.nom)) || (sb.get(r.cont) || new Map()).has(r.nom))).forEach((r) => { rotos++; rotosNombres.add(s + '.' + t + ' → ' + r.cont + '/' + dec(r.nom)); });
    }
  }
  if (!filasAz) console.log('  Ninguna tabla en uso guarda direcciones de Azure.');
  else console.log('  TOTAL en tablas en uso: ' + filasAz + ' filas con direccion de Azure · archivos que ya estan en Supabase: ' + refAzYa + ' · archivos SOLO EN AZURE: ' + refAzSolo);
  [...solosNombres].slice(0, 15).forEach((x) => console.log('       SOLO EN AZURE: ' + corta(x, 110)));
  solos += solosNombres.size;

  console.log('\n== 3) BASE DE DATOS: enlaces a Supabase Storage ==');
  console.log('  Archivos distintos enlazados: ' + refSb + ' · enlaces que apuntan a un archivo que NO existe: ' + rotos);
  [...rotosNombres].slice(0, 15).forEach((x) => console.log('       NO EXISTE: ' + corta(x, 130)));

  console.log('\n== RESULTADO ==');
  if (dudas) console.log('INCOMPLETO: hubo ' + dudas + ' cosa(s) que no se pudieron revisar (ver arriba). No se puede afirmar nada todavia.');
  else if (solos || rotos) console.log('ATENCION: ' + solos + ' archivo(s) estan SOLO en Azure o con tamaño distinto, y ' + rotos + ' enlace(s) de Supabase no tienen archivo. NO borrar Azure todavia.');
  else if (filasAz) console.log('ARCHIVOS COMPLETOS: todo lo de Azure ya esta en Supabase. Quedan ' + filasAz + ' filas con la direccion vieja de Azure: esos enlaces dejaran de abrir cuando se borre Azure (falta reescribirlos).');
  else console.log('TODO MIGRADO: ningun archivo esta solo en Azure y ninguna tabla en uso apunta a Azure.');
  await c.end();
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
