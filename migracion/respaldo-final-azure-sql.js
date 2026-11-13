/* ═══════════════════════════════════════════════════════════════════════════
   migracion/respaldo-final-azure-sql.js — _RESPALDO_FINAL_AZURE_V1 (12-nov-2026)
   Copia COMPLETA y final de la base Azure SQL a archivos en ESTE equipo, antes de borrarla.
   SOLO LECTURA en Azure: no cambia ni borra nada alli.

   Que guarda (en C:\respaldos-rl\azure-sql-final-AAAAMMDD-HHMM\):
     · tablas\<esquema>.<tabla>.ndjson.gz   una fila por linea (JSON), comprimido
     · esquema.json                         columnas y tipos de cada tabla
     · objetos.sql                          vistas, procedimientos, funciones y disparadores
     · manifiesto.json                      filas, tamaño y huella (sha256) de cada archivo
   Al final vuelve a contar cada tabla en Azure y compara con lo que escribio.
   Solo dice "RESPALDO COMPLETO" si TODAS coinciden.

   La carpeta queda FUERA del proyecto a proposito: el repositorio es publico y esto tiene DNIs.
   Uso (en C:\sistema-rl-verfrut\migracion):   node respaldo-final-azure-sql.js
   La conexion sale de azure\functions\local.settings.json (no se muestra ninguna clave).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const AQUI = __dirname, FUNCS = path.join(AQUI, '..', 'azure', 'functions');
function req(m) { try { return require(m); } catch (e) { try { return require(path.join(FUNCS, 'node_modules', m)); } catch (e2) { console.error('Falta el paquete "' + m + '". Ejecuta:  npm install   (en esta carpeta)'); process.exit(1); } } }
const mssql = req('mssql');

function leerAzure() {
  const f = path.join(FUNCS, 'local.settings.json');
  if (!fs.existsSync(f)) { console.error('No encuentro ' + f); process.exit(1); }
  const v = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')).Values || {};
  for (const k of ['SQL_SERVER', 'SQL_DATABASE', 'SQL_USER', 'SQL_PASSWORD']) if (!v[k]) { console.error('Falta ' + k + ' en local.settings.json'); process.exit(1); }
  return { server: v.SQL_SERVER, database: v.SQL_DATABASE, user: v.SQL_USER, password: v.SQL_PASSWORD,
           options: { encrypt: true, trustServerCertificate: false, connectTimeout: 60000, requestTimeout: 900000 } };
}
function leerSupabase() {
  try { const t = fs.readFileSync(path.join(AQUI, '.env'), 'utf8'); const m = t.match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m); return m ? m[1] : null; } catch (e) { return null; }
}

const dos = (n) => String(n).padStart(2, '0');
const sello = (d) => d.getFullYear() + dos(d.getMonth() + 1) + dos(d.getDate()) + '-' + dos(d.getHours()) + dos(d.getMinutes());
const limpio = (s) => String(s).replace(/[^A-Za-z0-9_.-]/g, '_');
/* JSON fiel: fechas en ISO, binarios en base64, numeros enormes como texto */
function aJson(fila) {
  return JSON.stringify(fila, function (k, v) {
    const o = this[k];
    if (o instanceof Date) return isNaN(o.getTime()) ? null : { $fecha: o.toISOString() };
    if (Buffer.isBuffer(o)) return { $bin: o.toString('base64') };
    if (typeof v === 'bigint') return String(v);
    return v;
  });
}

/* baja una tabla completa a un .ndjson.gz, sin cargarla entera en memoria */
function bajarTabla(pool, t, destino) {
  return new Promise((ok, mal) => {
    const gz = zlib.createGzip({ level: 6 }), sal = fs.createWriteStream(destino), huella = crypto.createHash('sha256');
    let filas = 0, fin = false;
    const fallar = (e) => { if (fin) return; fin = true; try { sal.destroy(); } catch (x) {} mal(e); };
    gz.on('data', (c) => huella.update(c)); gz.on('error', fallar); sal.on('error', fallar);
    gz.pipe(sal);
    sal.on('finish', () => { if (fin) return; fin = true; ok({ filas, sha256: huella.digest('hex'), bytes: fs.statSync(destino).size }); });
    const r = pool.request(); r.stream = true;
    r.on('row', (fila) => { filas++; if (!gz.write(aJson(fila) + '\n')) { r.pause(); gz.once('drain', () => r.resume()); } });
    r.on('error', fallar);
    r.on('done', () => gz.end());
    r.query('SELECT * FROM [' + t.esquema.replace(/]/g, ']]') + '].[' + t.nombre.replace(/]/g, ']]') + ']');
  });
}

