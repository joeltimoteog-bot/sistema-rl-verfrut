// Capturar errores incluso del require
const { exigirAuth } = require('../shared/auth');
let sql, getPool;
let dbLoadError = null;
try {
  const dbModule = require('../shared/db');
  sql = dbModule.sql;
  getPool = dbModule.getPool;
} catch (e) {
  dbLoadError = e.message + ' | stack: ' + e.stack;
}

module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  const startTime = Date.now();

  try {
    context.log('═══ usuarios-sync START ═══');

    // Validar que el require funcionó
    if (dbLoadError) {
      context.log.error('Error cargando shared/db:', dbLoadError);
      context.res = {
        status: 500,
        body: { success: false, error: 'require failed', detail: dbLoadError }
      };
      return;
    }

    if (!sql || !getPool) {
      context.res = {
        status: 500,
        body: { success: false, error: 'sql o getPool no disponibles' }
      };
      return;
    }

    // Validar body
    const usuarios = (req.body && req.body.usuarios) || [];
    context.log('Recibidos: ' + usuarios.length + ' usuarios');

    if (!Array.isArray(usuarios) || usuarios.length === 0) {
      context.res = {
        status: 400,
        body: { success: false, error: 'usuarios debe ser un array no vacio' }
      };
      return;
    }

    // Conectar a SQL
    context.log('Conectando a SQL...');
    let pool;
    try {
      pool = await getPool();
      context.log('✓ SQL conectado');
    } catch (e) {
      context.log.error('Error conexión SQL:', e.message, e.code, e.stack);
      context.res = {
        status: 500,
        body: {
          success: false,
          error: 'Error conectando a SQL: ' + e.message,
          code: e.code || null,
          stack: e.stack || null
        }
      };
      return;
    }

    let inserted = 0, updated = 0, failed = 0;
    const errors = [];

    /* _USYNC_LOTE_V1 (23-set-2026) — antes: 31 consultas una por una; si la tabla
       estaba bloqueada cada una esperaba 60 s y la llamada moria a los 230 s
       (HTTP 504). Ahora: 1) UNA sola consulta con todos los usuarios, que espera
       como maximo 15 s un bloqueo; 2) si esa falla, el metodo de siempre fila por
       fila, tambien con espera maxima de 15 s; 3) nunca pasa de ~200 s: responde
       con lo que alcanzo a hacer en vez de dejar colgado a Apps Script. */
    const validos = usuarios.filter(function (u) { return u && u.id_sistema && u.usuario && u.password && u.nombre; });
    usuarios.forEach(function (u) { if (!(u && u.id_sistema && u.usuario && u.password && u.nombre)) { failed++; errors.push({ id: (u && u.id_sistema) || '(sin id)', error: 'Faltan campos obligatorios' }); } });
    const fechaOk = function (f) { if (!f) return null; const t = Date.parse(String(f).replace(' ', 'T')); return isNaN(t) ? null : String(f).replace(' ', 'T'); };
    let loteOk = false;
    try {
      const json = JSON.stringify(validos.map(function (u) { return {
        id_sistema: String(u.id_sistema), usuario: String(u.usuario), password: String(u.password), nombre: String(u.nombre),
        rol: u.rol || null, empresa: u.empresa || null, activo: u.activo ? 1 : 0, fecha_creacion: fechaOk(u.fecha_creacion),
        correo: u.correo || null, cargo: u.cargo || null, sector: u.sector || null }; }));
      const rl = await pool.request().input('j', sql.NVarChar(sql.MAX), json).query(`
        SET LOCK_TIMEOUT 15000;
        DECLARE @out TABLE (a NVARCHAR(10));
        MERGE dbo.usuarios AS target
        USING (SELECT * FROM OPENJSON(@j) WITH (
                 id_sistema NVARCHAR(50), usuario NVARCHAR(50), password NVARCHAR(255), nombre NVARCHAR(200),
                 rol NVARCHAR(50), empresa NVARCHAR(50), activo BIT, fecha_creacion DATETIME2,
                 correo NVARCHAR(200), cargo NVARCHAR(200), sector NVARCHAR(100))) AS source
        ON target.id_sistema = source.id_sistema
        WHEN MATCHED THEN UPDATE SET
          usuario = source.usuario, password = source.password, nombre = source.nombre, rol = source.rol,
          empresa = source.empresa, activo = source.activo, fecha_creacion = source.fecha_creacion,
          correo = source.correo, cargo = source.cargo, sector = source.sector, fecha_sync = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (id_sistema, usuario, password, nombre, rol, empresa, activo, fecha_creacion, correo, cargo, sector, fecha_sync)
          VALUES (source.id_sistema, source.usuario, source.password, source.nombre, source.rol, source.empresa,
                  source.activo, source.fecha_creacion, source.correo, source.cargo, source.sector, GETDATE())
        OUTPUT $action INTO @out;
        SELECT a, COUNT(*) AS n FROM @out GROUP BY a;`);
      (rl.recordset || []).forEach(function (x) { if (x.a === 'INSERT') inserted += x.n; else if (x.a === 'UPDATE') updated += x.n; });
      loteOk = true;
      context.log('✓ Lote OK: i=' + inserted + ' u=' + updated + ' (' + (Date.now() - startTime) + 'ms)');
    } catch (eLote) {
      context.log.warn('Lote fallo, se pasa a fila por fila: ' + eLote.message + ' (' + (eLote.number || eLote.code || '') + ')');
      inserted = 0; updated = 0;
    }

    for (let i = 0; !loteOk && i < usuarios.length; i++) {
      if (Date.now() - startTime > 200000) {
        errors.push({ id: '(corte)', error: 'Se detuvo a los 200 s para no exceder el limite; quedaron ' + (usuarios.length - i) + ' sin procesar (probable bloqueo en la tabla usuarios)' });
        failed += usuarios.length - i;
        break;
      }
      const u = usuarios[i];

      try {
        if (!u.id_sistema || !u.usuario || !u.password || !u.nombre) {
          continue;   // ya contado arriba (_USYNC_LOTE_V1)
        }

        context.log('Procesando: ' + u.usuario + ' (' + (i + 1) + '/' + usuarios.length + ')');

        const result = await pool.request()
          .input('id_sistema',     sql.NVarChar(50),  u.id_sistema)
          .input('usuario',        sql.NVarChar(50),  u.usuario)
          .input('password',       sql.NVarChar(255), u.password)
          .input('nombre',         sql.NVarChar(200), u.nombre)
          .input('rol',            sql.NVarChar(50),  u.rol || null)
          .input('empresa',        sql.NVarChar(50),  u.empresa || null)
          .input('activo',         sql.Bit,           u.activo ? 1 : 0)
          .input('fecha_creacion', sql.DateTime2,     u.fecha_creacion || null)
          .input('correo',         sql.NVarChar(200), u.correo || null)
          .input('cargo',          sql.NVarChar(200), u.cargo || null)
          .input('sector',         sql.NVarChar(100), u.sector || null)
          .query(`
            SET LOCK_TIMEOUT 15000;
            MERGE dbo.usuarios AS target
            USING (SELECT @id_sistema AS id_sistema) AS source
            ON target.id_sistema = source.id_sistema
            WHEN MATCHED THEN UPDATE SET
              usuario        = @usuario,
              password       = @password,
              nombre         = @nombre,
              rol            = @rol,
              empresa        = @empresa,
              activo         = @activo,
              fecha_creacion = @fecha_creacion,
              correo         = @correo,
              cargo          = @cargo,
              sector         = @sector,
              fecha_sync     = GETDATE()
            WHEN NOT MATCHED THEN
              INSERT (id_sistema, usuario, password, nombre, rol, empresa,
                      activo, fecha_creacion, correo, cargo, sector, fecha_sync)
              VALUES (@id_sistema, @usuario, @password, @nombre, @rol, @empresa,
                      @activo, @fecha_creacion, @correo, @cargo, @sector, GETDATE())
            OUTPUT $action AS sync_action;
          `);

        const action = result.recordset[0] && result.recordset[0].sync_action;
        if (action === 'INSERT') inserted++;
        else if (action === 'UPDATE') updated++;

      } catch (e) {
        failed++;
        errors.push({
          id: u.id_sistema,
          usuario: u.usuario,
          error: e.message,
          code: e.code || null,
          number: e.number || null
        });
        context.log.error('Error sync user ' + u.id_sistema + ':', e.message, e.code);
      }
    }

    const elapsed = Date.now() - startTime;
    context.log('═══ Sync END | i=' + inserted + ' u=' + updated + ' f=' + failed + ' (' + elapsed + 'ms) ═══');

    context.res = {
      status: 200,
      body: {
        success: true,
        total_recibidos: usuarios.length,
        inserted: inserted,
        updated: updated,
        failed: failed,
        errors: errors.slice(0, 10),
        elapsed_ms: elapsed
      }
    };

  } catch (e) {
    context.log.error('FATAL usuarios-sync:', e.message, e.stack);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: e.message || String(e),
        stack: e.stack || 'no stack',
        type: e.constructor && e.constructor.name
      }
    };
  }
};
