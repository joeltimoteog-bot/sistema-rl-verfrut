const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  context.log('atenciones-batch triggered');
  const startTime = Date.now();

  try {
    const items = req.body && req.body.atenciones;
    if (!Array.isArray(items) || items.length === 0) {
      context.res = {
        status: 400,
        body: { success: false, error: 'Body debe contener un array "atenciones" no vacio' }
      };
      return;
    }
    if (items.length > 100) {
      context.res = {
        status: 400,
        body: { success: false, error: 'Maximo 100 atenciones por batch' }
      };
      return;
    }

    const pool = await getPool();
    const results = {
      total: items.length,
      inserted: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      try {
        if (!d.dni || !d.nombre) {
          results.failed++;
          results.errors.push({ index: i, error: 'Falta dni o nombre' });
          continue;
        }

        const request = pool.request();
        await request
          .input('nro', sql.Int, d.nro || null)
          .input('fecha_atencion', sql.Date, d.fecha_atencion || null)
          .input('hora_inicio', sql.NVarChar(10), d.hora_inicio || '')
          .input('hora_termino', sql.NVarChar(10), d.hora_termino || '')
          .input('nro_semana', sql.Int, d.nro_semana || null)
          .input('mes', sql.Int, d.mes || null)
          .input('anio', sql.Int, d.anio || null)
          .input('dni', sql.NVarChar(15), d.dni)
          .input('nombre', sql.NVarChar(200), d.nombre)
          .input('sexo', sql.NVarChar(10), d.sexo || '')
          .input('fecha_inicio_periodo', sql.Date, d.fecha_inicio_periodo || null)
          .input('empresa', sql.NVarChar(50), d.empresa || '')
          .input('fundo', sql.NVarChar(100), d.fundo || '')
          .input('cargo', sql.NVarChar(150), d.cargo || '')
          .input('ruta', sql.NVarChar(50), d.ruta || '')
          .input('codigo', sql.NVarChar(50), d.codigo || '')
          .input('fundo_actual', sql.NVarChar(100), d.fundo_actual || '')
          .input('celular', sql.NVarChar(20), d.celular || '')
          .input('supervisor', sql.NVarChar(100), d.supervisor || '')
          .input('detalle_documento', sql.NVarChar(500), d.detalle_documento || '')
          .input('fecha_inicio_doc', sql.Date, d.fecha_inicio_doc || null)
          .input('fecha_termino_doc', sql.Date, d.fecha_termino_doc || null)
          .input('dias_transcurridos', sql.Int, d.dias_transcurridos || 0)
          .input('responsable_recepcion', sql.NVarChar(150), d.responsable_recepcion || '')
          .input('observaciones', sql.NVarChar(sql.MAX), d.observaciones || '')
          .input('estado', sql.NVarChar(30), d.estado || 'EN PROCESO')
          .input('usuario_sistema', sql.NVarChar(50), d.usuario_sistema || '')
          .query(`
            INSERT INTO Atenciones (
              nro, fecha_atencion, hora_inicio, hora_termino, nro_semana, mes, anio,
              dni, nombre, sexo, fecha_inicio_periodo, empresa, fundo, cargo, ruta,
              codigo, fundo_actual, celular, supervisor, detalle_documento,
              fecha_inicio_doc, fecha_termino_doc, dias_transcurridos,
              responsable_recepcion, observaciones, estado, usuario_sistema
            )
            VALUES (
              @nro, @fecha_atencion, @hora_inicio, @hora_termino, @nro_semana, @mes, @anio,
              @dni, @nombre, @sexo, @fecha_inicio_periodo, @empresa, @fundo, @cargo, @ruta,
              @codigo, @fundo_actual, @celular, @supervisor, @detalle_documento,
              @fecha_inicio_doc, @fecha_termino_doc, @dias_transcurridos,
              @responsable_recepcion, @observaciones, @estado, @usuario_sistema
            )
          `);

        results.inserted++;
      } catch (e) {
        results.failed++;
        results.errors.push({ index: i, error: e.message, dni: d.dni });
      }
    }

    const elapsed = Date.now() - startTime;
    context.log('Batch completado:', results.inserted, '/', results.total, 'en', elapsed, 'ms');

    context.res = {
      status: 200,
      body: {
        success: true,
        total: results.total,
        inserted: results.inserted,
        failed: results.failed,
        errors: results.errors.slice(0, 10),
        elapsed: elapsed
      }
    };
  } catch (e) {
    context.log.error('Error en batch:', e);
    context.res = {
      status: 500,
      body: { success: false, error: e.message, code: e.code }
    };
  }
};
