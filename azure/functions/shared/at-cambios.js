/* ═══════════════════════════════════════════════════════════════════════════
   at-cambios (_AT_CAMBIOS_V1, 01-oct-2026) — "¿que atenciones cambiaron desde X?"
   Columna dbo.Atenciones.modificado (hora UTC de Azure SQL):
     · fila nueva  -> la llena sola (DEFAULT), venga de donde venga.
     · edicion     -> la ponen atenciones-editar, atenciones-update y la
                      sincronizacion desde la hoja (atenciones-create).
   Las filas antiguas quedan en NULL (no "cambiaron"). Se crea sola, con su indice.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
let listo = null;
function asegurar(pool) {
  if (!listo) listo = pool.request().query(`
      IF COL_LENGTH('dbo.Atenciones', 'modificado') IS NULL
        ALTER TABLE dbo.Atenciones ADD modificado DATETIME2(3) NULL CONSTRAINT DF_Atenciones_modificado DEFAULT SYSUTCDATETIME();`)
    .then(() => pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Atenciones_modificado' AND object_id = OBJECT_ID('dbo.Atenciones'))
        CREATE INDEX IX_Atenciones_modificado ON dbo.Atenciones (modificado);`))
    .catch(e => { listo = null; throw e; });
  return listo;
}
module.exports = { asegurar };
