/* ═══════════════════════════════════════════════════════════════════════════
   cumpl-importar (_CUMPL_AZURE_V1, 26-set-2026) — el Apps Script manda aqui
   los datos que usa el motor de Cumplimiento (casos con fechas de plazo y
   cierre, configuracion, usuarios, supervisores de campo, restricciones
   levantadas y calendario). Se reemplazan en una transaccion.
   POST { casos, config, usuarios, sups, restricc, constantes }
   GET  -> cuantos hay y cuando fue la ultima carga (hora Lima)
   Solo con la llave de la funcion.
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const { asegurarTablas, CLAVES } = require('../shared/cumpl-db');

module.exports = async function (context, req) {
  try {
    const pool = await getPool(); await asegurarTablas(pool);
    if (req.method === 'GET') {
      const r = await pool.request().query(`SELECT clave, LEN(datos) AS largo, CONVERT(VARCHAR(19), DATEADD(HOUR, -5, actualizado), 120) AS lima FROM dbo.CUMPL_Datos`);
      const out = { success: true };
      r.recordset.forEach(f => { out[f.clave] = { largo: f.largo, actualizado_lima: f.lima }; });
      try { const c = await pool.request().query("SELECT datos FROM dbo.CUMPL_Datos WHERE clave IN ('casos','usuarios')");
            c.recordset.forEach(f => { const j = JSON.parse(f.datos); if (j.length && j[0] && 'estado_gestion' in j[0]) out.n_casos = j.length; else out.n_usuarios = j.length; }); } catch (e) {}
      context.res = { status: 200, body: out };
      return;
    }
    const b = req.body || {};
    const faltan = CLAVES.filter(k => b[k] === undefined || b[k] === null);
    if (faltan.length) throw new Error('Faltan datos: ' + faltan.join(', '));
    if (!Array.isArray(b.casos) || !Array.isArray(b.usuarios) || !Array.isArray(b.sups) || !Array.isArray(b.restricc)) throw new Error('Formato invalido');
    if (!b.usuarios.length) throw new Error('Lista de usuarios vacia: no se reemplaza nada');
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const k of CLAVES) {
        await tx.request().input('k', sql.NVarChar(40), k).input('d', sql.NVarChar(sql.MAX), JSON.stringify(b[k]))
          .query(`MERGE dbo.CUMPL_Datos AS x USING (SELECT @k AS clave) AS s ON x.clave = s.clave
                  WHEN MATCHED THEN UPDATE SET datos = @d, actualizado = SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT (clave, datos) VALUES (@k, @d);`);
      }
      await tx.commit();
    } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
    context.res = { status: 200, body: { success: true, casos: b.casos.length, usuarios: b.usuarios.length, sups: b.sups.length, restricc: b.restricc.length } };
  } catch (e) {
    context.res = { status: 500, body: { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') } };
  }
};
