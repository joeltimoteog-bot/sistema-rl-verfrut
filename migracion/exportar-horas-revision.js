/* migracion/exportar-horas-revision.js — _HORAS_REVISION_V1 (13-nov-2026)
   SOLO LECTURA. Saca de Supabase los registros de Acumulacion de Horas (registros, motivos, horarios de jornada
   y pagadas), tal como los lee el sistema, y los guarda en UN archivo JSON para revisarlos.
   No cambia nada en la base. El archivo queda FUERA del repositorio (tiene DNIs):
     C:\sistema-rl-backups\horas-revision-AAAAMMDD-HHMM.json
   Uso (en C:\sistema-rl-verfrut\migracion):   node exportar-horas-revision.js */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const AQUI = __dirname, FN = path.join(AQUI, '..', 'azure', 'functions'), MOD = path.join(AQUI, 'node_modules');
const env = fs.existsSync(path.join(AQUI, '.env')) ? fs.readFileSync(path.join(AQUI, '.env'), 'utf8') : '';
const m = env.match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta migracion\\.env con SUPABASE_DB_URL'); process.exit(1); }
process.env.SUPABASE_DB_URL = m[1]; process.env.USAR_SUPABASE = '1';
/* los paquetes (pg) se toman de migracion\node_modules si la carpeta de funciones no los tiene */
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...r) {
  try { return orig.call(this, req, parent, ...r); }
  catch (e) { if (!/^[./]/.test(req)) { try { return orig.call(this, path.join(MOD, req), parent, ...r); } catch (e2) {} } throw e; }
};
const silencio = console.log; console.log = function () {};   /* el modulo de base escribe avisos al cargar */
const { getPool } = require(path.join(FN, 'shared', 'db'));
const TH = require(path.join(FN, 'shared', 'tablas-hoja'));
console.log = silencio;
const dos = (n) => String(n).padStart(2, '0');

(async () => {
  const pool = await getPool();
  const out = { generado: new Date().toISOString(), tablas: {} }, cuenta = {};
  for (const clave of ['horas_registros', 'horas_motivos', 'horas_horarios', 'horas_pagadas']) {
    let d = null; try { d = await TH.leer(pool, clave); } catch (e) { console.log('  (aviso) ' + clave + ': ' + e.message); }
    out.tablas[clave] = d ? { encabezado: d.encabezado, filas: d.filas } : null;
    cuenta[clave] = d ? d.filas.length : 'sin datos';
  }
  try { if (pool && pool.close) await pool.close(); } catch (e) {}
  if (!out.tablas.horas_registros) { console.error('No se pudieron leer los registros de horas. No se genero el archivo.'); process.exit(1); }
  const dir = process.env.HORAS_DIR || 'C:\\sistema-rl-backups'; fs.mkdirSync(dir, { recursive: true });
  const n = new Date(), f = path.join(dir, 'horas-revision-' + n.getFullYear() + dos(n.getMonth() + 1) + dos(n.getDate()) + '-' + dos(n.getHours()) + dos(n.getMinutes()) + '.json');
  fs.writeFileSync(f, JSON.stringify(out));
  console.log('Filas leidas: ' + JSON.stringify(cuenta));
  console.log('Archivo: ' + f + '  (' + (fs.statSync(f).size / 1024).toFixed(0) + ' KB)');
  console.log('RESULTADO: LISTO (solo lectura: no se cambio nada).');
  process.exit(0);
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
