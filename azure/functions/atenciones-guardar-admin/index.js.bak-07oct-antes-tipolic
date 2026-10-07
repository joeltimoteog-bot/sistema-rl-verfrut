/* ═══════════════════════════════════════════════════════════════════════════
   atenciones-guardar-admin (_AT_AZURE_PRIMERO_V1) — lo usa SOLO el Apps Script
   (llave de la funcion). /api/mantenimiento/guardar/<accion>
     estado      GET  : encendido?, contador del año, N° mas alto, filas pendientes de copiar a la hoja
     encender    POST : { activo:true|false, anio, max } -> enciende/apaga y sube el contador a max
     nro         POST : { anio, max } -> el contador nunca queda por debajo del N° mas alto de la hoja
     idem        GET  : ?clave=  -> si esa huella ya se guardo en Azure (y la fila completa)
     pendientes  GET  : atenciones guardadas en Azure que aun no se copian a la hoja (max 200)
     marcar      POST : { claves:[...] } -> ya estan en la hoja
     simular     POST : { anio, atenciones:[...] } -> N° que tocaria y campos calculados (no guarda)
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const G = require('../shared/at-guardar');

const FILA = `a.id, a.nro, CONVERT(CHAR(10), a.fecha_atencion, 120) AS fecha_atencion, a.hora_inicio, a.hora_termino, a.nro_semana, a.mes, a.anio,
  a.dni, a.nombre, a.sexo, CONVERT(CHAR(10), a.fecha_inicio_periodo, 120) AS fecha_inicio_periodo, a.empresa, a.fundo, a.cargo, a.ruta, a.codigo,
  a.fundo_actual, a.celular, a.supervisor, a.detalle_documento, CONVERT(CHAR(10), a.fecha_inicio_doc, 120) AS fecha_inicio_doc,
  CONVERT(CHAR(10), a.fecha_termino_doc, 120) AS fecha_termino_doc, a.dias_transcurridos, a.responsable_recepcion, a.observaciones,
  a.estado, a.usuario_sistema, a.nro_licencia, a.parentesco,
  a.autorizado_por, CONVERT(CHAR(10), a.fecha_termino_periodo, 120) AS fecha_termino_periodo`;   /* _AT_COLS_V1 */

async function subirContador(pool, anio, max) {
  await pool.request().input('a', sql.Int, anio).input('m', sql.Int, max).query(`
    MERGE dbo.AtNroContador WITH (HOLDLOCK) AS x USING (SELECT @a AS anio) AS s ON x.anio = s.anio
      WHEN MATCHED AND x.ultimo < @m THEN UPDATE SET ultimo = @m, actualizado = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (anio, ultimo) VALUES (@a, @m);`);
}

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  const b = req.body || {}, q = req.query || {};
  try {
    const pool = await getPool();
    await G.asegurarTablas(pool);
    const anio = parseInt(b.anio || q.anio, 10) || G.lima().anio;
    let out;
    if (accion === 'estado') {
      const r = await pool.request().input('a', sql.Int, anio).query(`
        SELECT (SELECT valor FROM dbo.AtConfig WHERE clave = 'azure_primero') AS activo,
               (SELECT ultimo FROM dbo.AtNroContador WHERE anio = @a) AS contador,
               (SELECT MAX(nro) FROM dbo.Atenciones WITH (NOLOCK) WHERE anio = @a) AS maxAzure,
               (SELECT COUNT(*) FROM dbo.AtIdem WHERE en_hoja = 0) AS pendientesHoja,
               (SELECT COUNT(*) FROM dbo.AtIdem) AS guardadosPorAzure`);
      out = Object.assign({ success: true, anio }, r.recordset[0]);
    } else if (accion === 'encender') {
      if (b.max) await subirContador(pool, anio, parseInt(b.max, 10));
      await pool.request().input('v', sql.NVarChar(200), b.activo ? '1' : '0').query(`
        MERGE dbo.AtConfig AS x USING (SELECT 'azure_primero' AS clave) AS s ON x.clave = s.clave
          WHEN MATCHED THEN UPDATE SET valor = @v, actualizado = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES ('azure_primero', @v);`);
      out = { success: true, activo: !!b.activo };
    } else if (accion === 'nro') {
      const m = parseInt(b.max, 10);
      if (!m) throw new Error('Falta max');
      await subirContador(pool, anio, m);
      out = { success: true };
    } else if (accion === 'idem') {
      const k = String(q.clave || '').replace(/[^\w-]/g, '').slice(0, 80);
      const r = await pool.request().input('k', sql.NVarChar(80), k)
        .query(`SELECT i.clave, i.en_hoja, ${FILA} FROM dbo.AtIdem i JOIN dbo.Atenciones a ON a.id = i.atencion_id WHERE i.clave = @k`);
      out = { success: true, encontrado: r.recordset.length > 0, fila: r.recordset[0] || null };
    } else if (accion === 'pendientes') {
      const r = await pool.request().query(`SELECT TOP 200 i.clave, ${FILA}
        FROM dbo.AtIdem i JOIN dbo.Atenciones a ON a.id = i.atencion_id WHERE i.en_hoja = 0 ORDER BY i.nro`);
      /* si la atencion fue borrada de Azure, su huella ya no tiene fila: se da por resuelta */
      await pool.request().query(`UPDATE i SET en_hoja = 1 FROM dbo.AtIdem i LEFT JOIN dbo.Atenciones a ON a.id = i.atencion_id WHERE i.en_hoja = 0 AND a.id IS NULL`);
      out = { success: true, filas: r.recordset };
    } else if (accion === 'marcar') {
      const claves = (Array.isArray(b.claves) ? b.claves : []).map(k => String(k).replace(/[^\w-]/g, '').slice(0, 80)).filter(Boolean).slice(0, 500);
      let n = 0;
      for (const k of claves) {
        const r = await pool.request().input('k', sql.NVarChar(80), k).query('UPDATE dbo.AtIdem SET en_hoja = 1 WHERE clave = @k');
        n += (r.rowsAffected && r.rowsAffected[0]) || 0;
      }
      out = { success: true, marcadas: n };
    } else if (accion === 'simular') {
      /* solo calcula (no guarda): el N° que tocaria y como se arma la atencion */
      const r = await pool.request().input('a', sql.Int, anio).query(`SELECT (SELECT ultimo FROM dbo.AtNroContador WHERE anio = @a) AS ultimo,
        (SELECT MAX(nro) FROM dbo.Atenciones WITH (NOLOCK) WHERE anio = @a) AS maxAz`);
      const x = r.recordset[0];
      out = { success: true, nroSiguiente: Math.max(x.ultimo || 0, x.maxAz || 0) + 1, contador: x.ultimo, maxAzure: x.maxAz,
              armado: (Array.isArray(b.atenciones) ? b.atenciones : []).map(G.armar) };
    } else { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    context.res = { status: 200, body: out };
  } catch (e) {
    context.res = { status: 500, body: { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') } };
  }
};
