/* ═══════════════════════════════════════════════════════════════════════════
   migracion/comparar.js — _COMPARAR_AZ_SB_V1 (05-nov-2026)
   Ejecuta las MISMAS funciones del sistema (azure\functions) dos veces:
     1) contra Azure SQL   (shared/db.js    — la conexión de hoy)
     2) contra Supabase    (shared/db-pg.js — la conexión nueva)
   y compara las respuestas campo por campo. SOLO LECTURAS: búsquedas, listas,
   historial, estadísticas, evaluaciones, permisos... No guarda nada en ninguna base.

   Uso (en C:\sistema-rl-verfrut\migracion):   node comparar.js
   Resultado en pantalla y en comparacion.json
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const AQUI = __dirname, FN = path.join(AQUI, '..', 'azure', 'functions');
const MOD = path.join(AQUI, 'node_modules');

function cargarEntorno() {
  const f = path.join(FN, 'local.settings.json');
  const v = fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')).Values || {}) : {};
  Object.keys(v).forEach(k => { if (process.env[k] === undefined) process.env[k] = String(v[k]); });
  const env = fs.existsSync(path.join(AQUI, '.env')) ? fs.readFileSync(path.join(AQUI, '.env'), 'utf8') : '';
  const m = env.match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m); if (m) process.env.SUPABASE_DB_URL = m[1];
}

/* ── casos de prueba (solo lectura). {DNI}, {NOMBRE}, {SUP} se reemplazan con datos reales ── */
const CASOS = [
  ['Buscar trabajador por DNI', 'trabajadores-search', 'GET', { dni: '{DNI_TRAB}' }],
  ['Buscar trabajador por nombre', 'trabajadores-search', 'GET', { q: '{NOMBRE}' }],
  ['Buscar DNI que no existe', 'trabajadores-search', 'GET', { dni: '00000001' }],
  ['Historial por DNI', 'atenciones-by-dni', 'GET', { dni: '{DNI_AT}', dias: '365' }],
  ['Lista de atenciones (pág. 1)', 'atenciones-list', 'GET', { limit: '50', page: '1' }],
  ['Estadísticas generales', 'atenciones-stats', 'GET', {}],
  ['Estadísticas de un supervisor', 'atenciones-stats', 'GET', { supervisor: '{SUP}' }],
  ['Lista de usuarios', 'usuarios-lista', 'GET', {}],
  ['Vigía (marcas de cambios)', 'vigia', 'GET', {}, { accion: 'marcas' }],
  ['Evaluaciones ETI (estadísticas)', 'eti-eval-stats', 'GET', {}],
  ['Supervisores', 'mod', 'POST', {}, { modulo: 'sup', accion: 'getSupervisores' }],
  ['Fusiones de buses', 'mod', 'POST', {}, { modulo: 'fus', accion: 'getFusiones' }],
  ['Solicitudes de edición', 'mod', 'POST', {}, { modulo: 'sol', accion: 'getSolicitudes' }],
  ['Casos', 'cv', 'POST', {}, { accion: 'getCasos' }],
  ['Visitas', 'cv', 'POST', {}, { accion: 'getVisitas' }],
  ['Cumplimiento (panel)', 'cumpl', 'POST', {}, { accion: 'cumplPanel' }],
  ['Cumplimiento (pendientes)', 'cumpl', 'POST', {}, { accion: 'cumplPendientes' }],
  ['Cumplimiento (datos)', 'cumpl', 'POST', {}, { accion: 'getCumplimiento' }],
  ['Permisos por módulo', 'acceso', 'POST', {}, { accion: 'permisosListar' }],
  ['Horarios de acceso', 'acceso', 'POST', {}, { accion: 'accesoHorarioListar' }],
  ['KPI tablero', 'kpi', 'POST', {}, { accion: 'tablero' }],
  ['Evaluaciones 360', 'e360-guardar', 'POST', {}, { accion: 'getEvaluaciones360' }],
  ['Compromiso (estado)', 'compromiso', 'POST', {}, { accion: 'estado' }],
  ['Seguridad de usuarios', 'compromiso', 'POST', {}, { accion: 'lista' }]
];

