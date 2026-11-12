/* auditar-eliminados.js — _AUDIT_ELIMINADOS_V1 (12-nov-2026): SOLO LEE. No cambia nada.
   Responde: en cada modulo, ¿lo que se "elimino" realmente salio de Supabase?
     1) Atenciones: lo que esta en la PAPELERA (hoja de Google) y TODAVIA existe en rl.atenciones.
     2) Casos y Visitas: lo archivado en *_eliminad* que TODAVIA existe en la tabla principal.
     3) Bitacora de operaciones (rl.cv_ops): cuantas eliminaciones registro el servidor por modulo,
        cuando fue la ultima y si alguna quedo con error.
     4) Copias de respaldo de atenciones eliminadas (rl.atenciones_respaldo).
   Uso:  cd C:\sistema-rl-verfrut\migracion ; node auditar-eliminados.js
   No muestra nombres ni datos de trabajadores: solo cantidades y numeros de registro. */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta migracion\\.env con SUPABASE_DB_URL'); process.exit(1); }
const GAS = 'https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
const SIM = process.env.AUDIT_SIMULADO || '';   /* solo pruebas: JSON con { pares: [...] } en vez de llamar a Google */
const sinCeros = (d) => String(d == null ? '' : d).trim().replace(/^0+/, '');

(async () => {
  const url = m[1].replace(/^"|"$/g, '');
  let cli = null;
  const conectar = async () => { cli = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, keepAlive: true }); cli.on('error', () => {}); await cli.connect(); };
  const q = async (sql, v) => { let ult; for (let i = 0; i < 4; i++) { try { if (!cli) await conectar(); return (await cli.query(sql, v)).rows; }
      catch (e) { ult = e; if (!/ECONNRESET|terminated|Connection|socket|EPIPE|ETIMEDOUT|not queryable/i.test(String(e.message))) throw e; try { await cli.end(); } catch (x) {} cli = null; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); } } throw ult; };
  const existe = async (t) => (await q(`SELECT to_regclass($1) IS NOT NULL AS ok`, ['rl.' + t]))[0].ok;
  let problemas = 0, dudas = 0;

  /* ── 1) Atenciones: PAPELERA vs Supabase ── */
  console.log('\n== 1) ATENCIONES: registros de la PAPELERA que siguen en Supabase ==');
  let pares = null;
  try {
    if (SIM) pares = JSON.parse(fs.readFileSync(SIM, 'utf8')).pares;
    else { const r = await fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'papeleraNros' }) }); const j = await r.json(); if (j && j.success) pares = j.pares || []; }
  } catch (e) { pares = null; }
  if (!pares) { dudas++; console.log('  NO SE PUDO LEER LA PAPELERA de Google (sin conexion o sin respuesta). Esta parte queda sin revisar.'); }
  else {
    const vivos = [];
    for (const p of pares) {
      const s = String(p).split('|'), nro = parseInt(s[0], 10), dni = sinCeros(s[1]);
      if (!nro) continue;
      const r = await q(`SELECT id, anio FROM rl.atenciones WHERE nro = $1 AND ($2 = '' OR ltrim(trim(dni::text), '0') = $2)`, [nro, dni]);
      if (r.length) vivos.push(nro + ' (' + r.map((x) => x.anio).join(',') + ')');
    }
    console.log('  En la PAPELERA: ' + pares.length + ' · ya no estan en Supabase: ' + (pares.length - vivos.length) + ' · SIGUEN EN SUPABASE: ' + vivos.length);
    if (vivos.length) { problemas += vivos.length; console.log('  N° (año) que siguen: ' + vivos.join(', ')); console.log('  -> se "eliminaron" pero siguen contando en estadisticas y en la base que se descarga.'); }
  }
  const tot = (await q(`SELECT COUNT(*)::int AS n FROM rl.atenciones`))[0].n;
  console.log('  Atenciones en Supabase hoy: ' + tot);

  /* ── 2) Casos y Visitas ── */
  console.log('\n== 2) CASOS y VISITAS: archivados que siguen en la tabla principal ==');
  for (const [nombre, principal, archivo] of [['Casos', 'casos', 'casos_eliminados'], ['Visitas', 'visitas', 'visitas_eliminadas']]) {
    if (!(await existe(principal)) || !(await existe(archivo))) { dudas++; console.log('  ' + nombre + ': no encuentro rl.' + principal + ' o rl.' + archivo + ' (sin revisar)'); continue; }
    const a = (await q(`SELECT COUNT(*)::int AS n FROM rl.${archivo}`))[0].n, p = (await q(`SELECT COUNT(*)::int AS n FROM rl.${principal}`))[0].n;
    const z = await q(`SELECT DISTINCT e.nro FROM rl.${archivo} e JOIN rl.${principal} x ON x.nro = e.nro AND COALESCE(trim(x.dni::text), '') = COALESCE(trim(e.dni::text), '') WHERE e.nro IS NOT NULL ORDER BY 1`);
    console.log('  ' + nombre + ': vigentes ' + p + ' · archivados (eliminados) ' + a + ' · archivados que SIGUEN vigentes: ' + z.length + (z.length ? '  -> N° ' + z.map((x) => x.nro).join(', ') : ''));
    problemas += z.length;
  }

  /* ── 3) Bitacora de operaciones ── */
  console.log('\n== 3) ELIMINACIONES que registro el servidor (rl.cv_ops) ==');
  if (await existe('cv_ops')) {
    const r = await q(`SELECT tipo::text AS tipo, accion::text AS accion, COUNT(*)::int AS n, to_char(MAX(creado), 'YYYY-MM-DD') AS ultima,
                              COUNT(*) FILTER (WHERE COALESCE(trim(error::text), '') <> '')::int AS con_error
                       FROM rl.cv_ops WHERE accion::text ~* '(elimin|delete|borrar)' GROUP BY 1, 2 ORDER BY 1, 2`);
    if (!r.length) console.log('  (ninguna eliminacion registrada)');
    r.forEach((x) => { console.log('  ' + (x.tipo || '-') + ' · ' + x.accion + ': ' + x.n + ' · ultima ' + x.ultima + (x.con_error ? ' · CON ERROR: ' + x.con_error : '')); if (x.con_error) problemas += x.con_error; });
  } else { dudas++; console.log('  no encuentro rl.cv_ops (sin revisar)'); }

  /* ── 4) Respaldo de atenciones ── */
  console.log('\n== 4) COPIAS DE RESPALDO de atenciones (rl.atenciones_respaldo) ==');
  if (await existe('atenciones_respaldo')) {
    const r = await q(`SELECT CASE WHEN motivo::text LIKE 'eliminada por%' THEN 'eliminadas desde la pantalla (nuevo)' ELSE motivo::text END AS m, COUNT(*)::int AS n FROM rl.atenciones_respaldo GROUP BY 1 ORDER BY 2 DESC`);
    if (!r.length) console.log('  (vacio)'); r.forEach((x) => console.log('  ' + x.m + ': ' + x.n));
  } else console.log('  (la tabla aun no existe)');

  console.log('\n== RESULTADO ==');
  if (dudas) console.log('INCOMPLETO: ' + dudas + ' parte(s) no se pudieron revisar (ver arriba).' + (problemas ? ' Ademas hay ' + problemas + ' registro(s) eliminados que siguen en la base.' : ''));
  else if (problemas) console.log('ATENCION: ' + problemas + ' registro(s) "eliminados" siguen en la base o quedaron con error (detalle arriba). Nada se toco.');
  else console.log('LIMPIO: todo lo eliminado salio de la base.');
  try { await cli.end(); } catch (e) {}
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
