/* ═══════════════════════════════════════════════════════════════════════════
   db-indices  (_INDICES_V1, 25-set-2026)
   Revisa y crea los INDICES que necesitan las consultas del sistema.
   Sin indices, cada busqueda y cada estadistica recorre la tabla completa
   (eso es lo que satura la base S1 en las horas pico).

   GET  /api/mantenimiento/indices              -> SOLO INFORMA (no cambia nada)
   POST /api/mantenimiento/indices?aplicar=1    -> crea los que falten (ONLINE,
                                                   sin bloquear a los usuarios)
   Requiere la llave de la funcion (x-functions-key). Nunca borra nada.
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');

/* nombre, tabla, primera columna clave (si ya hay un indice que empiece por
   esa columna, NO se crea otro), definicion */
const INDICES = [
  ['IX_At_fecha_id',  'Atenciones', 'fecha_atencion', '(fecha_atencion DESC, id DESC)', ''],
  ['IX_At_dni_fecha', 'Atenciones', 'dni',            '(dni, fecha_atencion DESC)', 'INCLUDE (estado, nro)'],
  ['IX_At_nro_anio',  'Atenciones', 'nro',            '(nro, anio)', 'INCLUDE (dni)'],
  /* _INDICES_V2 (24-oct-2026): los 3 filtros que atenciones-list usa a cada rato y recorrian la tabla entera */
  ['IX_At_usuario_fecha',    'Atenciones', 'usuario_sistema', '(usuario_sistema, fecha_atencion DESC)', 'INCLUDE (id)'],
  ['IX_At_modificado',       'Atenciones', 'modificado',      '(modificado DESC)', 'INCLUDE (id)'],
  ['IX_At_supervisor_fecha', 'Atenciones', 'supervisor',      '(supervisor, fecha_atencion DESC)', 'INCLUDE (id)'],
  /* primera = null -> se revisa por NOMBRE: el indice (anio, mes) que ya existe no es
     "cubriente" y las estadisticas igual leen las filas completas */
  ['IX_At_stats',     'Atenciones', null,             '(anio, mes)', 'INCLUDE (fecha_atencion, estado, empresa, supervisor, detalle_documento, usuario_sistema)'],
  ['IX_TR_dni',       'Trabajadores_RAPEL',   'dni', '(dni)', ''],
  ['IX_TV_dni',       'Trabajadores_VERFRUT', 'dni', '(dni)', '']
];

async function informe(pool) {
  const r = await pool.request().query(`
    SELECT t.name AS tabla, SUM(p.rows) AS filas
    FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
    WHERE t.name IN ('Atenciones','Trabajadores_RAPEL','Trabajadores_VERFRUT','Usuarios')
    GROUP BY t.name;
    SELECT t.name AS tabla, i.name AS indice, i.type_desc AS tipo,
      STUFF((SELECT ', ' + c.name FROM sys.index_columns ic JOIN sys.columns c
             ON c.object_id = ic.object_id AND c.column_id = ic.column_id
             WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
             ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 2, '') AS columnas
    FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
    WHERE t.name IN ('Atenciones','Trabajadores_RAPEL','Trabajadores_VERFRUT','Usuarios') AND i.type > 0
    ORDER BY t.name, i.name;
    SELECT t.name AS tabla, c.name AS columna, ty.name AS tipo, c.max_length
    FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE t.name IN ('Atenciones','Trabajadores_RAPEL','Trabajadores_VERFRUT')
      AND c.name IN ('dni','fecha_atencion','nro','anio','mes','supervisor','usuario_sistema','estado','empresa','detalle_documento','id','modificado');
    SELECT TOP 1 service_objective = DATABASEPROPERTYEX(DB_NAME(), 'ServiceObjective');
  `);
  const rs = r.recordsets;
  return { filas: rs[0], indices: rs[1], columnas: rs[2], plan: rs[3] && rs[3][0] && rs[3][0].service_objective };
}

async function yaCubierto(pool, tabla, primera) {
  const r = await pool.request().input('t', sql.NVarChar, tabla).input('c', sql.NVarChar, primera).query(`
    SELECT COUNT(*) AS n FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = 1
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.' + @t) AND c.name = @c AND i.type > 0`);
  return r.recordset[0].n > 0;
}

/* _FASE3_V1 (05-nov-2026): en Supabase (Postgres) mismo informe y mismos indices, con el catalogo de Postgres.
   CREATE INDEX CONCURRENTLY no bloquea a los usuarios (equivale a ONLINE = ON). Nunca borra nada. */
