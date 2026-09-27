/* ═══════════════════════════════════════════════════════════════════════════
   tablas-cv (_TABLAS_CV_V1, 26-set-2026) — carga y lectura de las TABLAS REALES
   dbo.Casos y dbo.Visitas. Solo con la llave de la funcion (lo usa el Apps Script).
   POST mantenimiento/tablas/{casos|visitas}/cargar  { filas:[[celdas de la hoja]] }
        Valida TODAS las celdas; si alguna no cabe en su columna no escribe nada y
        devuelve la lista. Si todo esta bien reemplaza la tabla en una transaccion.
   GET  mantenimiento/tablas/{casos|visitas}/leer    registros armados como getCasos/getVisitas
   GET  mantenimiento/tablas/{casos|visitas}/estado  cuantos hay y cuando se cargo
   Ninguna pantalla usa todavia estas tablas: no afecta a los usuarios.
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const TC = require('../shared/tablas-cv');

module.exports = async function (context, req) {
  const tipo = context.bindingData.tipo, accion = context.bindingData.accion;
  const res = (status, body) => { context.res = { status, body }; };
  if (!TC.TABLA[tipo]) return res(404, { success: false, error: 'Tipo desconocido: ' + tipo });
  try {
    const pool = await getPool(); await TC.asegurarTablas(pool, tipo);
    const T = TC.TABLA[tipo];
    if (accion === 'estado') {
      const r = await pool.request().query(`SELECT COUNT(*) AS registros, MAX(fila) AS filas,
        CONVERT(VARCHAR(19), DATEADD(HOUR, -5, MAX(actualizado)), 120) AS cargado_lima FROM ${T}`);
      return res(200, Object.assign({ success: true, tabla: T }, r.recordset[0]));
    }
    if (accion === 'leer') {
      const r = await pool.request().query(`SELECT * FROM ${T} ORDER BY fila`);
      const filas = r.recordset;
      if (tipo === 'casos') {
        return res(200, { success: true, total: filas.length, data: filas.map(TC.casoDeFila),
          recientes: filas.filter(f => TC.esReciente(f, filas.length)).map(TC.casoDeFila) });
      }
      return res(200, { success: true, total: filas.length, data: filas.filter(f => f.nro !== null).map(TC.visitaDeFila) });
    }
    if (accion === 'cargar' && req.method === 'POST') {
      const filas = (req.body || {}).filas;
      if (!Array.isArray(filas)) return res(400, { success: false, error: 'Faltan filas' });
      const { T: carga, problemas } = TC.armarCarga(tipo, filas);
      if (problemas.length) return res(400, { success: false, error: problemas.length + ' celda(s) no caben en su columna: no se cargo nada', problemas: problemas.slice(0, 60) });
      const tx = new sql.Transaction(pool); await tx.begin();
      try {
        await new sql.Request(tx).query(`DELETE FROM ${T}`);
        if (filas.length) await new sql.Request(tx).bulk(carga);
        await tx.commit();
      } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
      return res(200, { success: true, tabla: T, cargados: filas.length });
    }
    return res(404, { success: false, error: 'Accion desconocida: ' + accion });
  } catch (e) {
    context.log.error('[tablas-cv] ' + tipo + '/' + accion + ': ' + e.message);
    return res(500, { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') });
  }
};