/* ── modo hijo: ejecuta los casos con un motor y escribe el resultado ── */
async function hijo(motor, valores, salida) {
  const Module = require('module');
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (req, parent, ...r) {
    if (motor === 'supabase' && /(^|\/)shared\/db$|^\.\/db$/.test(req.replace(/\\/g, '/')) && parent && parent.filename.startsWith(FN))
      return path.join(FN, 'shared', 'db-pg.js');
    return orig.call(this, req, parent, ...r);
  };
  const jwt = require('jsonwebtoken');
  const tk = 'Bearer ' + jwt.sign({ usuario: 'jtimoteo', nombre: 'JOEL TIMOTEO', rol: 'administrador', empresa: 'AMBAS' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const out = [];
  for (const [nombre, fn, metodo, q, bd] of CASOS) {
    const query = {}; Object.keys(q).forEach(k => { query[k] = String(q[k]).replace(/\{(\w+)\}/g, (m, x) => valores[x] || ''); });
    const ctx = { res: null, bindingData: Object.assign({}, bd || {}), log: Object.assign(() => {}, { warn: () => {}, error: () => {}, info: () => {} }) };
    const req = { method: metodo, headers: { authorization: tk }, query, params: Object.assign({}, bd || {}), body: metodo === 'POST' ? {} : undefined, url: 'https://local/api/' + fn };
    const t0 = Date.now();
    try { await require(path.join(FN, fn, 'index.js'))(ctx, req); out.push({ nombre, ms: Date.now() - t0, status: ctx.res && ctx.res.status, body: ctx.res && ctx.res.body }); }
    catch (e) { out.push({ nombre, ms: Date.now() - t0, error: e.message }); }
  }
  fs.writeFileSync(salida, JSON.stringify(out));
  setTimeout(() => process.exit(0), 200);
}

/* ── normalizar para comparar: sin tiempos de ejecución, fechas a texto, objetos con claves ordenadas ── */
const VOLATILES = /^(elapsed_ms|elapsed|ms|tiempo|ahora|generado|calculado|cache|cacheado|fuente|servidor|_debug|ts)$/i;
function norm(v) {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach(k => { if (!VOLATILES.test(k)) o[k] = norm(v[k]); }); return o; }
  if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 1e6) / 1e6;
  return v;
}
function primeraDiferencia(a, b, ruta) {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return ruta + ': ' + a.length + ' elementos en Azure vs ' + b.length + ' en Supabase';
    const sa = a.map(x => JSON.stringify(x)).sort(), sb = b.map(x => JSON.stringify(x)).sort();
    if (JSON.stringify(sa) === JSON.stringify(sb)) return 'ORDEN';
    for (let i = 0; i < a.length; i++) { const d = primeraDiferencia(a[i], b[i], ruta + '[' + i + ']'); if (d) return d; }
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = primeraDiferencia(a[k], b[k], ruta + '.' + k); if (d) return d; }
  }
  const t = (x) => x === undefined ? '(no viene)' : String(JSON.stringify(x)).slice(0, 80);
  return ruta + ': Azure=' + t(a) + ' | Supabase=' + t(b);
}

