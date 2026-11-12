-- Deshace 01-prec-bloqueo.sql. OJO: borra la tabla de bloqueos y las columnas nuevas de precedentes
-- (lo que se haya escrito en ellas se pierde). Los precedentes anteriores no se tocan.
BEGIN;
SET LOCAL search_path TO rl, public, extensions;
DROP TABLE IF EXISTS rl.at_bloqueos;
DROP INDEX IF EXISTS rl.ix_casos_precedentes_creado_por;
DROP INDEX IF EXISTS rl.ix_casos_dni;
ALTER TABLE rl.casos_precedentes DROP COLUMN IF EXISTS ruta, DROP COLUMN IF EXISTS cod_trabajador, DROP COLUMN IF EXISTS area,
  DROP COLUMN IF EXISTS motivo_falta, DROP COLUMN IF EXISTS creado_sector, DROP COLUMN IF EXISTS creado_nombre;
COMMIT;
