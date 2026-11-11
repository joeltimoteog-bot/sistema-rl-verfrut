-- 01-tablas-eti-REVERTIR.sql — deshace _TABLAS_ETI_V1. Borra SOLO lo creado por 01-tablas-eti.sql.
-- Las tablas de origen (eti.capacitaciones, eti.programaciones_eti, ...) no se tocan.
BEGIN;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['capacitaciones', 'programaciones_eti', 'evaluaciones_conocimiento', 'sesiones_qr', 'respuestas_qr', 'informes_enviados', 'supervisores_eti', 'usuarios_eti'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'eti' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_tablas_eti ON eti.%I', t);
    END IF;
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS eti.tablas_reconstruir();
DROP FUNCTION IF EXISTS eti._tr_tablas();
DROP FUNCTION IF EXISTS eti._copiar(text, text, jsonb);
DROP FUNCTION IF EXISTS eti._borrar(text, text);
DROP TABLE IF EXISTS eti.cap_registro_rutas, eti.cap_registro_codigos, eti.cap_registros, eti.prog_fechas, eti.prog_reprogramaciones, eti.prog_solicitudes, eti.prog_programaciones,
  eti.eval_manual_rutas, eti.eval_manuales, eti.qr_sesiones, eti.qr_respuesta_preguntas, eti.qr_respuesta_secciones, eti.qr_respuestas, eti.eval_informes_dia, eti.supervisores, eti.usuarios, eti._tablas_errores;
DROP FUNCTION IF EXISTS eti._i(text);
DROP FUNCTION IF EXISTS eti._f(text); DROP FUNCTION IF EXISTS eti._t(text); DROP FUNCTION IF EXISTS eti._n(text);
DROP FUNCTION IF EXISTS eti._b(text); DROP FUNCTION IF EXISTS eti._l(jsonb); DROP FUNCTION IF EXISTS eti._x(text);
COMMIT;
