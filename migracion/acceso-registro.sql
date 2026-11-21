-- _MODULOS_GUARD_V1 (21-nov-2026): registro del control central de modulos (modo registro: que se habria bloqueado).
-- Tabla nueva y pequeña (una fila por dia/usuario/ruta/accion/modulo, con contador). No toca nada existente.
CREATE TABLE IF NOT EXISTS rl.acceso_registro (
  dia      date NOT NULL,
  usuario  extensions.citext NOT NULL,
  fn       text NOT NULL,
  accion   text NOT NULL DEFAULT '',
  modulo   text NOT NULL,
  n        integer NOT NULL DEFAULT 1,
  ultimo   timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  PRIMARY KEY (dia, usuario, fn, accion, modulo)
);
SELECT count(*) AS filas FROM rl.acceso_registro;