async function indicesPg(context, req, t0) {
  const pool = await getPool();
  const aplicar = req.method === 'POST' && String((req.query && req.query.aplicar) || '') === '1';
  const acciones = [];
  for (const [nombre, tabla, primera, claves, incluye] of INDICES) {
    const t = tabla.toLowerCase(), n = nombre.toLowerCase();
    const existe = (await pool.request().input('t', sql.NVarChar, t).query(`SELECT COUNT(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = current_schema() AND c.relname = @t AND c.relkind = 'r'`)).recordset[0].n > 0;
    if (!existe) { acciones.push({ indice: nombre, estado: 'tabla no existe' }); continue; }
    if (primera === null) {
      const ya = (await pool.request().input('n', sql.NVarChar, n).query(`SELECT COUNT(*)::int AS n FROM pg_indexes WHERE schemaname = current_schema() AND indexname = @n`)).recordset[0].n > 0;
      if (ya) { acciones.push({ indice: nombre, estado: 'ya existe' }); continue; }
    } else {
      const cub = (await pool.request().input('t', sql.NVarChar, t).input('c', sql.NVarChar, primera.toLowerCase()).query(`SELECT COUNT(*)::int AS n FROM pg_index ix
          JOIN pg_class tb ON tb.oid = ix.indrelid JOIN pg_namespace s ON s.oid = tb.relnamespace
          JOIN pg_attribute at ON at.attrelid = tb.oid AND at.attnum = split_part(ix.indkey::text, ' ', 1)::int
          WHERE s.nspname = current_schema() AND tb.relname = @t AND at.attname = @c`)).recordset[0].n > 0;
      if (cub) { acciones.push({ indice: nombre, estado: 'ya cubierto (hay indice por ' + primera + ')' }); continue; }
    }
    if (!aplicar) { acciones.push({ indice: nombre, estado: 'FALTA (se crearia)' }); continue; }
    const t1 = Date.now();
    try {
      await pool.request().query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${n} ON ${t} ${claves.toLowerCase()} ${incluye.toLowerCase()}`);
      acciones.push({ indice: nombre, estado: 'CREADO (sin bloquear)', ms: Date.now() - t1 });
    } catch (e) { acciones.push({ indice: nombre, estado: 'ERROR', error: e.message }); }
  }
  const tablas = ['atenciones', 'trabajadores_rapel', 'trabajadores_verfrut', 'usuarios'];
  const filas = (await pool.request().query(`SELECT c.relname AS tabla, GREATEST(c.reltuples, 0)::bigint AS filas FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
      WHERE s.nspname = current_schema() AND c.relkind = 'r' AND c.relname IN ('${tablas.join("','")}')`)).recordset;
  const indices = (await pool.request().query(`SELECT tablename AS tabla, indexname AS indice, indexdef AS definicion FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename IN ('${tablas.join("','")}') ORDER BY 1, 2`)).recordset;
  context.res = { status: 200, body: { success: true, modo: aplicar ? 'aplicar' : 'solo informe', acciones, filas, indices, columnas: [], plan: 'Supabase (Postgres)', ms: Date.now() - t0 } };
}

module.exports = async function (context, req) {
  const t0 = Date.now();
  if (sql._pg) { try { return await indicesPg(context, req, t0); } catch (e) { context.res = { status: 500, body: { success: false, error: e.message } }; return; } }
  try {
    const pool = await getPool();
    const aplicar = req.method === 'POST' && String((req.query && req.query.aplicar) || '') === '1';
    const acciones = [];
    for (const [nombre, tabla, primera, claves, incluye] of INDICES) {
      const existe = (await pool.request().query(`SELECT OBJECT_ID('dbo.${tabla}') AS o`)).recordset[0].o;
      if (!existe) { acciones.push({ indice: nombre, estado: 'tabla no existe' }); continue; }
      if (primera === null) {
        const yaEsta = (await pool.request().input('n', sql.NVarChar, nombre).input('t', sql.NVarChar, tabla)
          .query(`SELECT COUNT(*) AS n FROM sys.indexes WHERE name = @n AND object_id = OBJECT_ID('dbo.' + @t)`)).recordset[0].n > 0;
        if (yaEsta) { acciones.push({ indice: nombre, estado: 'ya existe' }); continue; }
      } else if (await yaCubierto(pool, tabla, primera)) { acciones.push({ indice: nombre, estado: 'ya cubierto (hay indice por ' + primera + ')' }); continue; }
      if (!aplicar) { acciones.push({ indice: nombre, estado: 'FALTA (se crearia)' }); continue; }
      const base = `CREATE NONCLUSTERED INDEX ${nombre} ON dbo.${tabla} ${claves} ${incluye}`;
      const t1 = Date.now();
      try {
        await pool.request().query(base + ' WITH (ONLINE = ON)');
        acciones.push({ indice: nombre, estado: 'CREADO (online)', ms: Date.now() - t1 });
      } catch (e1) {
        try {
          await pool.request().query(base);
          acciones.push({ indice: nombre, estado: 'CREADO', ms: Date.now() - t1 });
        } catch (e2) {
          acciones.push({ indice: nombre, estado: 'ERROR', error: (e2.originalError && e2.originalError.message) || e2.message });
        }
      }
    }
    context.res = { status: 200, body: { success: true, modo: aplicar ? 'aplicar' : 'solo informe',
                    acciones, ...(await informe(pool)), ms: Date.now() - t0 } };
  } catch (e) {
    context.res = { status: 500, body: { success: false, error: (e.originalError && e.originalError.message) || e.message } };
  }
};
