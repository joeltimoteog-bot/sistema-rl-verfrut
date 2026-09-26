/* Tabla del motor de Cumplimiento en Azure (_CUMPL_AZURE_V1). Se crea sola.
   Una fila por bloque de datos (casos, config, usuarios, sups, restricc, constantes). */
let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.CUMPL_Datos', 'U') IS NULL
      CREATE TABLE dbo.CUMPL_Datos (clave NVARCHAR(40) NOT NULL CONSTRAINT PK_CUMPL_Datos PRIMARY KEY,
        datos NVARCHAR(MAX) NOT NULL, actualizado DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());`)
    .catch(e => { listo = null; throw e; });
  return listo;
}
const CLAVES = ['casos', 'config', 'usuarios', 'sups', 'restricc', 'constantes'];
module.exports = { asegurarTablas, CLAVES };
