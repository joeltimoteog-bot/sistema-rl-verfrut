const { sql, getPool } = require('../shared/db');

module.exports = async function (context, req) {
  context.log('atenciones-create triggered');

  try {
    const d = req.body;
    if (!d || !d.dni || !d.nombre) {
      context.res = {
        status: 400,
        body: { success: false, error: 'Faltan campos requeridos: dni, nombre' }
      };
      return;
    }

    const pool = await getPool();
    const result = await pool.request()
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
        OUTPUT INSERTED.id
        VALUES (
          @nro, @fecha_atencion, @hora_inicio, @hora_termino, @nro_semana, @mes, @anio,
          @dni, @nombre, @sexo, @fecha_inicio_periodo, @empresa, @fundo, @cargo, @ruta,
          @codigo, @fundo_actual, @celular, @supervisor, @detalle_documento,
          @fecha_inicio_doc, @fecha_termino_doc, @dias_transcurridos,
          @responsable_recepcion, @observaciones, @estado, @usuario_sistema
        )
      `);

    context.res = {
      status: 201,
      body: {
        success: true,
        id: result.recordset[0].id,
        mensaje: 'Atencion creada en Azure SQL'
      }
    };
  } catch (e) {
    context.log.error('Error en atenciones-create:', e);
    context.res = {
      status: 500,
      body: { success: false, error: e.message }
    };
  }
};
