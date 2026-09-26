/* ═══════════════════════════════════════════════════════════════════════════
   cv-importar (_CV_AZURE_V1) — el Apps Script manda aqui TODOS los casos y
   visitas (tal como los arma getCasos/getVisitas) despues de cada guardado y
   cada 10 minutos. Se reemplazan en una transaccion: nunca quedan a medias.
   POST { casos:[{d:{...}, r:true|false}], visitas:[{...}] }
   GET  -> cuantos hay y cuando fue la ultima carga (hora Lima)
   Solo con la llave de la funcion.
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const { asegurarTablas } = require('../shared/cv-db');

module.exports = async function (context, req) {
  try {
    const pool = await getPool(); await asegurarTablas(pool);
    if (req.method === 'GET') {
      const r = await pool.request().query(`SELECT (SELECT COUNT(*) FROM dbo.CV_Casos) AS casos,
        (SELECT COUNT(*) FROM dbo.CV_Casos WHERE reciente = 1) AS casos_recientes,
        (SELECT COUNT(*) FROM dbo.CV_Visitas) AS visitas,
        (SELECT CONVERT(VARCHAR(19), DATEADD(HOUR, -5, actualizado), 120) FROM dbo.CV_Estado WHERE clave = 'ultima_carga') AS ultima_carga_lima`);
      context.res = { status: 200, body: Object.assign({ success: true }, r.recordset[0]) };
      return;
    }
    const b = req.body || {};
    if (!Array.isArray(b.casos) || !Array.isArray(b.visitas)) throw new Error('Faltan casos o visitas');
    const tC = new sql.Table('dbo.CV_Casos'); tC.create = false;
    tC.columns.add('orden', sql.Int, { nullable: false }); tC.columns.add('nro', sql.NVarChar(40), { nullable: true });
    tC.columns.add('reciente', sql.Bit, { nullable: false }); tC.columns.add('datos', sql.NVarChar(sql.MAX), { nullable: false });
    b.casos.forEach((c, i) => tC.rows.add(i + 1, String((c.d && c.d.nro) == null ? '' : c.d.nro).slice(0, 40), c.r ? 1 : 0, JSON.stringify(c.d || {})));
    const tV = new sql.Table('dbo.CV_Visitas'); tV.create = false;
    tV.columns.add('orden', sql.Int, { nullable: false }); tV.columns.add('nro', sql.NVarChar(40), { nullable: true });
    tV.columns.add('datos', sql.NVarChar(sql.MAX), { nullable: false });
    b.visitas.forEach((v, i) => tV.rows.add(i + 1, String((v && v.nro) == null ? '' : v.nro).slice(0, 40), JSON.stringify(v || {})));

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await tx.request().query('DELETE FROM dbo.CV_Casos; DELETE FROM dbo.CV_Visitas;');
      if (b.casos.length) await tx.request().bulk(tC);
      if (b.visitas.length) await tx.request().bulk(tV);
      await tx.request().input('v', sql.NVarChar(400), 'casos=' + b.casos.length + ' visitas=' + b.visitas.length)
        .query(`MERGE dbo.CV_Estado AS x USING (SELECT 'ultima_carga' AS clave) AS s ON x.clave = s.clave
                WHEN MATCHED THEN UPDATE SET valor = @v, actualizado = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES ('ultima_carga', @v);`);
      await tx.commit();
    } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
    context.res = { status: 200, body: { success: true, casos: b.casos.length, visitas: b.visitas.length } };
  } catch (e) {
    context.res = { status: 500, body: { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') } };
  }
};
