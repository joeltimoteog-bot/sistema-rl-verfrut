/* verificar-estadisticas.js — SOLO LECTURA (06-nov-2026). Revisa con los datos REALES de Supabase lo que
   muestra "Estadisticas Admin" (getEstadisticasAdmin): atenciones, visitas, casos y fusiones.
   Uso:  cd C:\sistema-rl-verfrut\migracion ; node verificar-estadisticas.js */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const L = (t) => console.log(t);
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  const q = async (s, p) => (await c.query(s, p || [])).rows;
  L('=== 1. ATENCIONES (tabla rl.atenciones, la que usa la pantalla) ===');
  const t = (await q(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE fecha_atencion IS NULL)::int sinfecha, MIN(fecha_atencion)::text desde, MAX(fecha_atencion)::text hasta,
    MAX(fecha_registro)::text ultimo_registro FROM rl.atenciones`))[0];
  L(`total ${t.n} · sin fecha de atencion ${t.sinfecha} · de ${t.desde} a ${t.hasta} · ultimo registro ${t.ultimo_registro}`);
  L('por estado: ' + (await q(`SELECT UPPER(COALESCE(estado::text,'')) e, COUNT(*)::int n FROM rl.atenciones GROUP BY 1 ORDER BY 2 DESC`)).map(r => (r.e || '(vacio)') + ' ' + r.n).join(' · '));
  L('por empresa: ' + (await q(`SELECT UPPER(COALESCE(empresa::text,'')) e, COUNT(*)::int n FROM rl.atenciones GROUP BY 1 ORDER BY 2 DESC`)).map(r => (r.e || '(vacio)') + ' ' + r.n).join(' · '));
  L('ultimos 6 meses: ' + (await q(`SELECT to_char(fecha_atencion,'YYYY-MM') ym, COUNT(*)::int n FROM rl.atenciones WHERE fecha_atencion >= date_trunc('month', now() - interval '5 months') GROUP BY 1 ORDER BY 1`)).map(r => r.ym + ' ' + r.n).join(' · '));
  const dup = await q(`SELECT COUNT(*)::int grupos, COALESCE(SUM(n - 1), 0)::int sobran FROM (SELECT COUNT(*) n FROM rl.atenciones WHERE dni IS NOT NULL AND dni::text <> ''
    GROUP BY dni::text, fecha_atencion, UPPER(COALESCE(supervisor::text,'')), UPPER(COALESCE(detalle_documento::text,'')), COALESCE(hora_inicio::text,'') HAVING COUNT(*) > 1) x`);
  L(`posibles duplicados (mismo DNI, fecha, supervisor, documento y hora): ${dup[0].grupos} grupos · ${dup[0].sobran} filas de mas`);
  const varS = await q(`SELECT LOWER(regexp_replace(TRIM(supervisor::text), '\\s+', ' ', 'g')) k, string_agg(DISTINCT supervisor::text, ' | ') formas, COUNT(DISTINCT supervisor::text)::int f
    FROM rl.atenciones WHERE supervisor IS NOT NULL GROUP BY 1 HAVING COUNT(DISTINCT supervisor::text) > 1 ORDER BY 1`);
  L(`supervisores escritos de varias formas (salen en filas separadas): ${varS.length}`); varS.slice(0, 15).forEach(r => L('   · ' + r.formas));
  L('\n=== 2. VISITAS, CASOS Y FUSIONES (copia que manda Google: rl.mod_datos modulo estadm) ===');
  const md = await q(`SELECT modulo::text mo, clave::text cl, actualizado::text act, length(datos::text) tam FROM rl.mod_datos WHERE modulo::text IN ('estadm','cap','horas','fus','sol') ORDER BY 1, 2`);
  md.forEach(r => L(`${r.mo}/${r.cl}: actualizado ${r.act} (UTC) · ${r.tam} bytes`));
  const f = await q(`SELECT datos::text d FROM rl.mod_datos WHERE modulo::text = 'estadm' AND clave::text = 'filas'`);
  if (f.length) {
    const F = JSON.parse(f[0].d), v = F.vis || [], ca = F.cas || [], fu = F.fus || [];
    L(`visitas ${v.length} · casos ${ca.length} · fusiones ${fu.length}`);
    L(`fusiones sin "total de trabajadores": ${fu.filter(x => x[2] === null || x[2] === '' || isNaN(Number(x[2]))).length}  (si es > 0, la tarjeta "trabajadores" puede salir NaN)`);
    L(`visitas sin mes/anio: ${v.filter(x => !x[3] || !x[4]).length} · casos sin mes/anio: ${ca.filter(x => !x[3] || !x[4]).length}`);
    const nCasosTabla = (await q(`SELECT COUNT(*)::int n FROM rl.casos`).catch(() => [{ n: null }]))[0].n;
    L(`casos en la tabla rl.casos: ${nCasosTabla}  (compara con los ${ca.length} de la copia de Google)`);
    const sups = {}; [].concat(at(v), at(ca)).forEach(s => { const k = String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); (sups[k] = sups[k] || new Set()).add(String(s || '').trim()); });
    function at(a) { return a.map(x => x[0]); }
    const varias = Object.values(sups).filter(s => s.size > 1);
    L(`supervisores con varias formas en visitas/casos: ${varias.length}`); varias.slice(0, 10).forEach(s => L('   · ' + [...s].join(' | ')));
  } else L('NO hay copia estadm/filas: la pantalla usa Google (respaldo).');
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
