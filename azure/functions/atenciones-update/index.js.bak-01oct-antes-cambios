const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  const t0 = Date.now();
  context.log('atenciones-update triggered');

  try {
    const body = req.body || {};
    const id = parseInt(body.id, 10);
    const estado = String(body.estado || '').trim();
    const usuario_actualiza = String(body.usuario_actualiza || '').trim();

    if (!id || !estado) {
      context.res = {
        status: 400,
        body: { success: false, error: 'Faltan campos requeridos: id (int), estado (string)' }
      };
      return;
    }

    // Validar estado
    const estadoUp = estado.toUpperCase();
    if (!estadoUp.includes('PROCESO') && !estadoUp.includes('FINALIZ')) {
      context.res = {
        status: 400,
        body: { success: false, error: 'Estado invalido: ' + estado + ' (esperado: EN PROCESO o FINALIZADO)' }
      };
      return;
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('estado', sql.NVarChar(30), estado)
      .query(`
        UPDATE Atenciones SET estado = @estado WHERE id = @id;
        SELECT @@ROWCOUNT AS filas_afectadas;
      `);

    const filas = result.recordset[0].filas_afectadas;

    if (filas === 0) {
      context.res = {
        status: 404,
        body: { success: false, error: 'Atencion no encontrada: id=' + id }
      };
      return;
    }

    const elapsed_ms = Date.now() - t0;
    context.log('atenciones-update: id=' + id + ' estado=' + estado + ' por=' + (usuario_actualiza || '(sin usuario)') + ' - ' + elapsed_ms + 'ms');

    context.res = {
      status: 200,
      body: {
        success: true,
        id: id,
        estado: estado,
        filas_actualizadas: filas,
        usuario_actualiza: usuario_actualiza || null,
        elapsed_ms: elapsed_ms
      }
    };
  } catch (e) {
    context.log.error('Error en atenciones-update:', e.message);
    context.res = {
      status: 500,
      body: { success: false, error: e.message }
    };
  }
};