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

    for (let i = 0; i < usuarios.length; i++) {
      const u = usuarios[i];

      try {
        if (!u.id_sistema || !u.usuario || !u.password || !u.nombre) {
          failed++;
          errors.push({ id: u.id_sistema || '(sin id)', error: 'Faltan campos obligatorios' });
          continue;
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
