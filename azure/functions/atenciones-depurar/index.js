/* ═══════════════════════════════════════════════════════════════════════════
   atenciones-depurar (_DEPURAR_V1, 26-set-2026) — limpieza AUTORIZADA por Joel
   Solo con la llave de la funcion. Nada se pierde: toda fila borrada o cambiada
   se copia antes (completa, en JSON) a dbo.Atenciones_Respaldo.

   /api/mantenimiento/atenciones/duplicados            -> vista previa
   /api/mantenimiento/atenciones/duplicados?aplicar=1  -> deja UNA copia (la mas
        antigua) de cada atencion repetida (mismo N° + DNI + fecha)
   POST /api/mantenimiento/atenciones/fechas  { cambios:[{nro,dni,fecha}], aplicar }
        -> corrige la fecha segun la hoja. Solo si hay EXACTAMENTE 1 registro con
           ese N° + DNI (DNI sin ceros a la izquierda); si no, lo reporta y no toca.
   /api/mantenimiento/atenciones/respaldo              -> cuantas filas hay respaldadas
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');

const TOPE_DUPLICADOS = 1500;   // freno: si aparecieran mas de los ~965 esperados, no se borra nada

async function asegurarRespaldo(pool) {
  await pool.request().query(`IF OBJECT_ID('dbo.Atenciones_Respaldo', 'U') IS NULL
    CREATE TABLE dbo.Atenciones_Respaldo (rid INT IDENTITY(1,1) PRIMARY KEY, id INT NOT NULL,
      datos NVARCHAR(MAX) NOT NULL, motivo NVARCHAR(100) NOT NULL, fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());`);
}

const DUP_CTE = `;WITH g AS (
    SELECT id, nro, fecha_atencion, LTRIM(RTRIM(dni)) AS dni,
           ROW_NUMBER() OVER (PARTITION BY nro, LTRIM(RTRIM(dni)), fecha_atencion ORDER BY id) AS rn
    FROM dbo.Atenciones WHERE fecha_atencion IS NOT NULL AND nro IS NOT NULL)`;

async function duplicados(pool, aplicar) {
  const r = await pool.request().query(DUP_CTE + `
    SELECT CONVERT(CHAR(7), fecha_atencion, 120) AS mes, COUNT(*) AS n FROM g WHERE rn > 1 GROUP BY CONVERT(CHAR(7), fecha_atencion, 120) ORDER BY mes`);
  const porMes = {}; let total = 0;
  r.recordset.forEach(x => { porMes[x.mes] = x.n; total += x.n; });
  const ej = await pool.request().query(DUP_CTE + ` SELECT TOP 8 id, nro, dni, CONVERT(CHAR(10), fecha_atencion, 120) AS fecha FROM g WHERE rn > 1 ORDER BY id`);
  if (!aplicar) return { success: true, vistaPrevia: true, aBorrar: total, porMes, ejemplos: ej.recordset };
  if (total > TOPE_DUPLICADOS) return { success: false, error: 'Freno: ' + total + ' repetidos (> ' + TOPE_DUPLICADOS + '). No se borro nada.', porMes };
  if (!total) return { success: true, borradas: 0 };
  await asegurarRespaldo(pool);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const q = await tx.request().query(DUP_CTE + `
      SELECT id INTO #del FROM g WHERE rn > 1;
      INSERT INTO dbo.Atenciones_Respaldo (id, datos, motivo)
        SELECT a.id, (SELECT a.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), 'duplicado 26-set' FROM dbo.Atenciones a JOIN #del d ON d.id = a.id;
      DECLARE @resp INT = @@ROWCOUNT;
      DELETE a FROM dbo.Atenciones a JOIN #del d ON d.id = a.id;
      SELECT @resp AS respaldadas, @@ROWCOUNT AS borradas;`);
    const x = q.recordset[0];
    if (x.respaldadas !== x.borradas) throw new Error('Respaldo (' + x.respaldadas + ') distinto de borradas (' + x.borradas + ')');
    await tx.commit();
    return { success: true, respaldadas: x.respaldadas, borradas: x.borradas, porMes };
  } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
}

async function fechas(pool, b) {
  const cambios = Array.isArray(b.cambios) ? b.cambios : [];
  if (!cambios.length) throw new Error('Faltan cambios');
  const aplicar = !!b.aplicar, out = [];
  if (aplicar) await asegurarRespaldo(pool);
  for (const c of cambios) {
    const dniN = String(c.dni || '').trim().replace(/^0+/, '');
    const f = String(c.fecha || '').slice(0, 10);
    if (!c.nro || !dniN || !/^\d{4}-\d{2}-\d{2}$/.test(f)) { out.push({ nro: c.nro, estado: 'datos invalidos' }); continue; }
    const r = await pool.request().input('nro', sql.Int, c.nro).input('d', sql.NVarChar(20), dniN)
      .query(`SELECT id, CONVERT(CHAR(10), fecha_atencion, 120) AS fecha FROM dbo.Atenciones
              WHERE nro = @nro AND SUBSTRING(LTRIM(RTRIM(dni)), PATINDEX('%[^0]%', LTRIM(RTRIM(dni)) + '.'), 20) = @d`);
    if (r.recordset.length !== 1) { out.push({ nro: c.nro, estado: 'no se toca: ' + r.recordset.length + ' registros con ese N°+DNI' }); continue; }
    const fila = r.recordset[0];
    if (fila.fecha === f) { out.push({ nro: c.nro, estado: 'ya estaba bien' }); continue; }
    if (!aplicar) { out.push({ nro: c.nro, id: fila.id, estado: 'cambiaria ' + (fila.fecha || 'vacia') + ' -> ' + f }); continue; }
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await tx.request().input('id', sql.Int, fila.id).query(`INSERT INTO dbo.Atenciones_Respaldo (id, datos, motivo)
        SELECT a.id, (SELECT a.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), 'cambio de fecha 26-set' FROM dbo.Atenciones a WHERE a.id = @id`);
      await tx.request().input('id', sql.Int, fila.id).input('f', sql.Date, f)
        .query('UPDATE dbo.Atenciones SET fecha_atencion = @f, mes = MONTH(@f), anio = YEAR(@f) WHERE id = @id');
      await tx.commit();
      out.push({ nro: c.nro, id: fila.id, estado: 'corregida ' + (fila.fecha || 'vacia') + ' -> ' + f });
    } catch (e) { try { await tx.rollback(); } catch (e2) {} out.push({ nro: c.nro, estado: 'error: ' + e.message }); }
  }
  return { success: true, aplicar, resultados: out };
}

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  try {
    const pool = await getPool();
    let body;
    if (accion === 'duplicados') body = await duplicados(pool, String((req.query && req.query.aplicar) || '') === '1');
    else if (accion === 'fechas') body = await fechas(pool, req.body || {});
    else if (accion === 'respaldo') { await asegurarRespaldo(pool); const r = await pool.request().query('SELECT motivo, COUNT(*) AS n FROM dbo.Atenciones_Respaldo GROUP BY motivo'); body = { success: true, respaldo: r.recordset }; }
    else { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    context.res = { status: body.success ? 200 : 409, body };
  } catch (e) {
    context.res = { status: 500, body: { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') } };
  }
};
