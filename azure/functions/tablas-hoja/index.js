/* ═══════════════════════════════════════════════════════════════════════════
   tablas-hoja (_TABLAS_HC_V1, 26-set-2026) — carga/lectura de las tablas reales de
   Horas y Capacitaciones. Solo con la llave (lo usa el Apps Script).
   POST .../{clave}/inicio   vacia la tabla de paso
   POST .../{clave}/lote     { desde, filas:[[celdas]] }   agrega a la tabla de paso
   POST .../{clave}/fin      { encabezado, ancho, total }  cambia la tabla en una transaccion
   GET  .../{clave}/leer?desde=0&cuantos=5000              celdas como las da Google
   GET  .../{clave}/estado
   POST .../{clave}/soltar   quita la marca: los calculos vuelven al bloque anterior
   claves: horas_registros, horas_motivos, cap_cabeceras, cap_asistentes
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const H = require('../shared/tablas-hoja');

module.exports = async function (context, req) {
  const clave = context.bindingData.clave, accion = context.bindingData.accion, b = req.body || {}, q = req.query || {};
  const res = (status, body) => { context.res = { status, body }; };
  const E = H.ESQ[clave];
  if (!E) return res(404, { success: false, error: 'Tabla desconocida: ' + clave });
  try {
    const pool = await getPool(); await H.asegurar(pool, clave);
    if (accion === 'inicio') { await pool.request().query(`TRUNCATE TABLE ${E.tabla}__carga`); return res(200, { success: true }); }
    if (accion === 'lote') {
      if (!Array.isArray(b.filas)) return res(400, { success: false, error: 'Faltan filas' });
      const { T, conOtros } = H.tablaCarga(clave, b.filas, parseInt(b.desde, 10) || 0);
      if (b.filas.length) await pool.request().bulk(T);
      return res(200, { success: true, recibidas: b.filas.length, conOtros });
    }
    if (accion === 'fin') {
      const total = parseInt(b.total, 10);
      const n = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${E.tabla}__carga`)).recordset[0].n;
      if (n !== total) return res(409, { success: false, error: 'La tabla de paso tiene ' + n + ' filas y se esperaban ' + total + ': no se cambio nada' });
      const cols = ['fila'].concat(E.cols.map(c => c[0]), ['otros']).join(', ');
      const tx = new sql.Transaction(pool); await tx.begin();
      try {
        /* _HORAS_AZURE_PRIMERO_V1: si Azure guardo algo despues de que Google leyo la hoja, esa foto ya esta vieja: no se cambia */
        const tipoOp = clave.indexOf('horas_') === 0 ? 'horas' : (clave.indexOf('cap_') === 0 ? 'cap' : (clave.indexOf('fus_') === 0 ? 'fus' : (clave.indexOf('sol_') === 0 ? 'sol' : (clave.indexOf('cumpl_') === 0 && clave !== 'cumpl_historial' ? 'cumpl' : (clave.indexOf('acc_') === 0 ? 'usr' : (clave.indexOf('mant_') === 0 ? 'mant' : (clave.indexOf('e360_') === 0 ? 'e360' : '')))))));   /* _E360_AZURE_V1: + e360 */   /* _MANT_AZURE_V1: + mant */   /* _USR_AZURE_V1: + acc */   /* _CUMPL_W_V1: + cumpl (el historial lo escribe Google) */   /* _FUS_AZURE_V1: + fus · _SOL_AZURE_V1: + sol */
        if (tipoOp && b.leidoMs) {
          await new sql.Request(tx).query(`EXEC sp_getapplock @Resource = '${tipoOp}_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;`);
          const nOps = (await new sql.Request(tx).input('t', sql.NVarChar(20), tipoOp).input('l', sql.DateTime2(0), new Date(+b.leidoMs - 2000))
            .query("SELECT COUNT(*) AS n FROM dbo.CV_Ops WHERE tipo = @t AND (en_hoja = 0 OR creado >= @l)")).recordset[0].n;
          if (nOps) { await tx.rollback(); return res(409, { success: false, error: nOps + ' guardado(s) de Azure aun no estan en la hoja leida: no se cambio nada (se reintenta luego)' }); }
        }
        await new sql.Request(tx).query(`DELETE FROM ${E.tabla}; INSERT INTO ${E.tabla} (${cols}) SELECT ${cols} FROM ${E.tabla}__carga ORDER BY fila;`);
        await new sql.Request(tx).input('k', sql.NVarChar(40), clave).input('e', sql.NVarChar(sql.MAX), JSON.stringify(b.encabezado || []))
          .input('a', sql.Int, parseInt(b.ancho, 10) || E.cols.length).input('m', sql.NVarChar(40), String(Date.now())).input('n', sql.Int, total)
          .query(`MERGE dbo.TH_Estado AS x USING (SELECT @k AS clave) AS s ON x.clave = s.clave
                  WHEN MATCHED THEN UPDATE SET encabezado = @e, ancho = @a, marca = @m, filas = @n, actualizado = SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT (clave, encabezado, ancho, marca, filas) VALUES (@k, @e, @a, @m, @n);`);
        await tx.commit();
      } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
      await pool.request().query(`TRUNCATE TABLE ${E.tabla}__carga`);
      const o = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${E.tabla} WHERE otros IS NOT NULL`)).recordset[0].n;
      return res(200, { success: true, tabla: E.tabla, filas: total, conOtros: o });
    }
    if (accion === 'leer') {
      const d = await H.leer(pool, clave);
      if (!d) return res(404, { success: false, error: 'Tabla aun no cargada' });
      const desde = parseInt(q.desde, 10) || 0, cuantos = parseInt(q.cuantos, 10) || 5000;
      return res(200, { success: true, total: d.filas.length, encabezado: d.encabezado, filas: d.filas.slice(desde, desde + cuantos) });
    }
    if (accion === 'estado') {
      const r = await pool.request().input('k', sql.NVarChar(40), clave).query(`SELECT marca, filas, ancho, CONVERT(VARCHAR(19), DATEADD(HOUR,-5,actualizado),120) AS cargado_lima,
        (SELECT COUNT(*) FROM ${E.tabla}) AS registros, (SELECT COUNT(*) FROM ${E.tabla} WHERE otros IS NOT NULL) AS con_otros FROM dbo.TH_Estado WHERE clave = @k`);
      return res(200, Object.assign({ success: true, tabla: E.tabla }, r.recordset[0] || { marca: null }));
    }
    if (accion === 'soltar') {
      await pool.request().input('k', sql.NVarChar(40), clave).query('UPDATE dbo.TH_Estado SET marca = NULL WHERE clave = @k');
      return res(200, { success: true, soltada: clave });
    }
    return res(404, { success: false, error: 'Accion desconocida: ' + accion });
  } catch (e) {
    context.log.error('[tablas-hoja] ' + clave + '/' + accion + ': ' + e.message);
    return res(500, { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') });
  }
};
