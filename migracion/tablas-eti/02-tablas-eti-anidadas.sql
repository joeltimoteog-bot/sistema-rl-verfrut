-- 02-tablas-eti-anidadas.sql — _TABLAS_ETI_V2 (11-nov-2026, pedido de Joel: "tablas por modulo, no amontonadas")
-- Segunda parte: los documentos ANIDADOS de los ETI pasan a tablas con columnas propias:
--   · banco de preguntas vigente (eti.config_eti 'banco') y sus versiones anteriores (eti.banco_historial)
--   · configuracion: accesos, atribucion de sectores, coberturas y respaldo (eti.config_eti)
--   · detalle por seccion de cada ruta en las evaluaciones manuales (eti.evaluaciones_conocimiento)
--   · cuestionario guardado en cada codigo QR (eti.sesiones_qr)
--   · evaluaciones depuradas (eti.evaluaciones_depuradas)
--   · informe de capacitacion (eti.informes_cap) y programacion de checklist (eti.programaciones_eval)
-- Requiere 01-tablas-eti.sql. Mismo metodo: las tablas de origen no se tocan; un disparador copia cada cambio; si la
-- copia falla, el guardado original sigue y el error queda en eti._tablas_errores. Columnas segun el inventario real
-- (inventario-anidado-eti.js, 11-nov-2026). Deshacer: 02-tablas-eti-anidadas-REVERTIR.sql.

BEGIN;

