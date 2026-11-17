/* mant-unidades.sql — _MANT_UNIDADES_V1 (17-nov-2026)
   Catalogo de unidades (flota de Mantenimiento): una fila por codigo interno.
   "Disponible" / "Asignada" NO se guardan: se calculan con rl.mant_responsables (quien tiene ese codigo).
   Aqui solo se guarda el estado fisico: OPERATIVA, EN TALLER o DE BAJA.
   La primera vez que la Ficha pide las unidades, se cargan solas con los codigos que ya existen.
   Idempotente. Uso: cd C:\sistema-rl-verfrut\migracion ; node aplicar-sql.js mant-unidades.sql */
CREATE TABLE IF NOT EXISTS rl."mant_unidades" (
  "cod_interno" extensions.citext NOT NULL,
  "marca" extensions.citext,
  "modelo" extensions.citext,
  "anio" extensions.citext,
  "cod_sist" extensions.citext,
  "n_motor" extensions.citext,
  "n_chasis" extensions.citext,
  "estado" extensions.citext,
  "obs" extensions.citext,
  "actualizado" extensions.citext,
  "por" extensions.citext,
  PRIMARY KEY ("cod_interno")
);
