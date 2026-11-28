-- REVERTIR _PROGETI_SUPABASE_V1: borra la tabla de la proyeccion anual SOLO si esta vacia (la copia sigue en Firestore).
DO $$ BEGIN
  IF to_regclass('eti.progeti_plan') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM eti.progeti_plan) THEN DROP TABLE eti.progeti_plan; END IF;
END $$;
