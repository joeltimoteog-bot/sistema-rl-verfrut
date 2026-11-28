-- ═══════════════════════════════════════════════════════════════════════════
--  crear-progeti-plan.sql — _PROGETI_SUPABASE_V1 (27-nov-2026)
--  Tabla de la PROYECCION ANUAL de Programacion ETI (coleccion progeti_plan de Firestore).
--  Misma estructura que las demas tablas eti.<coleccion>. Solo CREA (IF NOT EXISTS): no borra ni cambia nada.
--  Sin permisos para anon/authenticated (igual que las otras tablas eti): solo el servidor la usa.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.progeti_plan (
  id          text PRIMARY KEY,
  datos       jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado      timestamptz NOT NULL DEFAULT now(),
  actualizado timestamptz NOT NULL DEFAULT now(),
  origen      text);
CREATE INDEX IF NOT EXISTS progeti_plan_gin   ON eti.progeti_plan USING gin (datos jsonb_path_ops);
CREATE INDEX IF NOT EXISTS progeti_plan_fecha ON eti.progeti_plan ((datos->>'fecha'));

-- comprobacion (debe salir: existe = eti.progeti_plan, filas = 0)
SELECT to_regclass('eti.progeti_plan') AS existe, (SELECT count(*) FROM eti.progeti_plan) AS filas;
