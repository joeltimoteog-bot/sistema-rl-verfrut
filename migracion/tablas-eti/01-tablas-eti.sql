-- 01-tablas-eti.sql — _TABLAS_ETI_V1 (11-nov-2026, pedido de Joel: "tablas por modulo, no amontonadas")
-- Crea TABLAS CON COLUMNAS PROPIAS para los datos de Capacitaciones ETI, Programacion ETI y Evaluaciones ETI, que hoy
-- viven "amontonados" (id + un JSON) en eti.capacitaciones, eti.programaciones_eti, eti.evaluaciones_conocimiento,
-- eti.sesiones_qr, eti.respuestas_qr, eti.supervisores_eti, eti.usuarios_eti y eti.informes_enviados.
--
-- COMO FUNCIONA (no cambia nada de lo que usan los sistemas hoy):
--   · Las tablas amontonadas NO se tocan ni se borran: siguen recibiendo lo que guardan los sistemas.
--   · Cada vez que entra, cambia o se borra un registro ahi, un disparador lo copia a la tabla ordenada.
--   · Si la copia fallara, el guardado original sigue igual y el error queda anotado en eti._tablas_errores.
--   · eti.tablas_reconstruir() vuelve a llenar todo desde cero (se puede repetir).
-- Las columnas salen del inventario real de campos (inventario-campos-eti.js, 11-nov-2026).
-- La huella de clave de usuarios_eti NO se copia a la tabla ordenada.
-- Deshacer: 01-tablas-eti-REVERTIR.sql (borra solo lo creado aqui).

BEGIN;

