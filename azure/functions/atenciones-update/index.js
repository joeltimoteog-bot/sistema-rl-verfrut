const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');
const AC = require('../shared/at-cambios');   /* _AT_CAMBIOS_V1 */

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

    /* _KPI_A2_V1 (25-oct-2026): { id, remitido_a } -> marca "Remitido a <area>" con fecha y hora de Lima y quien lo marco (KPI A2) */
    if (body.remitido_a !== undefined) {
      const area = String(body.remitido_a || '').trim().toUpperCase().slice(0, 60);
      if (!id || !area) { context.res = { status: 400, body: { success: false, error: 'Faltan campos: id, remitido_a' } }; return; }
      const quien = String((authUser && authUser.usuario) || usuario_actualiza || '').trim().toLowerCase().slice(0, 60);
      const lima = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()).replace('T', ' ');
      const pool = await getPool();
      try { await pool.request().query("IF COL_LENGTH('dbo.Atenciones', 'remitido_a') IS NULL ALTER TABLE dbo.Atenciones ADD remitido_a NVARCHAR(60) NULL, remitido_en DATETIME2(0) NULL, remitido_por NVARCHAR(60) NULL"); } catch (e) {}
      const r = await pool.request().input('id', sql.Int, id).input('a', sql.NVarChar(60), area).input('f', sql.NVarChar(19), lima).input('q', sql.NVarChar(60), quien)
        .query('UPDATE Atenciones SET remitido_a = @a, remitido_en = CAST(@f AS DATETIME2(0)), remitido_por = @q, modificado = SYSUTCDATETIME() WHERE id = @id; SELECT @@ROWCOUNT AS n;');
      if (!r.recordset[0].n) { context.res = { status: 404, body: { success: false, error: 'Atencion no encontrada: id=' + id } }; return; }
      context.res = { status: 200, body: { success: true, id, remitido_a: area, remitido_en: lima, remitido_por: quien } };
      return;
    }

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
    await AC.asegurar(pool);   /* _AT_CAMBIOS_V1 */
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('estado', sql.NVarChar(30), estado)
      .query(`
        UPDATE Atenciones SET estado = @estado, modificado = SYSUTCDATETIME() WHERE id = @id;
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