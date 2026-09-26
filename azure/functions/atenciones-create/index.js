const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');
 
module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;
 
  context.log('atenciones-create triggered');
 
  try {
    const d = req.body;
 
    if (!d || !d.dni || !d.nombre) {
      context.res = { status: 400, body: { success: false, error: 'Faltan campos requeridos: dni, nombre' } };
      return;
    }
 
    /* _LIMPIEZA_V1 (26-set-2026): antes, un celular largo ("987654321 / 912345678")
       o una fecha de documento mal escrita (año 20266, 0202...) hacia fallar TODO el
       guardado en Azure y la atencion quedaba solo en la hoja (54 casos encontrados).
       Ahora los textos se recortan al largo de su columna y las fechas imposibles
       quedan vacias. El DNI NO se recorta: si es invalido se rechaza con mensaje claro. */
    const _txt = { hora_inicio: 10, hora_termino: 10, nombre: 200, sexo: 10, empresa: 50, fundo: 100, cargo: 150, ruta: 50,
      codigo: 50, fundo_actual: 100, celular: 20, supervisor: 100, detalle_documento: 500, nro_licencia: 40, parentesco: 40,
      responsable_recepcion: 150, estado: 30, usuario_sistema: 50 };
    Object.keys(_txt).forEach(k => { if (d[k] != null && d[k] !== '') d[k] = String(d[k]).slice(0, _txt[k]); });
    const _fecha = (v) => {
      if (!v) return null;
      const s = String(v).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const y = +s.slice(0, 4);
      if (y < 1900 || y > 2100) return null;
      const f = new Date(s + 'T00:00:00Z');
      return (isNaN(f.getTime()) || f.toISOString().slice(0, 10) !== s) ? null : s;
    };
    ['fecha_atencion', 'fecha_inicio_periodo', 'fecha_inicio_doc', 'fecha_termino_doc'].forEach(k => { d[k] = _fecha(d[k]); });
    d.dni = String(d.dni).trim();
    if (d.dni.length > 15) {
      context.res = { status: 400, body: { success: false, error: 'DNI invalido (mas de 15 caracteres): ' + d.dni } };
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
      .input('nro_licencia', sql.NVarChar(40), d.nro_licencia || '')
      .input('parentesco', sql.NVarChar(40), d.parentesco || '')
      .input('fecha_inicio_doc', sql.Date, d.fecha_inicio_doc || null)
      .input('fecha_termino_doc', sql.Date, d.fecha_termino_doc || null)
      .input('dias_transcurridos', sql.Int, d.dias_transcurridos || 0)
      .input('responsable_recepcion', sql.NVarChar(150), d.responsable_recepcion || '')
      .input('observaciones', sql.NVarChar(sql.MAX), d.observaciones || '')
      .input('estado', sql.NVarChar(30), d.estado || 'EN PROCESO')
      .input('usuario_sistema', sql.NVarChar(50), d.usuario_sistema || '')
      /* _UPSERT_V1 (25-set-2026): si ya existe la atencion (mismo N°, año y DNI) se
         ACTUALIZA en vez de crear otra. Asi las ediciones hechas en la hoja llegan a
         Azure y un envio repetido ya no duplica el registro. Sin N° -> se crea como antes. */
      .query(`
        SET NOCOUNT ON;
        DECLARE @id INT = NULL, @accion NVARCHAR(10) = N'creado';
        DECLARE @t TABLE (id INT);
        IF @nro IS NOT NULL
          SELECT TOP 1 @id = id FROM Atenciones WHERE nro = @nro AND anio = @anio AND dni = @dni ORDER BY id DESC;
        IF @id IS NOT NULL
        BEGIN
          UPDATE Atenciones SET fecha_atencion = @fecha_atencion, hora_inicio = @hora_inicio, hora_termino = @hora_termino, nro_semana = @nro_semana, mes = @mes, nombre = @nombre, sexo = @sexo, fecha_inicio_periodo = @fecha_inicio_periodo, empresa = @empresa, fundo = @fundo, cargo = @cargo, ruta = @ruta, codigo = @codigo, fundo_actual = @fundo_actual, celular = @celular, supervisor = @supervisor, detalle_documento = @detalle_documento, nro_licencia = @nro_licencia, parentesco = @parentesco, fecha_inicio_doc = @fecha_inicio_doc, fecha_termino_doc = @fecha_termino_doc, dias_transcurridos = @dias_transcurridos, responsable_recepcion = @responsable_recepcion, observaciones = @observaciones, estado = @estado, usuario_sistema = @usuario_sistema
          WHERE nro = @nro AND anio = @anio AND dni = @dni;
          SET @accion = N'actualizado';
        END
        ELSE
        BEGIN
          INSERT INTO Atenciones (
          nro, fecha_atencion, hora_inicio, hora_termino, nro_semana, mes, anio,
          dni, nombre, sexo, fecha_inicio_periodo, empresa, fundo, cargo, ruta, codigo,
          fundo_actual, celular, supervisor, detalle_documento, nro_licencia, parentesco, fecha_inicio_doc,
          fecha_termino_doc, dias_transcurridos, responsable_recepcion, observaciones,
          estado, usuario_sistema
          )
          OUTPUT INSERTED.id INTO @t
          VALUES (
          @nro, @fecha_atencion, @hora_inicio, @hora_termino, @nro_semana, @mes, @anio, @dni, @nombre, @sexo, @fecha_inicio_periodo, @empresa, @fundo, @cargo, @ruta, @codigo, @fundo_actual, @celular, @supervisor, @detalle_documento, @nro_licencia, @parentesco, @fecha_inicio_doc, @fecha_termino_doc, @dias_transcurridos, @responsable_recepcion, @observaciones, @estado, @usuario_sistema
          );
          SELECT TOP 1 @id = id FROM @t;
        END
        SELECT @id AS id, @accion AS accion;
      `);
 
    const fila = result.recordset[0] || {};
    context.res = { status: 201, body: { success: true, id: fila.id, accion: fila.accion,
                    mensaje: fila.accion === 'actualizado' ? 'Atencion actualizada en Azure SQL' : 'Atencion creada en Azure SQL' } };
  } catch (e) {
    context.log.error('Error en atenciones-create:', e);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
