/* inventario-anidado-eti.js — _TABLAS_ETI_V2 (11-nov-2026): SOLO LECTURA.
   Mide la estructura por dentro (hasta 5 niveles) de las tablas amontonadas que guardan documentos anidados:
   banco de preguntas y sus versiones, configuracion, informe de capacitacion, evaluaciones depuradas, y el detalle
   por seccion de las evaluaciones manuales y de las sesiones QR. Muestra SOLO nombres de campos, tipos y conteos:
   ningun contenido, ningun nombre de persona, y los campos de clave salen ocultos. No crea, no cambia ni borra nada.
   Uso:  cd C:\sistema-rl-verfrut\migracion\tablas-eti ; node inventario-anidado-eti.js   (deja inventario-anidado-eti.txt) */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const m = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const out = []; const P = (s) => { console.log(s); out.push(s); };
const tipo = (v) => v === null ? 'nulo' : Array.isArray(v) ? 'lista' : typeof v === 'object' ? 'objeto' : typeof v === 'number' ? (Number.isInteger(v) ? 'entero' : 'decimal') : typeof v === 'boolean' ? 'si/no'
  : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? 'fecha-hora' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? 'fecha' : /^-?\d+(\.\d+)?$/.test(v) && v.length < 12 ? 'texto-numero' : 'texto';
const SECRETO = /pass|hash|clave|token|secret/i;
/* las claves que son datos y no nombres de campo (usuarios, numeros de pregunta, fechas, codigos) se agrupan como <clave> */
const esDato = (k, hermanos) => /^\d+$/.test(k) || /^\d{4}-\d{2}-\d{2}/.test(k) || (hermanos > 12 && /^[a-z]{3,12}$/.test(k));
function andar(v, ruta, C, nivel) {
  const t = tipo(v), c = C[ruta] || (C[ruta] = { n: 0, tipos: {}, max: 0, elems: 0 });
  c.n++; c.tipos[t] = (c.tipos[t] || 0) + 1;
  if (typeof v === 'string') c.max = Math.max(c.max, v.length);
  if (nivel >= 5) return;
  if (t === 'lista') { c.elems = Math.max(c.elems, v.length); v.slice(0, 400).forEach(e => andar(e, ruta + '[]', C, nivel + 1)); }
  else if (t === 'objeto') { const ks = Object.keys(v); c.elems = Math.max(c.elems, ks.length);
    /* un objeto cuyas claves son datos (un usuario, un sector...) tiene todos sus valores del mismo tipo: se agrupan y no se muestran */
    const tv = ks.map(k => tipo(v[k])), uniforme = ks.length >= 4 && tv.every(x => x === tv[0]) && ['objeto', 'si/no', 'lista'].indexOf(tv[0]) >= 0;
    ks.slice(0, 400).forEach(k => { if (SECRETO.test(k)) { const o = C[ruta + '.[campo de clave]'] || (C[ruta + '.[campo de clave]'] = { n: 0, tipos: { oculto: 0 }, max: 0, elems: 0 }); o.n++; o.tipos.oculto++; return; }
      andar(v[k], ruta + '.' + ((uniforme || esDato(k, ks.length)) ? '<clave>' : k), C, nivel + 1); }); }
}
function pintar(titulo, total, C) {
  P('\n== ' + titulo + ' · ' + total + ' filas ==');
  Object.keys(C).sort().forEach(r => { if (r === '$') return; const c = C[r];
    P('  ' + r.replace(/^\$\.?/, '').padEnd(52) + String(c.n).padStart(6) + '  ' + Object.keys(c.tipos).map(t => t + (Object.keys(c.tipos).length > 1 ? ':' + c.tipos[t] : '')).join(', ').padEnd(24) +
      (c.elems ? '  hasta ' + c.elems + ' elementos' : '') + (c.max ? '  largo max ' + c.max : '')); });
}
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } }); await c.connect();
  await c.query('SET default_transaction_read_only = on');
  const leer = async (t) => { try { return (await c.query('SELECT id, datos FROM eti."' + t + '"')).rows; } catch (e) { P('\n== eti.' + t + ': no se pudo leer (' + e.message + ') =='); return null; } };
  for (const t of ['banco_historial', 'informes_cap', 'evaluaciones_depuradas', 'programaciones_eval', 'alertas_ref', 'encuestas_qr', 'encuestas_sat', 'informes_eti']) {
    const rows = await leer(t); if (!rows) continue; const C = {}; rows.forEach(r => andar(r.datos, '$', C, 0)); pintar('eti.' + t, rows.length, C);
  }
  const cfg = await leer('config_eti');
  if (cfg) cfg.forEach(r => { const C = {}; andar(r.datos, '$', C, 0); pintar('eti.config_eti  documento "' + r.id + '"', 1, C); });
  /* detalle que quedo sin separar en las tablas ordenadas */
  const ev = await leer('evaluaciones_conocimiento');
  if (ev) { const C = {}; ev.forEach(r => { const d = r.datos || {}; andar({ rutas: d.rutas, destiempo: d.destiempo, detBanco: d.detBanco, prog: d.prog, rutasOriginal: d.rutasOriginal }, '$', C, 0); }); pintar('eti.evaluaciones_conocimiento  (solo lo anidado)', ev.length, C); }
  const se = await leer('sesiones_qr');
  if (se) { const C = {}; se.forEach(r => andar({ banco: (r.datos || {}).banco }, '$', C, 0)); pintar('eti.sesiones_qr  (solo el banco guardado en cada QR)', se.length, C); }
  const ca = await leer('capacitaciones');
  if (ca) { const C = {}; ca.forEach(r => { const d = r.datos || {}; andar({ areas: d.areas, codigosCapacitados: d.codigosCapacitados, rutas: d.rutas }, '$', C, 0); }); pintar('eti.capacitaciones  (solo las listas)', ca.length, C); }
  await c.end();
  fs.writeFileSync(path.join(__dirname, 'inventario-anidado-eti.txt'), out.join('\r\n'), 'utf8');
  console.log('\nGuardado en migracion\\tablas-eti\\inventario-anidado-eti.txt');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
