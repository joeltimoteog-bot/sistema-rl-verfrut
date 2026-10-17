/* ═══════════════════════════════════════════════════════════════════════════
   cap-firmas (_CAP_FIRMA_DIGITAL_V1, 16-oct-2026) — firmas digitales de asistentes a capacitaciones
   POST /api/cap-firmas/guardar  { idCapacitacion, firmas:[{dni, codigo, nombre, fecha, metodo}] }
   POST /api/cap-firmas/listar   { idCapacitacion }  ->  { success, firmas:[...] }
   Tabla NUEVA dbo.Cap_Firmas (se crea sola). No toca cap_cabeceras / cap_asistentes ni Google.
   Una firma por (idCapacitacion, dni): si llega de nuevo, se actualiza.
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

async function asegurar(pool) {
  await pool.request().query(`IF OBJECT_ID('dbo.Cap_Firmas', 'U') IS NULL CREATE TABLE dbo.Cap_Firmas (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    id_capacitacion NVARCHAR(60) NOT NULL, dni NVARCHAR(20) NOT NULL, codigo NVARCHAR(50) NULL, nombre NVARCHAR(300) NULL,
    fecha_firma DATETIME2(0) NULL, metodo NVARCHAR(20) NULL, registrado_por NVARCHAR(100) NULL,
    creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Cap_Firmas UNIQUE (id_capacitacion, dni));`);
}
const s = (v, n) => { v = String(v == null ? '' : v).trim(); return v ? v.slice(0, n) : null; };

module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  if (req.method === 'OPTIONS') { context.res = { status: 204 }; return; }
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;
  try {
    const b = req.body || {}, id = s(b.idCapacitacion, 60);
    if (!id) { context.res = { status: 400, body: { success: false, error: 'Falta idCapacitacion' } }; return; }
    const pool = await getPool(); await asegurar(pool);
    if (accion === 'listar') {
      const r = await pool.request().input('id', sql.NVarChar(60), id)
        .query('SELECT dni, codigo, nombre, fecha_firma, metodo, registrado_por FROM dbo.Cap_Firmas WHERE id_capacitacion = @id');
      context.res = { status: 200, body: { success: true, idCapacitacion: id, firmas: r.recordset.map(x => ({ dni: x.dni, codigo: x.codigo || '', nombre: x.nombre || '', fecha: x.fecha_firma ? new Date(x.fecha_firma).toISOString() : '', metodo: x.metodo || '', por: x.registrado_por || '' })) } };
      return;
    }
    if (accion === 'guardar') {
      const firmas = Array.isArray(b.firmas) ? b.firmas : [];
      const por = s((authUser && authUser.usuario) || b.usuario, 100);
      let n = 0;
      for (const f of firmas.slice(0, 500)) {
        const dni = s(f.dni, 20); if (!dni) continue;
        let fecha = null; try { const d = new Date(f.fecha); if (!isNaN(d)) fecha = d; } catch (e) {}
        await pool.request().input('id', sql.NVarChar(60), id).input('dni', sql.NVarChar(20), dni)
          .input('cod', sql.NVarChar(50), s(f.codigo, 50)).input('nom', sql.NVarChar(300), s(f.nombre, 300))
          .input('fec', sql.DateTime2(0), fecha).input('met', sql.NVarChar(20), s(f.metodo, 20) || 'QR').input('por', sql.NVarChar(100), por)
          .query(`MERGE dbo.Cap_Firmas AS t USING (SELECT @id AS id_capacitacion, @dni AS dni) AS src
                  ON t.id_capacitacion = src.id_capacitacion AND t.dni = src.dni
                  WHEN MATCHED THEN UPDATE SET codigo = @cod, nombre = @nom, fecha_firma = @fec, metodo = @met, registrado_por = @por
                  WHEN NOT MATCHED THEN INSERT (id_capacitacion, dni, codigo, nombre, fecha_firma, metodo, registrado_por) VALUES (@id, @dni, @cod, @nom, @fec, @met, @por);`);
        n++;
      }
      context.res = { status: 200, body: { success: true, idCapacitacion: id, guardadas: n } };
      return;
    }
    context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } };
  } catch (e) {
    context.log.error('[cap-firmas] ' + accion + ': ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
