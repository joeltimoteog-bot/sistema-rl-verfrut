/* mod-importar (_MOD_AZURE_V1) — el Apps Script manda los datos de un modulo:
   POST { modulo:'horas'|'cap', datos:{ clave: valor, ... } }  (reemplazo en transaccion)
   GET  -> tamaño y hora (Lima) de cada bloque. Solo con la llave de la funcion. */
const { sql, getPool } = require('../shared/db');
const M = require('../shared/mod-db');
module.exports = async function (context, req) {
  try {
    const pool = await getPool(); await M.asegurarTablas(pool);
    if (req.method === 'GET') {
      const r = await pool.request().query("SELECT modulo, clave, LEN(datos) AS largo, CONVERT(VARCHAR(19), DATEADD(HOUR,-5,actualizado),120) AS lima FROM dbo.MOD_Datos ORDER BY modulo, clave");
      context.res = { status: 200, body: { success: true, bloques: r.recordset } }; return;
    }
    const b = req.body || {}, modulo = String(b.modulo || ''), d = b.datos || {};
    const claves = M.CLAVES[modulo];
    if (!claves) throw new Error('Modulo desconocido: ' + modulo);
    const faltan = claves.filter(k => d[k] === undefined);
    if (faltan.length) throw new Error('Faltan datos: ' + faltan.join(', '));
    const tx = new sql.Transaction(pool); await tx.begin();
    const tam = {};
    try {
      for (const k of Object.keys(d)) {
        const txt = JSON.stringify(d[k]); tam[k] = Array.isArray(d[k]) ? d[k].length : txt.length;
        await tx.request().input('m', sql.NVarChar(40), modulo).input('k', sql.NVarChar(40), k).input('d', sql.NVarChar(sql.MAX), txt)
          .query(`MERGE dbo.MOD_Datos AS x USING (SELECT @m AS modulo, @k AS clave) AS s ON x.modulo = s.modulo AND x.clave = s.clave
                  WHEN MATCHED THEN UPDATE SET datos = @d, actualizado = SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT (modulo, clave, datos) VALUES (@m, @k, @d);`);
      }
      await tx.commit();
    } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
    context.res = { status: 200, body: { success: true, modulo, tam } };
  } catch (e) {
    context.res = { status: 500, body: { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') } };
  }
};