-- ── conversiones seguras (un dato mal escrito queda en NULL, nunca detiene el guardado) ─────────────
CREATE OR REPLACE FUNCTION eti._f(v text) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  IF v ~ '^\d{4}-\d{2}-\d{2}' THEN RETURN substr(v, 1, 10)::date; END IF;
  IF v ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN RETURN to_date(v, 'DD/MM/YYYY'); END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION eti._t(v text) RETURNS timestamptz LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF v IS NULL OR v !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}' THEN RETURN NULL; END IF;
  RETURN v::timestamptz;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION eti._n(v text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF v IS NULL OR v !~ '^-?\d+(\.\d+)?([eE][-+]?\d+)?$' THEN RETURN NULL; END IF;
  RETURN v::numeric;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION eti._i(v text) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$ SELECT trunc(eti._n(v))::bigint $$;
CREATE OR REPLACE FUNCTION eti._b(v text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(v) WHEN 'true' THEN true WHEN 'false' THEN false ELSE NULL END $$;
CREATE OR REPLACE FUNCTION eti._l(v jsonb) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(v) = 'array' THEN ARRAY(SELECT e #>> '{}' FROM jsonb_array_elements(v) e) ELSE NULL END $$;
CREATE OR REPLACE FUNCTION eti._x(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT NULLIF(btrim(v), '') $$;

CREATE TABLE IF NOT EXISTS eti._tablas_errores (
  id bigserial PRIMARY KEY, cuando timestamptz NOT NULL DEFAULT now(), tabla text NOT NULL, registro text, error text);

-- ══ CAPACITACIONES ETI ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.cap_registros (
  id text PRIMARY KEY,
  tema text, sector text, supervisor text, temporada text,
  fecha_ejecucion date, fecha_limite date, fecha_envio date,
  varones integer, mujeres integer, total integer,
  tipo_personal text, areas text[], rutas_tipo text, rutas_texto text,
  via_supervisor boolean, observaciones text, registrado_por text,
  creado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.cap_registros IS 'Capacitaciones ETI ejecutadas (una fila por acta). Origen: eti.capacitaciones';
CREATE TABLE IF NOT EXISTS eti.cap_registro_rutas (
  registro_id text NOT NULL REFERENCES eti.cap_registros (id) ON DELETE CASCADE,
  orden integer NOT NULL, codigo text, nombre text, PRIMARY KEY (registro_id, orden));
COMMENT ON TABLE eti.cap_registro_rutas IS 'Rutas capacitadas en cada acta';
CREATE TABLE IF NOT EXISTS eti.cap_registro_codigos (
  registro_id text NOT NULL REFERENCES eti.cap_registros (id) ON DELETE CASCADE,
  orden integer NOT NULL, codigo text, PRIMARY KEY (registro_id, orden));
COMMENT ON TABLE eti.cap_registro_codigos IS 'Codigos de trabajador capacitados en cada acta';
CREATE INDEX IF NOT EXISTS ix_cap_registros_fecha ON eti.cap_registros (fecha_ejecucion);
CREATE INDEX IF NOT EXISTS ix_cap_registros_sup   ON eti.cap_registros (supervisor);

-- ══ PROGRAMACION ETI ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.prog_programaciones (
  id text PRIMARY KEY,
  tema text, sector text, supervisor text, empresa text, anio integer, turno text,
  estado text, fecha_programada date, fecha_fin date, dias_designados integer,
  ejecutada_en timestamptz, registro_id text, veces_reprogramada integer, semanas text[],
  origen text, observaciones text, creado_por text, creado_por_usuario text,
  creado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.prog_programaciones IS 'Programacion de capacitaciones, checklist y reforzamientos ETI. Origen: eti.programaciones_eti';
CREATE TABLE IF NOT EXISTS eti.prog_fechas (
  programacion_id text NOT NULL REFERENCES eti.prog_programaciones (id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('PROGRAMADA', 'EJECUTADA')), orden integer NOT NULL,
  fecha date, fecha_texto text, PRIMARY KEY (programacion_id, tipo, orden));
COMMENT ON TABLE eti.prog_fechas IS 'Fechas programadas y fechas ejecutadas de cada programacion';
CREATE TABLE IF NOT EXISTS eti.prog_reprogramaciones (
  programacion_id text NOT NULL REFERENCES eti.prog_programaciones (id) ON DELETE CASCADE,
  orden integer NOT NULL, fecha timestamptz, fecha_texto text, motivo text, detalle text, cambios text, registrado_por text,
  anterior_ini date, anterior_fin date, nueva_ini date, nueva_fin date, fechas_anterior text[], fechas_nueva text[],
  PRIMARY KEY (programacion_id, orden));
COMMENT ON TABLE eti.prog_reprogramaciones IS 'Historial de reprogramaciones autorizadas por el administrador';
CREATE TABLE IF NOT EXISTS eti.prog_solicitudes (
  programacion_id text NOT NULL REFERENCES eti.prog_programaciones (id) ON DELETE CASCADE,
  orden integer NOT NULL, solicitud_id text, fecha timestamptz, fecha_texto text, estado text, motivo text, detalle text,
  usuario text, nombre text, fechas text[], PRIMARY KEY (programacion_id, orden));
COMMENT ON TABLE eti.prog_solicitudes IS 'Solicitudes de reprogramacion hechas por los supervisores';
CREATE INDEX IF NOT EXISTS ix_prog_fecha ON eti.prog_programaciones (fecha_programada);
CREATE INDEX IF NOT EXISTS ix_prog_sup   ON eti.prog_programaciones (supervisor);

-- ══ EVALUACIONES ETI ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.eval_manuales (
  id text PRIMARY KEY,
  fecha date, fecha_texto text, empresa text, sector text, supervisor text, tipo text, modalidad text,
  resultado_general numeric, usuario text, nombre_usuario text,
  fuera_de_fecha_tipo text, fuera_de_fecha_motivo text, fuera_de_fecha_programacion text,
  editado_en timestamptz, editado_por text, motivo_edicion text, fecha_original date,
  restaurado_en timestamptz, restaurado_por text,
  enviado_servidor boolean, enviado_servidor_en timestamptz, marca_tiempo bigint,
  creado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.eval_manuales IS 'Evaluaciones de conocimiento registradas a mano (una fila por evaluacion). Origen: eti.evaluaciones_conocimiento';
CREATE TABLE IF NOT EXISTS eti.eval_manual_rutas (
  evaluacion_id text NOT NULL REFERENCES eti.eval_manuales (id) ON DELETE CASCADE,
  orden integer NOT NULL, codigo text, nombre text, evaluados integer, hombres integer, mujeres integer, resultado numeric,
  PRIMARY KEY (evaluacion_id, orden));
COMMENT ON TABLE eti.eval_manual_rutas IS 'Resultado por ruta de cada evaluacion manual';

CREATE TABLE IF NOT EXISTS eti.qr_sesiones (
  id text PRIMARY KEY,
  tipo text, estado text, permanente boolean, anonima boolean,
  fecha date, fecha_texto text, empresa text, sector text, supervisor text, ruta text, codigo text,
  usuario text, nombre_usuario text, asignado text, sectores text[], areas text[],
  banco_version integer, expira bigint, pausado_en timestamptz, pausa_motivo text,
  marca_tiempo bigint, creado_en timestamptz, actualizado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.qr_sesiones IS 'Codigos QR de evaluacion (por dia o permanentes). Origen: eti.sesiones_qr';

CREATE TABLE IF NOT EXISTS eti.qr_respuestas (
  id text PRIMARY KEY,
  sesion text, fecha date, empresa text, sector text, supervisor text, usuario_supervisor text, ruta text, codigo text,
  tipo text, estado text, sexo text, anonima boolean, resultado numeric, banco_version integer,
  enviado_servidor boolean, enviado_servidor_en timestamptz, marca_tiempo bigint,
  creado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.qr_respuestas IS 'Respuesta de cada trabajador a la evaluacion por QR (anonima). Origen: eti.respuestas_qr';
CREATE TABLE IF NOT EXISTS eti.qr_respuesta_preguntas (
  respuesta_id text NOT NULL REFERENCES eti.qr_respuestas (id) ON DELETE CASCADE,
  pregunta integer NOT NULL, respuesta text, puntos numeric, PRIMARY KEY (respuesta_id, pregunta));
COMMENT ON TABLE eti.qr_respuesta_preguntas IS 'Lo que marco el trabajador y los puntos obtenidos en cada pregunta';
CREATE TABLE IF NOT EXISTS eti.qr_respuesta_secciones (
  respuesta_id text NOT NULL REFERENCES eti.qr_respuestas (id) ON DELETE CASCADE,
  orden integer NOT NULL, seccion text, nombre text, peso numeric, puntos numeric, maximo numeric, porcentaje numeric,
  PRIMARY KEY (respuesta_id, orden));
COMMENT ON TABLE eti.qr_respuesta_secciones IS 'Resultado por seccion del cuestionario en cada respuesta';
CREATE INDEX IF NOT EXISTS ix_qr_resp_fecha  ON eti.qr_respuestas (fecha);
CREATE INDEX IF NOT EXISTS ix_qr_resp_sesion ON eti.qr_respuestas (sesion);
CREATE INDEX IF NOT EXISTS ix_qr_resp_sup    ON eti.qr_respuestas (usuario_supervisor);

CREATE TABLE IF NOT EXISTS eti.eval_informes_dia (
  id text PRIMARY KEY,
  dia date, desde date, hasta date, supervisor text, usuario text, enviado_por text, enviado_en timestamptz,
  evaluados integer, por_qr integer, manuales integer, aprobados integer, promedio numeric,
  copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.eval_informes_dia IS 'Marca de "envio su informe del dia" en Evaluaciones ETI. Origen: eti.informes_enviados';

-- ══ PADRON DE LOS ETI ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eti.supervisores (
  id text PRIMARY KEY, nombre text, sector text, estado text, creado_en timestamptz, copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.supervisores IS 'Supervisor y sector en los ETI. Origen: eti.supervisores_eti';
CREATE TABLE IF NOT EXISTS eti.usuarios (
  id text PRIMARY KEY, usuario text, supervisor_nombre text, estado text, creado_por text, creado_en timestamptz,
  copiado timestamptz NOT NULL DEFAULT now());
COMMENT ON TABLE eti.usuarios IS 'Cuentas de los ETI (sin la huella de clave: el ingreso se valida en el Sistema RR.LL.). Origen: eti.usuarios_eti';

-- ══ COPIA DE UN REGISTRO ═════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION eti._copiar(p_tabla text, p_id text, d jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF d IS NULL OR jsonb_typeof(d) <> 'object' THEN RETURN; END IF;

  IF p_tabla = 'capacitaciones' THEN
    DELETE FROM eti.cap_registros WHERE id = p_id;
    INSERT INTO eti.cap_registros (id, tema, sector, supervisor, temporada, fecha_ejecucion, fecha_limite, fecha_envio, varones, mujeres, total,
        tipo_personal, areas, rutas_tipo, rutas_texto, via_supervisor, observaciones, registrado_por, creado_en)
      VALUES (p_id, eti._x(d->>'tema'), eti._x(d->>'sector'), eti._x(d->>'supervisor'), eti._x(d->>'temporada'), eti._f(d->>'fechaEjecucion'), eti._f(d->>'fechaLimite'),
        eti._f(d->>'fechaEnvio'), eti._i(d->>'varones'), eti._i(d->>'mujeres'), eti._i(d->>'total'), eti._x(d->>'tipoPersonal'), eti._l(d->'areas'), eti._x(d->>'rutasTipo'),
        eti._x(d->>'rutasTexto'), eti._b(d->>'viaSupervisor'), eti._x(d->>'observaciones'), eti._x(d->>'registradoPor'), eti._t(d->>'creadoEn'));
    IF jsonb_typeof(d->'rutas') = 'array' THEN
      INSERT INTO eti.cap_registro_rutas (registro_id, orden, codigo, nombre)
        SELECT p_id, o::int, CASE WHEN jsonb_typeof(e) = 'object' THEN eti._x(e->>'codigo') ELSE eti._x(e #>> '{}') END, CASE WHEN jsonb_typeof(e) = 'object' THEN eti._x(e->>'nombre') END
        FROM jsonb_array_elements(d->'rutas') WITH ORDINALITY x(e, o);
    END IF;
    IF jsonb_typeof(d->'codigosCapacitados') = 'array' THEN
      INSERT INTO eti.cap_registro_codigos (registro_id, orden, codigo)
        SELECT p_id, o::int, CASE WHEN jsonb_typeof(e) = 'object' THEN COALESCE(eti._x(e->>'codigo'), eti._x(e->>'cod'), e::text) ELSE eti._x(e #>> '{}') END
        FROM jsonb_array_elements(d->'codigosCapacitados') WITH ORDINALITY x(e, o);
    END IF;

  ELSIF p_tabla = 'programaciones_eti' THEN
    DELETE FROM eti.prog_programaciones WHERE id = p_id;
    INSERT INTO eti.prog_programaciones (id, tema, sector, supervisor, empresa, anio, turno, estado, fecha_programada, fecha_fin, dias_designados, ejecutada_en,
        registro_id, veces_reprogramada, semanas, origen, observaciones, creado_por, creado_por_usuario, creado_en)
      VALUES (p_id, eti._x(d->>'tema'), eti._x(d->>'sector'), eti._x(d->>'supervisor'), eti._x(d->>'empresa'), eti._i(d->>'anio'), eti._x(d->>'turno'), eti._x(d->>'estado'),
        eti._f(d->>'fechaProgramada'), eti._f(d->>'fechaFin'), eti._i(d->>'diasDesignados'), eti._t(d->>'ejecutadaEn'), eti._x(d->>'registroId'), eti._i(d->>'vecesReprogramada'),
        eti._l(d->'semanas'), eti._x(d->>'origen'), eti._x(d->>'observaciones'), eti._x(d->>'creadoPor'), eti._x(d->>'creadoPorUsuario'), eti._t(d->>'creadoEn'));
    IF jsonb_typeof(d->'fechas') = 'array' THEN
      INSERT INTO eti.prog_fechas (programacion_id, tipo, orden, fecha, fecha_texto)
        SELECT p_id, 'PROGRAMADA', o::int, eti._f(e #>> '{}'), e #>> '{}' FROM jsonb_array_elements(d->'fechas') WITH ORDINALITY x(e, o);
    END IF;
    IF jsonb_typeof(d->'fechasEjecutadas') = 'array' THEN
      INSERT INTO eti.prog_fechas (programacion_id, tipo, orden, fecha, fecha_texto)
        SELECT p_id, 'EJECUTADA', o::int, eti._f(e #>> '{}'), e #>> '{}' FROM jsonb_array_elements(d->'fechasEjecutadas') WITH ORDINALITY x(e, o);
    END IF;
    IF jsonb_typeof(d->'reprogramaciones') = 'array' THEN
      INSERT INTO eti.prog_reprogramaciones (programacion_id, orden, fecha, fecha_texto, motivo, detalle, cambios, registrado_por, anterior_ini, anterior_fin, nueva_ini, nueva_fin, fechas_anterior, fechas_nueva)
        SELECT p_id, o::int, COALESCE(eti._t(e->>'fecha'), eti._f(e->>'fecha')::timestamptz), e->>'fecha', eti._x(e->>'motivo'), eti._x(e->>'detalle'),
          CASE WHEN jsonb_typeof(e->'cambios') IN ('array', 'object') THEN (e->'cambios')::text ELSE eti._x(e->>'cambios') END, eti._x(e->>'registradoPor'),
          eti._f(e->>'fechaAnteriorIni'), eti._f(e->>'fechaAnteriorFin'), eti._f(e->>'nuevaIni'), eti._f(e->>'nuevaFin'), eti._l(e->'fechasAnterior'), eti._l(e->'fechasNueva')
        FROM jsonb_array_elements(d->'reprogramaciones') WITH ORDINALITY x(e, o) WHERE jsonb_typeof(e) = 'object';
    END IF;
    IF jsonb_typeof(d->'solicitudesReprog') = 'array' THEN
      INSERT INTO eti.prog_solicitudes (programacion_id, orden, solicitud_id, fecha, fecha_texto, estado, motivo, detalle, usuario, nombre, fechas)
        SELECT p_id, o::int, eti._x(e->>'id'), COALESCE(eti._t(e->>'fecha'), eti._f(e->>'fecha')::timestamptz), e->>'fecha', eti._x(e->>'estado'), eti._x(e->>'motivo'),
          eti._x(e->>'detalle'), eti._x(e->>'usuario'), eti._x(e->>'nombre'), eti._l(e->'fechas')
        FROM jsonb_array_elements(d->'solicitudesReprog') WITH ORDINALITY x(e, o) WHERE jsonb_typeof(e) = 'object';
    END IF;

  ELSIF p_tabla = 'evaluaciones_conocimiento' THEN
    DELETE FROM eti.eval_manuales WHERE id = p_id;
    INSERT INTO eti.eval_manuales (id, fecha, fecha_texto, empresa, sector, supervisor, tipo, modalidad, resultado_general, usuario, nombre_usuario,
        fuera_de_fecha_tipo, fuera_de_fecha_motivo, fuera_de_fecha_programacion, editado_en, editado_por, motivo_edicion, fecha_original,
        restaurado_en, restaurado_por, enviado_servidor, enviado_servidor_en, marca_tiempo, creado_en)
      VALUES (p_id, eti._f(d->>'fecha'), d->>'fecha', eti._x(d->>'emp'), eti._x(d->>'sector'), eti._x(d->>'sup'), eti._x(d->>'tipo'), eti._x(d->>'modalidad'), eti._n(d->>'resGen'),
        eti._x(d->>'usuario'), eti._x(d->>'nomUsuario'), eti._x(d#>>'{destiempo,tipo}'), eti._x(d#>>'{destiempo,motivo}'), eti._x(d#>>'{destiempo,progId}'),
        eti._t(d->>'editadoEn'), eti._x(d->>'editadoPor'), eti._x(d->>'motivoEdicion'), eti._f(d->>'fechaOriginal'), eti._t(d->>'restauradoEn'), eti._x(d->>'restauradoPor'),
        eti._b(d->>'azOk'), eti._t(d->>'azEn'), eti._i(d->>'ts'), eti._t(d->>'creadoEn'));
    IF jsonb_typeof(d->'rutas') = 'array' THEN
      INSERT INTO eti.eval_manual_rutas (evaluacion_id, orden, codigo, nombre, evaluados, hombres, mujeres, resultado)
        SELECT p_id, o::int, eti._x(e->>'cod'), eti._x(e->>'nom'), eti._i(e->>'ne'), eti._i(e->>'hom'), eti._i(e->>'muj'), eti._n(e->>'resGrupo')
        FROM jsonb_array_elements(d->'rutas') WITH ORDINALITY x(e, o) WHERE jsonb_typeof(e) = 'object';
    END IF;

  ELSIF p_tabla = 'sesiones_qr' THEN
    DELETE FROM eti.qr_sesiones WHERE id = p_id;
    INSERT INTO eti.qr_sesiones (id, tipo, estado, permanente, anonima, fecha, fecha_texto, empresa, sector, supervisor, ruta, codigo, usuario, nombre_usuario, asignado,
        sectores, areas, banco_version, expira, pausado_en, pausa_motivo, marca_tiempo, creado_en, actualizado_en)
      VALUES (p_id, eti._x(d->>'tipo'), eti._x(d->>'estado'), eti._b(d->>'permanente'), eti._b(d->>'anonima'), eti._f(d->>'fecha'), d->>'fecha', eti._x(d->>'emp'), eti._x(d->>'sector'),
        eti._x(d->>'sup'), eti._x(d->>'ruta'), eti._x(d->>'cod'), eti._x(d->>'usuario'), eti._x(d->>'nomUsuario'), eti._x(d->>'asignado'), eti._l(d->'sectores'), eti._l(d->'areas'),
        eti._i(d->>'bancoVersion'), eti._i(d->>'expira'), eti._t(d->>'pausadoEn'), eti._x(d->>'pausaMotivo'), eti._i(d->>'ts'), eti._t(d->>'creadoEn'), eti._t(d->>'actualizadoEn'));

  ELSIF p_tabla = 'respuestas_qr' THEN
    DELETE FROM eti.qr_respuestas WHERE id = p_id;
    INSERT INTO eti.qr_respuestas (id, sesion, fecha, empresa, sector, supervisor, usuario_supervisor, ruta, codigo, tipo, estado, sexo, anonima, resultado, banco_version,
        enviado_servidor, enviado_servidor_en, marca_tiempo, creado_en)
      VALUES (p_id, eti._x(d->>'sesion'), eti._f(d->>'fecha'), eti._x(d->>'emp'), eti._x(d->>'sector'), eti._x(d->>'sup'), eti._x(d->>'usuarioSup'), eti._x(d->>'ruta'), eti._x(d->>'cod'),
        eti._x(d->>'tipo'), eti._x(d->>'estado'), eti._x(d->>'sexo'), eti._b(d->>'anonima'), eti._n(d->>'resultado'), eti._i(d->>'bancoVersion'), eti._b(d->>'azOk'), eti._t(d->>'azEn'),
        eti._i(d->>'ts'), eti._t(d->>'creadoEn'));
    INSERT INTO eti.qr_respuesta_preguntas (respuesta_id, pregunta, respuesta, puntos)
      SELECT p_id, k::int, CASE WHEN jsonb_typeof(d->'resp') = 'object' THEN (d->'resp') ->> k END, CASE WHEN jsonb_typeof(d->'pts') = 'object' THEN eti._n((d->'pts') ->> k) END
      FROM (SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(d->'resp') = 'object' THEN d->'resp' ELSE '{}'::jsonb END) AS k
            UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(d->'pts') = 'object' THEN d->'pts' ELSE '{}'::jsonb END)) q
      WHERE k ~ '^\d{1,4}$';
    IF jsonb_typeof(d->'secs') = 'array' THEN
      INSERT INTO eti.qr_respuesta_secciones (respuesta_id, orden, seccion, nombre, peso, puntos, maximo, porcentaje)
        SELECT p_id, o::int, eti._x(e->>'id'), eti._x(e->>'nom'), eti._n(e->>'peso'), eti._n(e->>'pts'), eti._n(e->>'max'), eti._n(e->>'pct')
        FROM jsonb_array_elements(d->'secs') WITH ORDINALITY x(e, o) WHERE jsonb_typeof(e) = 'object';
    END IF;

  ELSIF p_tabla = 'informes_enviados' THEN
    DELETE FROM eti.eval_informes_dia WHERE id = p_id;
    INSERT INTO eti.eval_informes_dia (id, dia, desde, hasta, supervisor, usuario, enviado_por, enviado_en, evaluados, por_qr, manuales, aprobados, promedio)
      VALUES (p_id, eti._f(d->>'dia'), eti._f(d->>'desde'), eti._f(d->>'hasta'), eti._x(d->>'sup'), eti._x(d->>'usuario'), eti._x(d->>'por'), eti._t(d->>'en'),
        eti._i(d->>'n'), eti._i(d->>'qr'), eti._i(d->>'man'), eti._i(d->>'apr'), eti._n(d->>'prom'));

  ELSIF p_tabla = 'supervisores_eti' THEN
    DELETE FROM eti.supervisores WHERE id = p_id;
    INSERT INTO eti.supervisores (id, nombre, sector, estado, creado_en) VALUES (p_id, eti._x(d->>'nombre'), eti._x(d->>'sector'), eti._x(d->>'estado'), eti._t(d->>'creadoEn'));

  ELSIF p_tabla = 'usuarios_eti' THEN
    DELETE FROM eti.usuarios WHERE id = p_id;
    INSERT INTO eti.usuarios (id, usuario, supervisor_nombre, estado, creado_por, creado_en)
      VALUES (p_id, eti._x(d->>'usuario'), eti._x(d->>'supervisorNombre'), eti._x(d->>'estado'), eti._x(d->>'creadoPor'), eti._t(d->>'creadoEn'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION eti._borrar(p_tabla text, p_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF    p_tabla = 'capacitaciones'            THEN DELETE FROM eti.cap_registros       WHERE id = p_id;
  ELSIF p_tabla = 'programaciones_eti'        THEN DELETE FROM eti.prog_programaciones WHERE id = p_id;
  ELSIF p_tabla = 'evaluaciones_conocimiento' THEN DELETE FROM eti.eval_manuales       WHERE id = p_id;
  ELSIF p_tabla = 'sesiones_qr'               THEN DELETE FROM eti.qr_sesiones         WHERE id = p_id;
  ELSIF p_tabla = 'respuestas_qr'             THEN DELETE FROM eti.qr_respuestas       WHERE id = p_id;
  ELSIF p_tabla = 'informes_enviados'         THEN DELETE FROM eti.eval_informes_dia        WHERE id = p_id;
  ELSIF p_tabla = 'supervisores_eti'          THEN DELETE FROM eti.supervisores        WHERE id = p_id;
  ELSIF p_tabla = 'usuarios_eti'              THEN DELETE FROM eti.usuarios            WHERE id = p_id;
  END IF;
END $$;

-- disparador: NUNCA detiene el guardado original; si la copia falla, se anota y se sigue
CREATE OR REPLACE FUNCTION eti._tr_tablas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN PERFORM eti._borrar(TG_TABLE_NAME, OLD.id);
    ELSE
      IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN PERFORM eti._borrar(TG_TABLE_NAME, OLD.id); END IF;
      PERFORM eti._copiar(TG_TABLE_NAME, NEW.id, NEW.datos);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO eti._tablas_errores (tabla, registro, error) VALUES (TG_TABLE_NAME, CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, SQLERRM);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['capacitaciones', 'programaciones_eti', 'evaluaciones_conocimiento', 'sesiones_qr', 'respuestas_qr', 'informes_enviados', 'supervisores_eti', 'usuarios_eti'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'eti' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_tablas_eti ON eti.%I', t);
      EXECUTE format('CREATE TRIGGER tr_tablas_eti AFTER INSERT OR UPDATE OR DELETE ON eti.%I FOR EACH ROW EXECUTE FUNCTION eti._tr_tablas()', t);
    END IF;
  END LOOP;
END $$;

-- vuelve a llenar las tablas ordenadas desde las amontonadas (se puede repetir)
CREATE OR REPLACE FUNCTION eti.tablas_reconstruir() RETURNS TABLE (origen text, filas integer, fallidas integer) LANGUAGE plpgsql AS $$
DECLARE t text; r record; n integer; f integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['capacitaciones', 'programaciones_eti', 'evaluaciones_conocimiento', 'sesiones_qr', 'respuestas_qr', 'informes_enviados', 'supervisores_eti', 'usuarios_eti'] LOOP
    n := 0; f := 0;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'eti' AND table_name = t) THEN
      FOR r IN EXECUTE format('SELECT id, datos FROM eti.%I', t) LOOP
        BEGIN
          PERFORM eti._copiar(t, r.id, r.datos); n := n + 1;
        EXCEPTION WHEN OTHERS THEN
          f := f + 1; INSERT INTO eti._tablas_errores (tabla, registro, error) VALUES (t, r.id, SQLERRM);
        END;
      END LOOP;
    END IF;
    origen := t; filas := n; fallidas := f; RETURN NEXT;
  END LOOP;
END $$;

-- acceso solo desde el servidor (igual que el resto del esquema)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cap_registros', 'cap_registro_rutas', 'cap_registro_codigos', 'prog_programaciones', 'prog_fechas', 'prog_reprogramaciones', 'prog_solicitudes',
      'eval_manuales', 'eval_manual_rutas', 'qr_sesiones', 'qr_respuestas', 'qr_respuesta_preguntas', 'qr_respuesta_secciones', 'eval_informes_dia', 'supervisores', 'usuarios', '_tablas_errores'] LOOP
    EXECUTE format('ALTER TABLE eti.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

COMMIT;
