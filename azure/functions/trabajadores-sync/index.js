const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

// Helper: parsea fechas que pueden venir como Date, string ISO, o número serial de Sheets
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // Sheets/Excel: días desde 30-dic-1899
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: convierte a string y trimea
function s(v, max) {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  if (str === '') return null;
  return max && str.length > max ? str.substring(0, max) : str;
}

// Helper: convierte a entero
function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

/* ═══════════════════════════════════════════════════════════════════════════
   _SYNC_INCREMENTAL_V1 (24-set-2026)
   ANTES: DELETE de TODA la tabla + recarga completa en una transaccion larga ->
          la base (S1) se saturaba varios minutos y el login, la busqueda por DNI
          y los guardados se ponian lentos o fallaban para todos.
   AHORA: 1) lo recibido se carga en la tabla de trabajo dbo.<tabla>_stage (ver _STAGE_PERM_V1);
          2) se comparan filas completas: solo se borran las que cambiaron o ya no
             estan y se insertan las nuevas o cambiadas. Lo que no cambio NO se toca;
          3) FRENO: si llegan menos de la mitad de los trabajadores que ya hay, se
             aborta sin tocar nada (proteccion ante una lectura incompleta);
          4) si algo falla -> rollback: la tabla real queda intacta.
   Mismas columnas, misma entrada y mismas claves de respuesta que antes.
   ═══════════════════════════════════════════════════════════════════════════ */
const COLS = [
  ['dni', 'NVARCHAR(20) NOT NULL', () => sql.NVarChar(20)],
  ['ap_paterno', 'NVARCHAR(100) NULL', () => sql.NVarChar(100)],
  ['ap_materno', 'NVARCHAR(100) NULL', () => sql.NVarChar(100)],
  ['nombres', 'NVARCHAR(150) NULL', () => sql.NVarChar(150)],
  ['codigo_trab', 'NVARCHAR(50) NULL', () => sql.NVarChar(50)],
  ['fecha_inicio', 'DATE NULL', () => sql.Date],
  ['sexo', 'NCHAR(1) NULL', () => sql.NChar(1)],
  ['oficio', 'NVARCHAR(150) NULL', () => sql.NVarChar(150)],
  ['tipo_regimen', 'NVARCHAR(50) NULL', () => sql.NVarChar(50)],
  ['id_empresa', 'NVARCHAR(50) NULL', () => sql.NVarChar(50)],
  ['zona_labor', 'NVARCHAR(150) NULL', () => sql.NVarChar(150)],
  ['direccion', 'NVARCHAR(255) NULL', () => sql.NVarChar(255)],
  ['total', 'INT NULL', () => sql.Int],
  ['empresa', 'NVARCHAR(20) NULL', () => sql.NVarChar(20)],
  ['nombre_completo', 'NVARCHAR(300) NULL', () => sql.NVarChar(300)],
  ['ruta', 'NVARCHAR(100) NULL', () => sql.NVarChar(100)],
  ['cod', 'NVARCHAR(50) NULL', () => sql.NVarChar(50)],
  ['fecha_termino', 'DATE NULL', () => sql.Date],
  ['fecha_nacimiento', 'DATE NULL', () => sql.Date]
];
const LISTA = COLS.map(c => c[0]).join(', ');
const ST = COLS.map(c => 's.' + c[0]).join(', ');
const TT = COLS.map(c => 't.' + c[0]).join(', ');

function filaDe(row) {
  const dni = s(row.dni, 20);
  if (!dni) return null;
  return [dni, s(row.ap_paterno, 100), s(row.ap_materno, 100), s(row.nombres, 150), s(row.codigo_trab, 50),
          parseDate(row.fecha_inicio), s(row.sexo, 1), s(row.oficio, 150), s(row.tipo_regimen, 50), s(row.id_empresa, 50),
          s(row.zona_labor, 150), s(row.direccion, 255), toInt(row.total), s(row.empresa, 20), s(row.nombre_completo, 300),
          s(row.ruta, 100), s(row.cod, 50), parseDate(row.fecha_termino), parseDate(row.fecha_nacimiento)];
}

/* _STAGE_PERM_V1 (24-set-2026): la carga a tabla temporal fallo en Azure SQL
   (EREQUEST sin mensaje). Ahora se usa una tabla de trabajo PERMANENTE dbo.<tabla>_stage,
   cargada con el mismo metodo (bulk a tabla existente) que siempre funciono.
   Cada paso tiene nombre para que un error diga exactamente donde fallo.
   Si el modo incremental falla, se usa el metodo ANTIGUO (probado) como respaldo. */
function detalleError(e) {
  const partes = [];
  if (e && e.message) partes.push(e.message);
  if (e && e.originalError && e.originalError.message) partes.push(e.originalError.message);
  if (e && e.originalError && e.originalError.info && e.originalError.info.message) partes.push(e.originalError.info.message);
  if (e && Array.isArray(e.precedingErrors)) e.precedingErrors.forEach(x => x && x.message && partes.push(x.message));
  const unico = partes.filter((v, i, a) => v && a.indexOf(v) === i);
  return unico.join(' | ') || String(e);
}

function tablaBulk(nombre, filas) {
  const tabla = new sql.Table(nombre);
  tabla.create = false;
  COLS.forEach(c => tabla.columns.add(c[0], c[2](), { nullable: c[0] !== 'dni' }));
  filas.forEach(f => tabla.rows.add.apply(tabla.rows, f));
  return tabla;
}

