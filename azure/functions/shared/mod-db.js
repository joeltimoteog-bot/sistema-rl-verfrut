/* _MOD_AZURE_V1 (26-set-2026) — datos de modulos pequeños en Azure (Horas, Capacitaciones...).
   Una fila por (modulo, clave). Se crea sola. */
let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.MOD_Datos', 'U') IS NULL
      CREATE TABLE dbo.MOD_Datos (modulo NVARCHAR(40) NOT NULL, clave NVARCHAR(40) NOT NULL, datos NVARCHAR(MAX) NOT NULL,
        actualizado DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), CONSTRAINT PK_MOD_Datos PRIMARY KEY (modulo, clave));`)
    .catch(e => { listo = null; throw e; });
  return listo;
}
/* claves obligatorias de cada modulo (si falta alguna -> 503 y la pantalla usa Google) */
const CLAVES = { horas: ['registros', 'motivos', 'config'], cap: ['hdr', 'bbdd'] };
module.exports = { asegurarTablas, CLAVES };
