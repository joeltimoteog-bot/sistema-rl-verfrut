/* calc-parametros.sql — _CALC_SUPABASE_V1 (19-nov-2026)
   Parametros OFICIALES del Calculo Remunerativo (RMV, Rem. Bruta, tasas AFP, jornadas, feriados).
   Antes vivian solo en la hoja de Google CALCULO_PARAMETROS (una fila por publicacion; vale la ultima).
   Aqui igual: una fila por version publicada; la pantalla usa la mas reciente.
   Trae la version publicada hoy en la hoja (v20261002-062851, de jtimoteo). No contiene datos personales.
   Idempotente. Uso: cd C:\sistema-rl-verfrut\migracion ; node aplicar-sql.js calc-parametros.sql */
CREATE TABLE IF NOT EXISTS rl."calc_parametros" (
  "version" text NOT NULL,
  "fecha" timestamptz NOT NULL DEFAULT now(),
  "publicado_por" text,
  "rmv" numeric,
  "rem_bruta" numeric,
  "base_beta_af" text,
  "parametros_json" text NOT NULL,
  PRIMARY KEY ("version")
);
ALTER TABLE rl."calc_parametros" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rl."calc_parametros" FROM anon, authenticated;
INSERT INTO rl."calc_parametros" ("version", "fecha", "publicado_por", "rmv", "rem_bruta", "base_beta_af", "parametros_json")
VALUES ('v20261002-062851', '2026-10-02 11:28:51+00', 'jtimoteo', 1230, 1554.47, 'rmv',
  '{"remBruta":1554.47,"rmv":1230,"baseBetaAF":"rmv","factorBruta":1.2638,"pctCTS":0.0972,"pctGratif":0.1666,"pctBonif":0.06,"pctAF":0.1,"pctBETA":0.3,"tarifaBonoAplicacion":9.2,"afps":[{"nombre":"HABITAT","flujo":0.1284,"mixta":0.1137},{"nombre":"INTEGRA","flujo":0.1292,"mixta":0.1137},{"nombre":"PRIMA","flujo":0.1297,"mixta":0.1137},{"nombre":"PROFUTURO","flujo":0.1306,"mixta":0.1137},{"nombre":"ONP","flujo":0.13,"mixta":0.13}],"jornadaAltaLV":9.6,"jornadaBajaLV":8.45,"jornadaBajaSab":5.75,"feriados":["2026-01-01","2026-04-17","2026-04-18","2026-05-01","2026-06-07","2026-06-29","2026-07-23","2026-07-25","2026-07-29","2026-08-06","2026-08-30","2026-10-08","2026-11-01","2026-12-08","2026-12-09","2026-12-25"]}')
ON CONFLICT ("version") DO NOTHING;
SELECT count(*) AS versiones, max("version") AS ultima FROM rl."calc_parametros";