async function syncIncremental(pool, tableName, filas, rows, descartados) {
  const STG = tableName + '_stage';
  let paso = 'crear_stage';
  try {
    /* 0) tabla de trabajo (fuera de la transaccion; solo se crea la primera vez) */
    await pool.request().query(`IF OBJECT_ID('dbo.${STG}', 'U') IS NULL
      CREATE TABLE dbo.${STG} (${COLS.map(c => c[0] + ' ' + c[1]).join(', ')})`);
    paso = 'vaciar_stage';
    await pool.request().query(`DELETE FROM dbo.${STG}`);
    paso = 'cargar_stage';
    await pool.request().bulk(tablaBulk(STG, filas));
  } catch (e) { e._paso = paso; throw e; }

  const transaction = new sql.Transaction(pool);
  paso = 'iniciar_transaccion';
  await transaction.begin();
  try {
    const q = (txt) => transaction.request().query(txt);
    paso = 'config'; await q('SET DEADLOCK_PRIORITY LOW; SET LOCK_TIMEOUT 20000;');

    paso = 'contar';
    const actual = (await q(`SELECT COUNT(*) AS n FROM dbo.${tableName}`)).recordset[0].n;
    if (actual > 100 && filas.length < actual * 0.5) {
      await transaction.rollback();
      return { total_recibidos: rows.length, inserted: 0, eliminados: 0, sin_cambios: actual,
               descartados_sin_dni: descartados, abortado: true,
               motivo: 'Llegaron ' + filas.length + ' filas y la tabla tiene ' + actual + ': posible lectura incompleta, no se toco nada' };
    }

    paso = 'borrar_cambiados';
    const del = await q(`DELETE t FROM dbo.${tableName} t
      WHERE NOT EXISTS (SELECT 1 FROM dbo.${STG} s WHERE s.dni = t.dni AND EXISTS (SELECT ${ST} INTERSECT SELECT ${TT}))`);

    paso = 'insertar_nuevos';
    const ins = await q(`INSERT INTO dbo.${tableName} (${LISTA})
      SELECT ${ST} FROM dbo.${STG} s
      WHERE NOT EXISTS (SELECT 1 FROM dbo.${tableName} t WHERE t.dni = s.dni AND EXISTS (SELECT ${ST} INTERSECT SELECT ${TT}))`);

    paso = 'confirmar';
    await transaction.commit();

    const eliminados = (del.rowsAffected && del.rowsAffected[0]) || 0;
    const insertados = (ins.rowsAffected && ins.rowsAffected[0]) || 0;
    return { total_recibidos: rows.length, inserted: insertados, eliminados: eliminados,
             sin_cambios: Math.max(0, actual - eliminados), descartados_sin_dni: descartados, modo: 'incremental' };
  } catch (err) {
    try { await transaction.rollback(); } catch (e2) {}
    err._paso = paso;
    throw err;
  }
}

/* Metodo ANTIGUO (el que funciono siempre): vaciar + recargar, en una transaccion. */
async function syncCompleto(pool, tableName, filas, rows, descartados) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await transaction.request().query(`DELETE FROM dbo.${tableName}`);
    const r = await transaction.request().bulk(tablaBulk(tableName, filas));
    await transaction.commit();
    return { total_recibidos: rows.length, inserted: r.rowsAffected, descartados_sin_dni: descartados, modo: 'completo' };
  } catch (err) {
    try { await transaction.rollback(); } catch (e2) {}
    err._paso = 'completo';
    throw err;
  }
}

async function syncTabla(pool, tableName, rows, log) {
  if (!rows || rows.length === 0) return { inserted: 0, total_recibidos: 0 };
  if (!/^Trabajadores_(RAPEL|VERFRUT)$/.test(tableName)) throw new Error('Tabla no permitida: ' + tableName);

  const filas = []; let descartados = 0;
  for (const row of rows) { const f = filaDe(row); if (f) filas.push(f); else descartados++; }

  try {
    return await syncIncremental(pool, tableName, filas, rows, descartados);
  } catch (e) {
    const motivo = 'paso ' + (e._paso || '?') + ': ' + detalleError(e);
    if (log) log.warn('Incremental fallo en ' + tableName + ' (' + motivo + ') -> uso metodo completo');
    /* FRENO tambien en el respaldo: nunca vaciar por una lectura incompleta */
    const actual = (await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.${tableName}`)).recordset[0].n;
    if (actual > 100 && filas.length < actual * 0.5) {
      return { total_recibidos: rows.length, inserted: 0, abortado: true, incremental_error: motivo,
               motivo: 'Llegaron ' + filas.length + ' filas y la tabla tiene ' + actual + ': no se toco nada' };
    }
    const r = await syncCompleto(pool, tableName, filas, rows, descartados);
    r.incremental_error = motivo;
    return r;
  }
}

module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  context.log('trabajadores-sync triggered');
  const startTime = Date.now();

  try {
    const body = req.body || {};
    const rapel = Array.isArray(body.rapel) ? body.rapel : null;
    const verfrut = Array.isArray(body.verfrut) ? body.verfrut : null;

    if (!rapel && !verfrut) {
      context.res = {
        status: 400,
        body: {
          success: false,
          error: 'Debe enviar al menos uno de los arrays: rapel o verfrut'
        }
      };
      return;
    }

    const pool = await getPool();
    const results = {};

    if (rapel)   results.rapel   = await syncTabla(pool, 'Trabajadores_RAPEL', rapel, context.log);
    if (verfrut) results.verfrut = await syncTabla(pool, 'Trabajadores_VERFRUT', verfrut, context.log);

    const elapsed = Date.now() - startTime;
    context.log('Sync completado en', elapsed, 'ms');

    context.res = {
      status: 200,
      body: {
        success: true,
        results: results,
        elapsed_ms: elapsed,
        fuente: 'AZURE_SQL'
      }
    };
  } catch (e) {
    context.log.error('Error en trabajadores-sync:', e);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: detalleError(e),
        paso: e._paso || null,
        code: e.code,
        name: e.name
      }
    };
  }
};