-- ══ BANCO DE PREGUNTAS ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.banco_versiones (
  id text PRIMARY KEY, vigente boolean NOT NULL DEFAULT false, version integer,
  guardado_por text, guardado_en timestamptz, marca_tiempo bigint, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.banco_versiones IS 'Versiones del banco de preguntas de Evaluaciones ETI. vigente = la que se usa hoy. Origen: eti.config_eti (banco) y eti.banco_historial';
CREATE TABLE IF NOT EXISTS eti.banco_secciones (
  version_id text NOT NULL REFERENCES eti.banco_versiones (id) ON DELETE CASCADE,
  orden integer NOT NULL, seccion text, nombre text, peso numeric, PRIMARY KEY (version_id, orden));
COMMENT ON TABLE eti.banco_secciones IS 'Secciones de cada version del banco, con su peso';
CREATE TABLE IF NOT EXISTS eti.banco_preguntas (
  version_id text NOT NULL, seccion_orden integer NOT NULL, orden integer NOT NULL,
  numero integer, texto text, texto_qr text, tipo text, opciones text[], maximo integer, porcentaje numeric,
  revisar boolean, visto_bueno boolean, origen text,
  PRIMARY KEY (version_id, seccion_orden, orden),
  FOREIGN KEY (version_id, seccion_orden) REFERENCES eti.banco_secciones (version_id, orden) ON DELETE CASCADE);
COMMENT ON TABLE eti.banco_preguntas IS 'Preguntas de cada seccion del banco';

-- ══ CONFIGURACION ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.cfg_accesos (
  usuario text PRIMARY KEY, nombre text, rol text, activo boolean, extra boolean,
  eliminado boolean, eliminado_en timestamptz, eliminado_por text,
  actualizado_por text, actualizado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.cfg_accesos IS 'Accesos a Evaluaciones ETI por usuario. Origen: eti.config_eti (accesos)';
CREATE TABLE IF NOT EXISTS eti.cfg_atribucion (
  orden integer PRIMARY KEY, usuario text, nombre text, sector text, sectores text[], reemplazante boolean,
  regla text, actualizado_por text, actualizado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.cfg_atribucion IS 'A que supervisor y sector se atribuye cada evaluacion. Origen: eti.config_eti (atribucion)';
CREATE TABLE IF NOT EXISTS eti.cfg_coberturas (
  id text PRIMARY KEY, fuente text, detalle text, actualizado_por text, actualizado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.cfg_coberturas IS 'Coberturas (reemplazos) vigentes. Origen: eti.config_eti (coberturas)';
CREATE TABLE IF NOT EXISTS eti.cfg_respaldo (
  id text PRIMARY KEY, ultimo date, manuales integer, por_qr integer, hecho_por text, hecho_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.cfg_respaldo IS 'Ultimo respaldo descargado de Evaluaciones ETI. Origen: eti.config_eti (respaldo)';

-- ══ DETALLE POR SECCION DE LAS EVALUACIONES MANUALES ═════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.eval_manual_ruta_secciones (
  evaluacion_id text NOT NULL, ruta_orden integer NOT NULL, orden integer NOT NULL,
  seccion text, nombre text, peso numeric, promedio numeric, porcentaje numeric, ponderado numeric,
  PRIMARY KEY (evaluacion_id, ruta_orden, orden),
  FOREIGN KEY (evaluacion_id, ruta_orden) REFERENCES eti.eval_manual_rutas (evaluacion_id, orden) ON DELETE CASCADE);
COMMENT ON TABLE eti.eval_manual_ruta_secciones IS 'Resultado por seccion de cada ruta en las evaluaciones manuales';
CREATE TABLE IF NOT EXISTS eti.eval_manual_fechas_programadas (
  evaluacion_id text NOT NULL REFERENCES eti.eval_manuales (id) ON DELETE CASCADE,
  orden integer NOT NULL, fecha date, PRIMARY KEY (evaluacion_id, orden));
COMMENT ON TABLE eti.eval_manual_fechas_programadas IS 'Fechas en que estaba programada una evaluacion registrada fuera de fecha';

-- ══ CUESTIONARIO GUARDADO EN CADA CODIGO QR ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.qr_sesion_secciones (
  sesion_id text NOT NULL REFERENCES eti.qr_sesiones (id) ON DELETE CASCADE,
  orden integer NOT NULL, seccion text, nombre text, peso numeric, maximo integer, PRIMARY KEY (sesion_id, orden));
COMMENT ON TABLE eti.qr_sesion_secciones IS 'Secciones del cuestionario con que se abrio cada codigo QR';
CREATE TABLE IF NOT EXISTS eti.qr_sesion_preguntas (
  sesion_id text NOT NULL, seccion_orden integer NOT NULL, orden integer NOT NULL,
  numero integer, texto text, tipo text, opciones text[], correctas text[], maximo integer,
  PRIMARY KEY (sesion_id, seccion_orden, orden),
  FOREIGN KEY (sesion_id, seccion_orden) REFERENCES eti.qr_sesion_secciones (sesion_id, orden) ON DELETE CASCADE);
COMMENT ON TABLE eti.qr_sesion_preguntas IS 'Preguntas del cuestionario con que se abrio cada codigo QR';

-- ══ EVALUACIONES DEPURADAS ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.eval_depuradas (
  id text PRIMARY KEY, depurado_en timestamptz, depurado_por text, motivo text, coleccion_origen text, evaluacion_id text,
  fecha date, empresa text, sector text, supervisor text, tipo text, modalidad text, resultado_general numeric,
  usuario text, nombre_usuario text, marca_tiempo bigint, creado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.eval_depuradas IS 'Evaluaciones retiradas del historico, con quien y por que. Origen: eti.evaluaciones_depuradas';
CREATE TABLE IF NOT EXISTS eti.eval_depurada_rutas (
  depurada_id text NOT NULL REFERENCES eti.eval_depuradas (id) ON DELETE CASCADE,
  orden integer NOT NULL, codigo text, nombre text, evaluados integer, resultado numeric, PRIMARY KEY (depurada_id, orden));
CREATE TABLE IF NOT EXISTS eti.eval_depurada_ruta_secciones (
  depurada_id text NOT NULL, ruta_orden integer NOT NULL, orden integer NOT NULL,
  seccion text, nombre text, peso numeric, promedio numeric, porcentaje numeric, ponderado numeric,
  PRIMARY KEY (depurada_id, ruta_orden, orden),
  FOREIGN KEY (depurada_id, ruta_orden) REFERENCES eti.eval_depurada_rutas (depurada_id, orden) ON DELETE CASCADE);

-- ══ INFORME DE CAPACITACION Y PROGRAMACION DE CHECKLIST ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.cap_informes (
  id text PRIMARY KEY, tipo_informe text, tipo text, nombre text, tema text, temas text[], objetivo text, conclusiones text[],
  empresa text, sector text, fecha date, fechas text[], fecha_informe date, duracion text,
  hombres integer, mujeres integer, total integer, responsable text, reportado text,
  firma_nombre text, firma_cargo text, firma_dni text, usuario text, nombre_usuario text,
  capacitacion_id text, capacitaciones text[], cap_area text, cap_tipo text, cap_horas numeric, cap_sesiones integer, cap_dni text, cap_creada_por text,
  documento_url text, adjuntos text[], version integer, marca_tiempo bigint,
  creado_en timestamptz, actualizado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.cap_informes IS 'Informes de capacitacion INF-SC-GH-03 emitidos. Origen: eti.informes_cap';
CREATE TABLE IF NOT EXISTS eti.cap_informe_fotos (
  informe_id text NOT NULL REFERENCES eti.cap_informes (id) ON DELETE CASCADE,
  orden integer NOT NULL, url text, ancho integer, alto integer, PRIMARY KEY (informe_id, orden));
COMMENT ON TABLE eti.cap_informe_fotos IS 'Fotos adjuntas a cada informe de capacitacion';

CREATE TABLE IF NOT EXISTS eti.eval_programaciones (
  id text PRIMARY KEY, supervisor text, estado text, observaciones text, creado_por text, creado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.eval_programaciones IS 'Programacion de checklist propia de Evaluaciones ETI. Origen: eti.programaciones_eval';
CREATE TABLE IF NOT EXISTS eti.eval_programacion_fechas (
  programacion_id text NOT NULL REFERENCES eti.eval_programaciones (id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('PROGRAMADA', 'EJECUTADA')), orden integer NOT NULL, fecha date, fecha_texto text,
  PRIMARY KEY (programacion_id, tipo, orden));

-- ══ COPIA ════════════════════════════════════════════════════════════════════════════════════════
-- un banco (lista de secciones con sus preguntas) a las tablas de banco, bajo la version indicada
CREATE OR REPLACE FUNCTION eti._copiar_banco(p_ver text, p_vigente boolean, d jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM eti.banco_versiones WHERE id = p_ver;
  INSERT INTO eti.banco_versiones (id, vigente, version, guardado_por, guardado_en, marca_tiempo)
    VALUES (p_ver, p_vigente, eti._i(d->>'version'), eti._x(d->>'por'), eti._t(d->>'en'), eti._i(d->>'ts'));
  IF jsonb_typeof(d->'secs') <> 'array' THEN RETURN; END IF;
  INSERT INTO eti.banco_secciones (version_id, orden, seccion, nombre, peso)
    SELECT p_ver, o::int, eti._x(e->>'id'), eti._x(e->>'nom'), eti._n(e->>'peso')
    FROM jsonb_array_elements(d->'secs') WITH ORDINALITY x(e, o) WHERE jsonb_typeof(e) = 'object';
  INSERT INTO eti.banco_preguntas (version_id, seccion_orden, orden, numero, texto, texto_qr, tipo, opciones, maximo, porcentaje, revisar, visto_bueno, origen)
    SELECT p_ver, so::int, po::int, eti._i(q->>'n'), eti._x(q->>'t'), eti._x(q->>'tq'), eti._x(q->>'tipo'), eti._l(q->'ops'), eti._i(q->>'max'), eti._n(q->>'pct'),
      eti._b(q->>'revisar'), eti._b(q->>'vb'), eti._x(q->>'origen')
    FROM jsonb_array_elements(d->'secs') WITH ORDINALITY s(e, so)
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e->'pregs') = 'array' THEN e->'pregs' ELSE '[]'::jsonb END) WITH ORDINALITY p(q, po)
    WHERE jsonb_typeof(e) = 'object' AND jsonb_typeof(q) = 'object';
END $$;

CREATE OR REPLACE FUNCTION eti._copiar2(p_tabla text, p_id text, d jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_rutas jsonb;
BEGIN
  IF d IS NULL OR jsonb_typeof(d) <> 'object' THEN RETURN; END IF;

  IF p_tabla = 'banco_historial' THEN
    PERFORM eti._copiar_banco('h:' || p_id, false, d);

  ELSIF p_tabla = 'config_eti' THEN
    IF p_id = 'banco' THEN
      PERFORM eti._copiar_banco('vigente', true, d);
    ELSIF p_id = 'accesos' THEN
      DELETE FROM eti.cfg_accesos;
      IF jsonb_typeof(d->'usuarios') = 'object' THEN
        INSERT INTO eti.cfg_accesos (usuario, nombre, rol, activo, extra, eliminado, eliminado_en, eliminado_por, actualizado_por, actualizado_en)
          SELECT k, eti._x(v->>'nom'), eti._x(v->>'rol'), eti._b(v->>'activo'), eti._b(v->>'extra'), eti._b(v->>'eliminado'), eti._t(v->>'eliminadoEn'), eti._x(v->>'eliminadoPor'),
            eti._x(d->>'por'), eti._t(d->>'en')
          FROM jsonb_each(d->'usuarios') x(k, v) WHERE jsonb_typeof(v) = 'object';
      END IF;
    ELSIF p_id = 'atribucion' THEN
      DELETE FROM eti.cfg_atribucion;
      IF jsonb_typeof(d->'sups') = 'array' THEN
        INSERT INTO eti.cfg_atribucion (orden, usuario, nombre, sector, sectores, reemplazante, regla, actualizado_por, actualizado_en)
          SELECT o::int, eti._x(e->>'user'), eti._x(e->>'nom'), eti._x(e->>'sector'), eti._l(e->'sectores'), eti._b(e->>'reemplazante'), eti._x(d->>'regla'), eti._x(d->>'por'), eti._t(d->>'en')
          FROM jsonb_array_elements(d->'sups') WITH ORDINALITY x(e, o) WHERE jsonb_typeof(e) = 'object';
      END IF;
    ELSIF p_id = 'coberturas' THEN
      DELETE FROM eti.cfg_coberturas WHERE id = p_id;
      INSERT INTO eti.cfg_coberturas (id, fuente, detalle, actualizado_por, actualizado_en)
        VALUES (p_id, eti._x(d->>'fuente'), CASE WHEN jsonb_typeof(d->'json') IN ('object', 'array') THEN (d->'json')::text ELSE eti._x(d->>'json') END, eti._x(d->>'por'), eti._t(d->>'actualizado'));
    ELSIF p_id = 'respaldo' THEN
      DELETE FROM eti.cfg_respaldo WHERE id = p_id;
      INSERT INTO eti.cfg_respaldo (id, ultimo, manuales, por_qr, hecho_por, hecho_en)
        VALUES (p_id, eti._f(d->>'ultimo'), eti._i(d->>'manual'), eti._i(d->>'qr'), eti._x(d->>'por'), eti._t(d->>'en'));
    END IF;

  ELSIF p_tabla = 'evaluaciones_conocimiento' THEN
    -- la fila principal y sus rutas ya las dejo el disparador de la primera parte (se ejecuta antes)
    DELETE FROM eti.eval_manual_ruta_secciones WHERE evaluacion_id = p_id;
    DELETE FROM eti.eval_manual_fechas_programadas WHERE evaluacion_id = p_id;
    IF NOT EXISTS (SELECT 1 FROM eti.eval_manuales WHERE id = p_id) THEN RETURN; END IF;
    IF jsonb_typeof(d->'rutas') = 'array' THEN
      INSERT INTO eti.eval_manual_ruta_secciones (evaluacion_id, ruta_orden, orden, seccion, nombre, peso, promedio, porcentaje, ponderado)
        SELECT p_id, ro::int, so::int, eti._x(s->>'id'), eti._x(s->>'nom'), eti._n(s->>'peso'), eti._n(s->>'promSec'), eti._n(s->>'pct'), eti._n(s->>'pond')
        FROM jsonb_array_elements(d->'rutas') WITH ORDINALITY r(e, ro)
          CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e->'secs') = 'array' THEN e->'secs' ELSE '[]'::jsonb END) WITH ORDINALITY q(s, so)
        WHERE jsonb_typeof(e) = 'object' AND jsonb_typeof(s) = 'object';
    END IF;
    IF jsonb_typeof(d#>'{destiempo,fechasProg}') = 'array' THEN
      INSERT INTO eti.eval_manual_fechas_programadas (evaluacion_id, orden, fecha)
        SELECT p_id, o::int, eti._f(e #>> '{}') FROM jsonb_array_elements(d#>'{destiempo,fechasProg}') WITH ORDINALITY x(e, o);
    END IF;

  ELSIF p_tabla = 'sesiones_qr' THEN
    DELETE FROM eti.qr_sesion_secciones WHERE sesion_id = p_id;
    IF NOT EXISTS (SELECT 1 FROM eti.qr_sesiones WHERE id = p_id) OR jsonb_typeof(d->'banco') <> 'array' THEN RETURN; END IF;
    INSERT INTO eti.qr_sesion_secciones (sesion_id, orden, seccion, nombre, peso, maximo)
      SELECT p_id, o::int, eti._x(e->>'id'), eti._x(e->>'nom'), eti._n(e->>'peso'), eti._i(e->>'maxSec')
      FROM jsonb_array_elements(d->'banco') WITH ORDINALITY x(e, o) WHERE jsonb_typeof(e) = 'object';
    INSERT INTO eti.qr_sesion_preguntas (sesion_id, seccion_orden, orden, numero, texto, tipo, opciones, correctas, maximo)
      SELECT p_id, so::int, po::int, eti._i(q->>'n'), eti._x(q->>'t'), eti._x(q->>'tipo'), eti._l(q->'ops'), eti._l(q->'k'), eti._i(q->>'max')
      FROM jsonb_array_elements(d->'banco') WITH ORDINALITY s(e, so)
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e->'pregs') = 'array' THEN e->'pregs' ELSE '[]'::jsonb END) WITH ORDINALITY p(q, po)
      WHERE jsonb_typeof(e) = 'object' AND jsonb_typeof(q) = 'object';

  ELSIF p_tabla = 'evaluaciones_depuradas' THEN
    DELETE FROM eti.eval_depuradas WHERE id = p_id;
    INSERT INTO eti.eval_depuradas (id, depurado_en, depurado_por, motivo, coleccion_origen, evaluacion_id, fecha, empresa, sector, supervisor, tipo, modalidad, resultado_general,
        usuario, nombre_usuario, marca_tiempo, creado_en)
      VALUES (p_id, eti._t(d->>'depuradoEn'), eti._x(d->>'depuradoPor'), eti._x(d->>'motivoDepuracion'), eti._x(d->>'coleccionOrigen'), eti._x(d->>'evalId'), eti._f(d->>'fecha'),
        eti._x(d->>'emp'), eti._x(d->>'sector'), eti._x(d->>'sup'), eti._x(d->>'tipo'), eti._x(d->>'modalidad'), eti._n(d->>'resGen'), eti._x(d->>'usuario'), eti._x(d->>'nomUsuario'),
        eti._i(d->>'ts'), eti._t(d->>'creadoEn'));
    -- unas guardan la lista "rutas" y otras una sola "ruta"
    v_rutas := CASE WHEN jsonb_typeof(d->'rutas') = 'array' THEN d->'rutas' WHEN jsonb_typeof(d->'ruta') = 'object' THEN jsonb_build_array(d->'ruta') ELSE '[]'::jsonb END;
    INSERT INTO eti.eval_depurada_rutas (depurada_id, orden, codigo, nombre, evaluados, resultado)
      SELECT p_id, o::int, eti._x(e->>'cod'), eti._x(e->>'nom'), eti._i(e->>'ne'), eti._n(e->>'resGrupo')
      FROM jsonb_array_elements(v_rutas) WITH ORDINALITY x(e, o) WHERE jsonb_typeof(e) = 'object';
    INSERT INTO eti.eval_depurada_ruta_secciones (depurada_id, ruta_orden, orden, seccion, nombre, peso, promedio, porcentaje, ponderado)
      SELECT p_id, ro::int, so::int, eti._x(s->>'id'), eti._x(s->>'nom'), eti._n(s->>'peso'), eti._n(s->>'promSec'), eti._n(s->>'pct'), eti._n(s->>'pond')
      FROM jsonb_array_elements(v_rutas) WITH ORDINALITY r(e, ro)
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e->'secs') = 'array' THEN e->'secs' ELSE '[]'::jsonb END) WITH ORDINALITY q(s, so)
      WHERE jsonb_typeof(e) = 'object' AND jsonb_typeof(s) = 'object';

  ELSIF p_tabla = 'informes_cap' THEN
    DELETE FROM eti.cap_informes WHERE id = p_id;
    INSERT INTO eti.cap_informes (id, tipo_informe, tipo, nombre, tema, temas, objetivo, conclusiones, empresa, sector, fecha, fechas, fecha_informe, duracion, hombres, mujeres, total,
        responsable, reportado, firma_nombre, firma_cargo, firma_dni, usuario, nombre_usuario, capacitacion_id, capacitaciones, cap_area, cap_tipo, cap_horas, cap_sesiones, cap_dni,
        cap_creada_por, documento_url, adjuntos, version, marca_tiempo, creado_en, actualizado_en)
      VALUES (p_id, eti._x(d->>'tipoInforme'), eti._x(d->>'tipo'), eti._x(d->>'nombre'), eti._x(d->>'tema'), eti._l(d->'temas'), eti._x(d->>'objetivo'), eti._l(d->'conclusiones'),
        eti._x(d->>'emp'), eti._x(d->>'sector'), eti._f(d->>'fecha'), eti._l(d->'fechas'), eti._f(d->>'fechaInforme'), eti._x(d->>'dur'), eti._i(d->>'h'), eti._i(d->>'m'), eti._i(d->>'n'),
        eti._x(d->>'resp'), eti._x(d->>'reportado'), eti._x(d->>'firmaNom'), eti._x(d->>'firmaCargo'), eti._x(d->>'firmaDni'), eti._x(d->>'usuario'), eti._x(d->>'nomUsuario'),
        eti._x(d#>>'{cap,idCapacitacion}'), eti._l(COALESCE(d->'idCaps', d#>'{cap,idCaps}')), eti._x(d#>>'{cap,area}'), eti._x(d#>>'{cap,tipo}'), eti._n(d#>>'{cap,horas}'),
        eti._i(d#>>'{cap,sesiones}'), eti._x(d#>>'{cap,capDni}'), eti._x(d#>>'{cap,creadaPor}'), eti._x(d->>'docx'), eti._l(d->'adjuntos'), eti._i(d->>'version'), eti._i(d->>'ts'),
        eti._t(d->>'creado'), eti._t(d->>'actualizado'));
    IF jsonb_typeof(d->'fotos') = 'array' THEN
      INSERT INTO eti.cap_informe_fotos (informe_id, orden, url, ancho, alto)
        SELECT p_id, o::int, CASE WHEN jsonb_typeof(e) = 'object' THEN eti._x(e->>'url') ELSE eti._x(e #>> '{}') END, eti._i(e->>'w'), eti._i(e->>'h')
        FROM jsonb_array_elements(d->'fotos') WITH ORDINALITY x(e, o);
    END IF;

  ELSIF p_tabla = 'programaciones_eval' THEN
    DELETE FROM eti.eval_programaciones WHERE id = p_id;
    INSERT INTO eti.eval_programaciones (id, supervisor, estado, observaciones, creado_por, creado_en)
      VALUES (p_id, eti._x(d->>'sup'), eti._x(d->>'estado'), eti._x(d->>'obs'), eti._x(d->>'creadoPor'), eti._t(d->>'creadoEn'));
    IF jsonb_typeof(d->'fechas') = 'array' THEN
      INSERT INTO eti.eval_programacion_fechas (programacion_id, tipo, orden, fecha, fecha_texto)
        SELECT p_id, 'PROGRAMADA', o::int, eti._f(e #>> '{}'), e #>> '{}' FROM jsonb_array_elements(d->'fechas') WITH ORDINALITY x(e, o);
    END IF;
    IF jsonb_typeof(d->'fechasEjecutadas') = 'array' THEN
      INSERT INTO eti.eval_programacion_fechas (programacion_id, tipo, orden, fecha, fecha_texto)
        SELECT p_id, 'EJECUTADA', o::int, eti._f(e #>> '{}'), e #>> '{}' FROM jsonb_array_elements(d->'fechasEjecutadas') WITH ORDINALITY x(e, o);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION eti._borrar2(p_tabla text, p_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF    p_tabla = 'banco_historial'        THEN DELETE FROM eti.banco_versiones WHERE id = 'h:' || p_id;
  ELSIF p_tabla = 'config_eti' THEN
    IF    p_id = 'banco'      THEN DELETE FROM eti.banco_versiones WHERE id = 'vigente';
    ELSIF p_id = 'accesos'    THEN DELETE FROM eti.cfg_accesos;
    ELSIF p_id = 'atribucion' THEN DELETE FROM eti.cfg_atribucion;
    ELSIF p_id = 'coberturas' THEN DELETE FROM eti.cfg_coberturas WHERE id = p_id;
    ELSIF p_id = 'respaldo'   THEN DELETE FROM eti.cfg_respaldo WHERE id = p_id;
    END IF;
  ELSIF p_tabla = 'evaluaciones_depuradas' THEN DELETE FROM eti.eval_depuradas     WHERE id = p_id;
  ELSIF p_tabla = 'informes_cap'           THEN DELETE FROM eti.cap_informes       WHERE id = p_id;
  ELSIF p_tabla = 'programaciones_eval'    THEN DELETE FROM eti.eval_programaciones WHERE id = p_id;
  END IF;   -- evaluaciones_conocimiento y sesiones_qr: sus detalles se van en cascada con la fila principal
END $$;

CREATE OR REPLACE FUNCTION eti._tr_tablas2() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN PERFORM eti._borrar2(TG_TABLE_NAME, OLD.id);
    ELSE
      IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN PERFORM eti._borrar2(TG_TABLE_NAME, OLD.id); END IF;
      PERFORM eti._copiar2(TG_TABLE_NAME, NEW.id, NEW.datos);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO eti._tablas_errores (tabla, registro, error) VALUES (TG_TABLE_NAME || ' (anidadas)', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, SQLERRM);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  RETURN NULL;
END $$;

-- el nombre tr_tablas_eti2 hace que se ejecute DESPUES de tr_tablas_eti (los disparadores corren en orden alfabetico)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['banco_historial', 'config_eti', 'evaluaciones_conocimiento', 'sesiones_qr', 'evaluaciones_depuradas', 'informes_cap', 'programaciones_eval'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'eti' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_tablas_eti2 ON eti.%I', t);
      EXECUTE format('CREATE TRIGGER tr_tablas_eti2 AFTER INSERT OR UPDATE OR DELETE ON eti.%I FOR EACH ROW EXECUTE FUNCTION eti._tr_tablas2()', t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION eti.tablas_reconstruir2() RETURNS TABLE (origen text, filas integer, fallidas integer) LANGUAGE plpgsql AS $$
DECLARE t text; r record; n integer; f integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['banco_historial', 'config_eti', 'evaluaciones_conocimiento', 'sesiones_qr', 'evaluaciones_depuradas', 'informes_cap', 'programaciones_eval'] LOOP
    n := 0; f := 0;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'eti' AND table_name = t) THEN
      FOR r IN EXECUTE format('SELECT id, datos FROM eti.%I', t) LOOP
        BEGIN
          PERFORM eti._copiar2(t, r.id, r.datos); n := n + 1;
        EXCEPTION WHEN OTHERS THEN
          f := f + 1; INSERT INTO eti._tablas_errores (tabla, registro, error) VALUES (t || ' (anidadas)', r.id, SQLERRM);
        END;
      END LOOP;
    END IF;
    origen := t; filas := n; fallidas := f; RETURN NEXT;
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['banco_versiones', 'banco_secciones', 'banco_preguntas', 'cfg_accesos', 'cfg_atribucion', 'cfg_coberturas', 'cfg_respaldo', 'eval_manual_ruta_secciones',
      'eval_manual_fechas_programadas', 'qr_sesion_secciones', 'qr_sesion_preguntas', 'eval_depuradas', 'eval_depurada_rutas', 'eval_depurada_ruta_secciones', 'cap_informes',
      'cap_informe_fotos', 'eval_programaciones', 'eval_programacion_fechas'] LOOP
    EXECUTE format('ALTER TABLE eti.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

COMMIT;
