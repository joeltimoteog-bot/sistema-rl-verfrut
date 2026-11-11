-- 02-tablas-eti-anidadas-REVERTIR.sql — deshace _TABLAS_ETI_V2. Borra SOLO lo creado por 02-tablas-eti-anidadas.sql.
-- Las tablas de origen y las de la primera parte no se tocan.
BEGIN;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['banco_historial', 'config_eti', 'evaluaciones_conocimiento', 'sesiones_qr', 'evaluaciones_depuradas', 'informes_cap', 'programaciones_eval'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'eti' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_tablas_eti2 ON eti.%I', t);
    END IF;
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS eti.tablas_reconstruir2();
DROP FUNCTION IF EXISTS eti._tr_tablas2();
DROP FUNCTION IF EXISTS eti._copiar2(text, text, jsonb);
DROP FUNCTION IF EXISTS eti._copiar_banco(text, boolean, jsonb);
DROP FUNCTION IF EXISTS eti._borrar2(text, text);
DROP TABLE IF EXISTS eti.banco_preguntas, eti.banco_secciones, eti.banco_versiones, eti.cfg_accesos, eti.cfg_atribucion, eti.cfg_coberturas, eti.cfg_respaldo,
  eti.eval_manual_ruta_secciones, eti.eval_manual_fechas_programadas, eti.qr_sesion_preguntas, eti.qr_sesion_secciones, eti.eval_depurada_ruta_secciones, eti.eval_depurada_rutas,
  eti.eval_depuradas, eti.cap_informe_fotos, eti.cap_informes, eti.eval_programacion_fechas, eti.eval_programaciones;
COMMIT;
