/* bs-mover-a-rl.sql — 08-nov-2026
   Corrección: bs-auditoria.sql (07-nov) y bs-escritura.sql (08-nov) crearon sus tablas sin esquema y la conexión de
   migracion\.env tiene search_path "$user", public → quedaron en public. La Edge las encontraba (search_path rl, public),
   pero public es el esquema expuesto por la API de Supabase. Aquí se MUEVEN a rl (ALTER ... SET SCHEMA: conserva filas,
   índices y triggers; no borra nada). Idempotente: si ya están en rl, no hace nada.
   Uso: cd C:\sistema-rl-verfrut\migracion ; node aplicar-sql.js bs-mover-a-rl.sql */
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bs_auditoria','bs_auditoria__carga','bs_rendiciones','bs_rendiciones__carga','bs_sugerencias','bs_sugerencias__carga','bs_buzones','bs_buzones__carga','bs_fuente'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      IF to_regclass('rl.' || t) IS NOT NULL THEN RAISE EXCEPTION 'Existe public.% y también rl.%: revisar a mano antes de mover', t, t; END IF;
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA rl', t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'bs_auditoria_inmutable' AND n.nspname = 'public') THEN
    ALTER FUNCTION public.bs_auditoria_inmutable() SET SCHEMA rl;
  END IF;
END $$;
/* la función queda con el esquema explícito para no depender del search_path de quien la dispare */
CREATE OR REPLACE FUNCTION rl.bs_auditoria_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f text;
BEGIN
  SELECT fuente INTO f FROM rl.bs_fuente WHERE clave = 'bs_auditoria';
  IF f = 'supabase' THEN RAISE EXCEPTION 'bs_auditoria es inmutable: no se puede % una fila de auditoría', TG_OP; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'TRUNCATE' THEN RETURN NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bs_auditoria_inmutable_fila ON rl.bs_auditoria;
CREATE TRIGGER bs_auditoria_inmutable_fila BEFORE UPDATE OR DELETE ON rl.bs_auditoria FOR EACH ROW EXECUTE FUNCTION rl.bs_auditoria_inmutable();
DROP TRIGGER IF EXISTS bs_auditoria_inmutable_tabla ON rl.bs_auditoria;
CREATE TRIGGER bs_auditoria_inmutable_tabla BEFORE TRUNCATE ON rl.bs_auditoria FOR EACH STATEMENT EXECUTE FUNCTION rl.bs_auditoria_inmutable();
