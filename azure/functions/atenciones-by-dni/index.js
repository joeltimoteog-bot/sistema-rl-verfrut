const { sql, getPool } = require('../shared/db');

module.exports = async function (context, req) {
  const t0 = Date.now();
  context.log('atenciones-by-dni triggered');

  try {
    // Validar input (DNI 8 dígitos)
    const dni = String(req.query.dni || (req.body && req.body.dni) || '').trim();
    if (!dni || !/^\d{8}$/.test(dni)) {
      context.res = {
        status: 400,
        body: { success: false, error: 'DNI invalido (debe ser 8 digitos)' }
      };
      return;
    }

    // Ventana de tiempo configurable (default 60 días)
    const dias = Math.max(1, Math.min(365, parseInt(req.query.dias || '60', 10)));
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    fechaLimite.setHours(0, 0, 0, 0);

    // Query Azure SQL
    const pool = await getPool();
    const result = await pool.request()
      .input('dni', sql.NVarChar(15), dni)
      .input('fechaLimite', sql.Date, fechaLimite)
      .query(`
        SELECT TOP 30
          id, nro, fecha_atencion, dni, nombre, empresa, fundo,
          detalle_documento, fecha_inicio_doc, fecha_termino_doc,
          dias_transcurridos, observaciones, supervisor,
          responsable_recepcion, estado
        FROM Atenciones
        WHERE dni = @dni
          AND fecha_atencion >= @fechaLimite
        ORDER BY fecha_atencion DESC, id DESC
      `);

    const atenciones = result.recordset || [];

    // Separar por estado
    const en_proceso = atenciones.filter(a => {
      const est = String(a.estado || '').toUpperCase();
      return est.includes('PROCESO');
    });

    const finalizadas_recientes = atenciones.filter(a => {
      const est = String(a.estado || '').toUpperCase();
      return est.includes('FINALIZ');
    });

    const elapsed_ms = Date.now() - t0;
    context.log(`atenciones-by-dni: dni=${dni} total=${atenciones.length} en_proceso=${en_proceso.length} finalizadas=${finalizadas_recientes.length} - ${elapsed_ms}ms`);

    context.res = {
      status: 200,
      body: {
        success: true,
        dni,
        total: atenciones.length,
        en_proceso,
        finalizadas_recientes: finalizadas_recientes.slice(0, 5),
        ventana_dias: dias,
        elapsed_ms
      }
    };
  } catch (e) {
    context.log.error('Error en atenciones-by-dni:', e.message);
    context.res = {
      status: 500,
      body: { success: false, error: e.message }
    };
  }
};