(async () => {
  const t0 = Date.now();
  const base = process.env.RESPALDO_DIR || 'C:\\respaldos-rl';
  const dir = path.join(base, 'azure-sql-final-' + sello(new Date())), dirT = path.join(dir, 'tablas');
  const cfg = leerAzure();
  console.log('Respaldo final de Azure SQL  ·  base: ' + cfg.database + '  ·  servidor: ' + cfg.server);
  let pool;
  try { pool = await new mssql.ConnectionPool(cfg).connect(); }
  catch (e) {
    console.error('\nNO SE PUDO CONECTAR A AZURE SQL: ' + e.message);
    if (/firewall|not allowed to access|Client with IP/i.test(e.message)) console.error('  -> El firewall de Azure SQL no permite la IP de este equipo. No se cambio nada. Avisa y se agrega la IP.');
    console.error('RESULTADO: NO SE HIZO EL RESPALDO. No borres la base.'); process.exit(1);
  }
  fs.mkdirSync(dirT, { recursive: true });
  console.log('Carpeta: ' + dir + '\n');

  const tablas = (await pool.request().query(`SELECT s.name AS esquema, t.name AS nombre FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
                                               WHERE t.is_ms_shipped = 0 ORDER BY s.name, t.name`)).recordset;
  const cols = (await pool.request().query(`SELECT TABLE_SCHEMA AS esquema, TABLE_NAME AS tabla, COLUMN_NAME AS columna, ORDINAL_POSITION AS pos, DATA_TYPE AS tipo,
                                             CHARACTER_MAXIMUM_LENGTH AS largo, NUMERIC_PRECISION AS prec, NUMERIC_SCALE AS escala, IS_NULLABLE AS nulo, COLUMN_DEFAULT AS defecto
                                             FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`)).recordset;
  fs.writeFileSync(path.join(dir, 'esquema.json'), JSON.stringify({ base: cfg.database, fecha: new Date().toISOString(), tablas, columnas: cols }, null, 1));
  let objetos = [];
  try {
    objetos = (await pool.request().query(`SELECT s.name AS esquema, o.name AS nombre, o.type_desc AS tipo, m.definition AS def FROM sys.sql_modules m
                                            JOIN sys.objects o ON o.object_id = m.object_id JOIN sys.schemas s ON s.schema_id = o.schema_id WHERE o.is_ms_shipped = 0 ORDER BY o.type_desc, o.name`)).recordset;
    fs.writeFileSync(path.join(dir, 'objetos.sql'), objetos.map(o => '-- ' + o.tipo + ' ' + o.esquema + '.' + o.nombre + '\n' + (o.def || '-- (definicion no disponible)') + '\nGO\n').join('\n'));
  } catch (e) { console.log('  (aviso) no se pudieron leer vistas/procedimientos: ' + e.message); }

  console.log('Tablas a copiar: ' + tablas.length + '   ·   vistas/procedimientos/funciones: ' + objetos.length + '\n');
  const manifiesto = [], problemas = [];
  for (const t of tablas) {
    const nombre = t.esquema + '.' + t.nombre, archivo = limpio(nombre) + '.ndjson.gz';
    let r = null, err = null;
    for (let intento = 1; intento <= 3 && !r; intento++) {
      try { r = await bajarTabla(pool, t, path.join(dirT, archivo)); }
      catch (e) { err = e; if (intento < 3) { await new Promise(z => setTimeout(z, 3000));
        try { if (!pool.connected) pool = await new mssql.ConnectionPool(cfg).connect(); } catch (e2) {} } }
    }
    let enAzure = null;
    try { enAzure = Number((await pool.request().query('SELECT COUNT_BIG(*) AS n FROM [' + t.esquema.replace(/]/g, ']]') + '].[' + t.nombre.replace(/]/g, ']]') + ']')).recordset[0].n); } catch (e) { err = err || e; }
    const bien = !!r && enAzure !== null && r.filas === enAzure;
    manifiesto.push({ tabla: nombre, archivo: 'tablas/' + archivo, filas: r ? r.filas : null, filasEnAzure: enAzure, bytes: r ? r.bytes : null, sha256: r ? r.sha256 : null, ok: bien, error: bien ? null : (err ? err.message : 'no coincide el conteo') });
    if (!bien) problemas.push(nombre);
    console.log((bien ? ' OK   ' : ' MAL  ') + nombre.padEnd(46) + ' filas=' + String(r ? r.filas : '?').padStart(8) + '  en Azure=' + String(enAzure === null ? '?' : enAzure).padStart(8) + (bien ? '' : '   <-- ' + (err ? err.message.slice(0, 90) : 'no coincide')));
  }
  try { await pool.close(); } catch (e) {}

  /* informativo: cuantas filas tiene hoy la misma tabla en Supabase (el sistema vivo) */
  const url = leerSupabase(); let sb = null;
  if (url) {
    try {
      const { Client } = req('pg'); const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } }); await c.connect();
      sb = {};
      const ex = (await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'rl'")).rows.map(x => x.table_name);
      for (const m of manifiesto) { const n = m.tabla.split('.').pop().toLowerCase(); if (ex.indexOf(n) < 0) { sb[m.tabla] = null; continue; }
        try { sb[m.tabla] = Number((await c.query('SELECT COUNT(*) AS n FROM rl."' + n.replace(/"/g, '""') + '"')).rows[0].n); } catch (e) { sb[m.tabla] = null; } }
      await c.end();
      manifiesto.forEach(m => { m.filasEnSupabase = sb[m.tabla]; });
    } catch (e) { console.log('\n(aviso) no se pudo consultar Supabase para comparar: ' + e.message); sb = null; }
  }

  const totalFilas = manifiesto.reduce((a, m) => a + (m.filas || 0), 0), totalBytes = manifiesto.reduce((a, m) => a + (m.bytes || 0), 0);
  fs.writeFileSync(path.join(dir, 'manifiesto.json'), JSON.stringify({ base: cfg.database, servidor: cfg.server, fecha: new Date().toISOString(), tablas: manifiesto.length, filas: totalFilas, bytes: totalBytes, completo: problemas.length === 0, archivos: manifiesto }, null, 1));

  if (sb) {
    const menos = manifiesto.filter(m => m.filasEnSupabase !== null && m.filasEnSupabase !== undefined && m.filasEnSupabase < m.filas);
    const sinPar = manifiesto.filter(m => m.filasEnSupabase === null || m.filasEnSupabase === undefined);
    console.log('\n--- Comparacion informativa con Supabase (el sistema vivo) ---');
    console.log('Tablas con igual o MAS filas en Supabase: ' + (manifiesto.length - menos.length - sinPar.length) + ' de ' + manifiesto.length);
    if (menos.length) { console.log('Tablas con MENOS filas en Supabase que en Azure (revisar antes de borrar):'); menos.forEach(m => console.log('   ' + m.tabla.padEnd(46) + ' Azure=' + m.filas + '  Supabase=' + m.filasEnSupabase)); }
    if (sinPar.length) console.log('Tablas de Azure que no existen en Supabase (quedan solo en este respaldo): ' + sinPar.map(m => m.tabla.split('.').pop() + '(' + m.filas + ')').join(', '));
  }

  console.log('\nTablas: ' + manifiesto.length + '   Filas: ' + totalFilas + '   Tamaño: ' + (totalBytes / 1048576).toFixed(1) + ' MB   Tiempo: ' + Math.round((Date.now() - t0) / 1000) + ' s');
  console.log('Carpeta del respaldo: ' + dir);
  if (problemas.length) { console.log('\nRESULTADO: RESPALDO INCOMPLETO (' + problemas.length + ' tabla(s) con problema: ' + problemas.join(', ') + '). NO BORRES LA BASE.'); process.exit(2); }
  console.log('\nRESULTADO: RESPALDO COMPLETO (todas las tablas coinciden con Azure).');
})().catch(e => { console.error('\nERROR: ' + e.message + '\nRESULTADO: NO SE HIZO EL RESPALDO. No borres la base.'); process.exit(1); });
