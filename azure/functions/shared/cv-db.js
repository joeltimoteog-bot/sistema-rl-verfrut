/* Tablas de Casos y Visitas en Azure (_CV_AZURE_V1). Se crean solas. */
let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.CV_Casos', 'U') IS NULL
      CREATE TABLE dbo.CV_Casos (orden INT NOT NULL CONSTRAINT PK_CV_Casos PRIMARY KEY, nro NVARCHAR(40) NULL,
        reciente BIT NOT NULL DEFAULT 0, datos NVARCHAR(MAX) NOT NULL);
    IF OBJECT_ID('dbo.CV_Visitas', 'U') IS NULL
      CREATE TABLE dbo.CV_Visitas (orden INT NOT NULL CONSTRAINT PK_CV_Visitas PRIMARY KEY, nro NVARCHAR(40) NULL,
        datos NVARCHAR(MAX) NOT NULL);
    IF OBJECT_ID('dbo.CV_Estado', 'U') IS NULL
      CREATE TABLE dbo.CV_Estado (clave NVARCHAR(40) NOT NULL PRIMARY KEY, valor NVARCHAR(400) NULL,
        actualizado DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());`)
    .catch(e => { listo = null; throw e; });
  return listo;
}
module.exports = { asegurarTablas };
