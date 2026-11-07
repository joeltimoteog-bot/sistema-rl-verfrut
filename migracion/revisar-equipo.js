/* revisar-equipo.js — SOLO LECTURA. Muestra quién figura en cada lista que alimenta
   el Panel de Gestión (cumplimiento), los KPIs y los supervisores de ETI.
   Uso: cd C:\sistema-rl-verfrut\migracion ; node revisar-equipo.js            */
/* lee el .env sin dependencias (igual que los otros scripts de migracion/) */
require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s) => (await c.query(s)).rows;
  const sep = (t) => console.log('\n══ ' + t + ' ' + '═'.repeat(Math.max(2, 70 - t.length)));

  sep('1) USUARIOS que llegan al motor de cumplimiento (rl.cumpl_datos · clave usuarios)');
  const us = await q(`SELECT x->>'usuario' AS usuario, x->>'nombre' AS nombre, x->>'rol' AS rol,
                             x->>'activo' AS activo, x->>'empresa' AS empresa, x->>'sector' AS sector
                      FROM rl.cumpl_datos, jsonb_array_elements(datos::jsonb) x WHERE clave='usuarios'
                      ORDER BY (x->>'activo') DESC, x->>'rol', x->>'nombre'`);
  console.table(us);

  sep('2) SUPERVISORES DE CAMPO (rl.cumpl_datos · clave sups) → a quienes se exige visita semanal');
  console.log((await q(`SELECT datos::text AS d FROM rl.cumpl_datos WHERE clave='sups'`))[0]?.d);

  sep('3) PERSONAS evaluadas por KPI (rl.kpi_personas)');
  try { console.table(await q(`SELECT usuario, nombre, empresa, tipo, puesto, ingreso::text AS ingreso, activo FROM rl.kpi_personas ORDER BY orden, nombre`)); }
  catch (e) { console.log('(sin tabla kpi_personas: ' + e.message + ')'); }

  sep('4) SUPERVISORES y USUARIOS que manda ETI (rl.eti_supervisores / rl.eti_usuarios)');
  try { console.table(await q(`SELECT nombre, sector FROM rl.eti_supervisores ORDER BY nombre`)); } catch (e) { console.log('eti_supervisores: ' + e.message); }
  try { console.table(await q(`SELECT usuario, nombre, estado FROM rl.eti_usuarios ORDER BY estado, nombre`)); } catch (e) { console.log('eti_usuarios: ' + e.message); }

  sep('5) Quién aparece HOY en el Panel de Gestión (misma regla que cumplPanel, sin casos)');
  const excl = ['jsiancas', 'mmechato'];
  const sups = JSON.parse((await q(`SELECT datos::text AS d FROM rl.cumpl_datos WHERE clave='sups'`))[0]?.d || '[]');
  const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  us.forEach(u => {
    const act = String(u.activo) === 'true', ex = excl.includes(n(u.usuario));
    const campo = sups.some(s => n(s) === n(u.nombre) || n(u.nombre).split(/\s+/).filter(t => t.length > 2).filter(t => n(s).includes(t)).length >= 2);
    const motivo = ex ? 'EXCLUIDO (lista fija)' : !act ? 'inactivo' : u.rol !== 'supervisor' ? 'rol ' + u.rol : campo ? 'SALE · supervisor de campo' : 'sale solo si tiene casos abiertos';
    console.log((ex || !act || u.rol !== 'supervisor' ? '   ' : '👉 ') + (u.usuario + '').padEnd(14) + (u.nombre + '').padEnd(42) + motivo);
  });
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
