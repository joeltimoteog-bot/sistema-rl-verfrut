/* inventario-campos-eti.js — _TABLAS_ETI_V1 (11-nov-2026): SOLO LECTURA.
   Para pasar las tablas "amontonadas" a tablas con columnas propias hay que saber que campos trae de verdad cada una.
   Este script recorre las tablas del esquema eti (id + datos JSON) y las 4 amontonadas del esquema rl, y por cada campo
   dice: en cuantas filas aparece, de que tipo es y que tan largo llega a ser. NO muestra el contenido de ningun registro
   y oculta por completo los campos de clave. No crea, no cambia ni borra nada.
   Uso:  cd C:\sistema-rl-verfrut\migracion ; node inventario-campos-eti.js   (deja tambien inventario-campos-eti.txt) */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const out = []; const P = (s) => { console.log(s); out.push(s); };
const tipo = (v) => v === null ? 'nulo' : Array.isArray(v) ? 'lista' : typeof v === 'object' ? 'objeto' : typeof v === 'number' ? (Number.isInteger(v) ? 'entero' : 'decimal') : typeof v === 'boolean' ? 'si/no'
  : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? 'fecha-hora' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? 'fecha' : /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) ? 'fecha d/m/a' : /^-?\d+(\.\d+)?$/.test(v) && v.length < 12 ? 'texto-numero' : 'texto';
function resumir(filas) {
  const C = {};
  for (const d of filas) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) continue;
    for (const k of Object.keys(d)) {
      const v = d[k], c = C[k] || (C[k] = { n: 0, tipos: {}, max: 0, sub: {} });
      c.n++; const t = tipo(v); c.tipos[t] = (c.tipos[t] || 0) + 1;
      const len = v === null || v === undefined ? 0 : typeof v === 'string' ? v.length : JSON.stringify(v).length; if (len > c.max) c.max = len;
      if (t === 'objeto') Object.keys(v).slice(0, 40).forEach(s => { c.sub[s] = 1; });
      if (t === 'lista' && v.length && v[0] && typeof v[0] === 'object') Object.keys(v[0]).slice(0, 40).forEach(s => { c.sub[s] = 1; });
    }
  }
  return C;
}
function pintar(nombre, total, C) {
  P('\n== ' + nombre + ' · ' + total + ' filas ==');
  Object.keys(C).sort((a, b) => C[b].n - C[a].n || a.localeCompare(b)).forEach(k => {
    const c = C[k], secreto = /pass|hash|clave|token|secret/i.test(k);
    P('  ' + k.padEnd(30) + String(c.n).padStart(5) + '/' + total + '  ' + Object.keys(c.tipos).map(t => t + (Object.keys(c.tipos).length > 1 ? ':' + c.tipos[t] : '')).join(', ').padEnd(26) +
      (secreto ? '  [campo de clave: oculto]' : '  largo max ' + c.max + (Object.keys(c.sub).length ? '  dentro: ' + Object.keys(c.sub).slice(0, 25).join(', ') : '')));
  });
}
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  await c.query('SET default_transaction_read_only = on');
  const tabs = (await c.query(`SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'eti' AND column_name = 'datos' AND data_type LIKE 'json%' ORDER BY 1`)).rows.map(r => r.t);
  for (const t of tabs) {
    const cols = (await c.query(`SELECT column_name AS c, data_type AS d FROM information_schema.columns WHERE table_schema = 'eti' AND table_name = $1 ORDER BY ordinal_position`, [t])).rows;
    const r = await c.query('SELECT datos FROM eti."' + t + '"');
    pintar('eti.' + t + '  (columnas: ' + cols.map(x => x.c + ' ' + x.d).join(', ') + ')', r.rows.length, resumir(r.rows.map(x => x.datos)));
    if (t === 'config_eti') { const ids = await c.query('SELECT id, length(datos::text) AS n FROM eti.config_eti ORDER BY 1'); P('  documentos: ' + ids.rows.map(x => x.id + ' (' + x.n + ' caracteres)').join(' · ')); }
  }
  /* las 4 del esquema rl que guardan JSON como texto */
  for (const t of ['mod_datos', 'cumpl_datos', 'cv_casos', 'cv_visitas', 'cv_estado']) {
    try {
      const cols = (await c.query(`SELECT column_name AS c, data_type AS d FROM information_schema.columns WHERE table_schema = 'rl' AND table_name = $1 ORDER BY ordinal_position`, [t])).rows;
      const r = await c.query('SELECT * FROM rl."' + t + '"');
      P('\n== rl.' + t + ' · ' + r.rows.length + ' filas  (columnas: ' + cols.map(x => x.c + ' ' + x.d).join(', ') + ') ==');
      for (const col of cols) {
        const vals = r.rows.map(x => x[col.c]).filter(v => typeof v === 'string' && /^\s*[\[{]/.test(v));
        if (!vals.length) continue;
        let arr = 0, obj = 0, largo = 0; const claves = {}, dentro = {};
        vals.forEach(v => { largo = Math.max(largo, v.length); try { const j = JSON.parse(v); if (Array.isArray(j)) { arr++; if (j[0] && typeof j[0] === 'object') Object.keys(j[0]).slice(0, 40).forEach(k => { dentro[k] = 1; }); } else { obj++; Object.keys(j).slice(0, 40).forEach(k => { claves[k] = 1; }); } } catch (e) {} });
        P('  columna "' + col.c + '" guarda JSON en ' + vals.length + ' filas (listas: ' + arr + ', objetos: ' + obj + ', largo max ' + largo + ')');
        if (Object.keys(claves).length) P('     campos del objeto: ' + Object.keys(claves).filter(k => !/pass|hash|token|secret/i.test(k)).join(', '));
        if (Object.keys(dentro).length) P('     campos de cada elemento: ' + Object.keys(dentro).filter(k => !/pass|hash|token|secret/i.test(k)).join(', '));
      }
      const cl = cols.find(x => /clave|modulo|nombre/i.test(x.c)); if (cl && r.rows.length <= 40) P('  filas: ' + r.rows.map(x => String(x[cl.c])).join(' · '));
    } catch (e) { P('\n== rl.' + t + ': no se pudo leer (' + e.message + ') =='); }
  }
  await c.end();
  fs.writeFileSync(path.join(__dirname, 'inventario-campos-eti.txt'), out.join('\r\n'), 'utf8');
  console.log('\nGuardado en migracion\\inventario-campos-eti.txt');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
