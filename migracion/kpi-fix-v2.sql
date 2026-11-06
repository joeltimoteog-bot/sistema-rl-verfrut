-- ═══════════════════════════════════════════════════════════════════════════
--  kpi-fix-v2.sql — _KPI_CANDADOS_V1 + _KPI_FIX_V2 (06-nov-2026)
--  En Azure SQL, triggers impedian EDITAR o BORRAR la bitacora de alertas KPI, las notas y los
--  meses cerrados (evidencia de auditoria). Al pasar a Supabase no se migraron. Esto los recrea
--  en Postgres con la MISMA regla:
--    · rl.kpi_alertas  : no se borra; solo se puede marcar enviado/destinatarios una vez (de NULL a fecha).
--    · rl.kpi_notas    : no se edita ni se borra (se registra una nueva).
--    · rl.kpi_cierremes: un mes cerrado no se edita ni se borra.
--  Ademas (_KPI_FIX_V2): 2 columnas nuevas en la copia ETI que lee el KPI K3:
--    rl.eti_programaciones.registro_ids (todos los registros ligados) y .ejecuciones (fecha REAL de cada registro).
--  Solo CREA (idempotente). No toca datos.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rl.kpi_alertas_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'La bitacora de alertas KPI no se puede editar ni borrar'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clave IS DISTINCT FROM OLD.clave OR NEW.mensaje IS DISTINCT FROM OLD.mensaje
     OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.usuario IS DISTINCT FROM OLD.usuario OR NEW.creado IS DISTINCT FROM OLD.creado
     OR (OLD.enviado IS NOT NULL AND (NEW.enviado IS DISTINCT FROM OLD.enviado OR NEW.destinatarios IS DISTINCT FROM OLD.destinatarios)) THEN
    RAISE EXCEPTION 'La bitacora de alertas KPI no se puede editar ni borrar';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION rl.kpi_notas_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Las notas registradas no se editan ni se borran: registre una nueva'; END $$;
CREATE OR REPLACE FUNCTION rl.kpi_cierremes_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Un mes cerrado no se edita ni se borra'; END $$;

DROP TRIGGER IF EXISTS tr_kpi_alertas_inmutable ON rl.kpi_alertas;
CREATE TRIGGER tr_kpi_alertas_inmutable BEFORE UPDATE OR DELETE ON rl.kpi_alertas FOR EACH ROW EXECUTE FUNCTION rl.kpi_alertas_inmutable();
DROP TRIGGER IF EXISTS tr_kpi_notas_inmutable ON rl.kpi_notas;
CREATE TRIGGER tr_kpi_notas_inmutable BEFORE UPDATE OR DELETE ON rl.kpi_notas FOR EACH ROW EXECUTE FUNCTION rl.kpi_notas_inmutable();
DROP TRIGGER IF EXISTS tr_kpi_cierremes_inmutable ON rl.kpi_cierremes;
CREATE TRIGGER tr_kpi_cierremes_inmutable BEFORE UPDATE OR DELETE ON rl.kpi_cierremes FOR EACH ROW EXECUTE FUNCTION rl.kpi_cierremes_inmutable();

ALTER TABLE rl.eti_programaciones ADD COLUMN IF NOT EXISTS registro_ids text NULL;
ALTER TABLE rl.eti_programaciones ADD COLUMN IF NOT EXISTS ejecuciones  text NULL;
