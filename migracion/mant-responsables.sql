/* mant-responsables.sql — _MANT_RESP_V1 (17-nov-2026)
   Responsables de unidades (Mantenimiento): una fila por persona con las columnas de la hoja
   "BB.DD. RESPONSABLES" (A-V) + usuario del sistema y quien edito. Nace directo en Supabase. Idempotente.
   Uso: cd C:\sistema-rl-verfrut\migracion ; node aplicar-sql.js mant-responsables.sql */
CREATE TABLE IF NOT EXISTS rl."mant_responsables" (
  "dni" extensions.citext NOT NULL,
  "nombre" extensions.citext,
  "correo" extensions.citext,
  "cargo" extensions.citext,
  "modelo" extensions.citext,
  "marca" extensions.citext,
  "cod_interno" extensions.citext,
  "cod_sist" extensions.citext,
  "n_motor" extensions.citext,
  "n_chasis" extensions.citext,
  "anio" extensions.citext,
  "estatus" extensions.citext,
  "zona_recorrido" extensions.citext,
  "n_licencia" extensions.citext,
  "f_expedicion" extensions.citext,
  "f_revalidacion" extensions.citext,
  "empresa" extensions.citext,
  "zona_abastecimiento" extensions.citext,
  "municipalidad" extensions.citext,
  "n_licencia_carro" extensions.citext,
  "f_expedicion_carro" extensions.citext,
  "f_revalidacion_carro" extensions.citext,
  "usuario_sistema" extensions.citext,
  "actualizado" extensions.citext,
  "por" extensions.citext,
  PRIMARY KEY ("dni")
);