async function principal() {
  /* valores reales para las pruebas, tomados de Azure */
  const sql = require('mssql');
  const az = await new sql.ConnectionPool({ server: process.env.SQL_SERVER, database: process.env.SQL_DATABASE, user: process.env.SQL_USER, password: process.env.SQL_PASSWORD, options: { encrypt: true } }).connect();
  const q1 = async (t) => { try { return (await az.request().query(t)).recordset[0] || {}; } catch (e) { return {}; } };
  const valores = {
    DNI_TRAB: (await q1("SELECT TOP 1 dni FROM dbo.Trabajadores_RAPEL WHERE LEN(dni) = 8 ORDER BY dni")).dni,
    NOMBRE: String((await q1("SELECT TOP 1 nombre_completo FROM dbo.Trabajadores_VERFRUT WHERE nombre_completo LIKE '% %' ORDER BY dni")).nombre_completo || '').split(' ')[0],
    DNI_AT: (await q1("SELECT TOP 1 dni FROM dbo.Atenciones WHERE fecha_atencion >= DATEADD(day, -30, GETDATE()) GROUP BY dni ORDER BY COUNT(*) DESC")).dni,
    SUP: (await q1("SELECT TOP 1 supervisor FROM dbo.Atenciones WHERE supervisor <> '' GROUP BY supervisor ORDER BY COUNT(*) DESC")).supervisor
  };
  await az.close();
  console.log('Datos de prueba (reales):', JSON.stringify(valores));
  const res = {};
  for (const motor of ['azure', 'supabase']) {
    process.stdout.write('Ejecutando ' + CASOS.length + ' consultas contra ' + motor.toUpperCase() + '... ');
    const sal = path.join(AQUI, '_res_' + motor + '.json');
    const r = cp.spawnSync(process.execPath, [__filename, '--hijo', motor, JSON.stringify(valores), sal], { env: Object.assign({}, process.env, { NODE_PATH: MOD }), encoding: 'utf8', timeout: 600000 });
    if (!fs.existsSync(sal)) { console.log('\n❌ ' + motor + ' no terminó: ' + (r.stderr || r.error || '').toString().slice(0, 400)); return; }
    res[motor] = JSON.parse(fs.readFileSync(sal, 'utf8')); fs.unlinkSync(sal); console.log('listo');
  }
  let iguales = 0, orden = 0, dif = 0;
  const informe = [];
  console.log('\n' + 'CONSULTA'.padEnd(36) + 'AZURE'.padEnd(14) + 'SUPABASE'.padEnd(14) + 'RESULTADO');
  CASOS.forEach((c, i) => {
    const a = res.azure[i], b = res.supabase[i];
    const ea = a.error ? 'ERROR' : (a.status || '?') + ' ' + a.ms + 'ms', eb = b.error ? 'ERROR' : (b.status || '?') + ' ' + b.ms + 'ms';
    let r;
    if (b.error || a.error) r = '❌ ' + (b.error ? 'Supabase: ' + b.error : 'Azure: ' + a.error);
    else if (a.status !== b.status) r = '❌ estado distinto (' + a.status + ' vs ' + b.status + ') ' + String(JSON.stringify(b.body)).slice(0, 120);
    else { const d = primeraDiferencia(norm(a.body), norm(b.body), 'respuesta'); r = !d ? '✅ igual' : d === 'ORDEN' ? '🟡 mismos datos, otro orden' : '⚠️ ' + d; }
    if (r.startsWith('✅')) iguales++; else if (r.startsWith('🟡')) orden++; else dif++;
    console.log(c[0].padEnd(36) + ea.padEnd(14) + eb.padEnd(14) + r);
    const det = r.startsWith('✅') ? {} : { azureBody: a.body, supabaseBody: b.body };   /* respuestas completas de las que no coinciden */
    informe.push(Object.assign({ consulta: c[0], azure: { status: a.status, ms: a.ms, error: a.error }, supabase: { status: b.status, ms: b.ms, error: b.error }, resultado: r }, det));
  });
  console.log('\nRESUMEN: ✅ ' + iguales + ' iguales · 🟡 ' + orden + ' mismo contenido en otro orden · ❌/⚠️ ' + dif + ' con diferencias');
  console.log('Nota: si en Azure se registró algo DESPUÉS de copiar los datos, esas consultas pueden diferir por eso (no es un error).');
  fs.writeFileSync(path.join(AQUI, 'comparacion.json'), JSON.stringify({ fecha: new Date().toISOString(), valores, informe }, null, 1));
}

cargarEntorno();
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = crypto.randomBytes(24).toString('hex');   /* solo para firmar el token de prueba */
if (process.argv[2] === '--hijo') hijo(process.argv[3], JSON.parse(process.argv[4]), process.argv[5]).catch(e => { console.error(e); process.exit(1); });
else principal().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
