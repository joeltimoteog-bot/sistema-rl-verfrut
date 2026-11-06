-- ═══════════════════════════════════════════════════════════════════════════
-- consultas-utiles.sql — Sistema RR.LL. en Supabase (06-nov-2026)
-- Ábrelo en VS Code, conectado a Supabase, y ejecuta la consulta que necesites
-- (selecciónala y Ctrl+Enter, o "Run" según la extensión).
-- TODAS son de SOLO LECTURA (SELECT). Las tablas del sistema están en el esquema "rl".
-- ⚠️ Con tu usuario puedes también cambiar datos: no ejecutes UPDATE/DELETE aquí sin respaldo.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Todas las tablas del sistema con su cantidad aproximada de filas
SELECT relname AS tabla, n_live_tup AS filas_aprox
FROM pg_stat_user_tables WHERE schemaname = 'rl'
ORDER BY relname;

-- 2) Columnas y tipo de dato de una tabla (cambia 'horas_registros' por la que quieras)
SELECT column_name AS columna, data_type AS tipo, is_nullable AS acepta_vacio
FROM information_schema.columns
WHERE table_schema = 'rl' AND table_name = 'horas_registros'
ORDER BY ordinal_position;

-- 3) Cuándo se actualizó por última vez cada tabla que viene de las hojas
SELECT clave, filas, actualizado AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima' AS actualizado_lima
FROM rl.th_estado ORDER BY actualizado DESC;

-- 4) ACUMULACIÓN DE HORAS · saldo de cada trabajador (sin los anulados)
SELECT dni::bigint AS dni, MAX(nombre::text) AS nombre,
       ROUND(SUM(horas_acumuladas)::numeric, 2) AS acumuladas,
       ROUND(SUM(horas_permiso)::numeric, 2)    AS permiso,
       ROUND(SUM(horas_acumuladas - horas_permiso - horas_deuda)::numeric, 2) AS saldo,
       GREATEST(0, ROUND(-SUM(horas_acumuladas - horas_permiso - horas_deuda)::numeric, 2)) AS deuda_real
FROM rl.horas_registros
WHERE COALESCE(LOWER(estado::text), '') <> 'rechazado'
GROUP BY dni ORDER BY saldo;

-- 5) ACUMULACIÓN DE HORAS · historial de un trabajador (cambia el DNI)
SELECT id, (fecha_entrada AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima')::date AS dia, motivo,
       horas_trabajadas, jornada_esperada, horas_acumuladas, horas_permiso, horas_deuda, estado
FROM rl.horas_registros WHERE dni = 72954772
ORDER BY fecha_registro;

-- 6) ATENCIONES · las 50 más recientes
SELECT * FROM rl.atenciones ORDER BY fecha_registro DESC NULLS LAST LIMIT 50;

-- 7) ATENCIONES · cantidad por mes y empresa (últimos 12 meses)
SELECT to_char(fecha_atencion, 'YYYY-MM') AS mes, UPPER(empresa::text) AS empresa, COUNT(*) AS atenciones
FROM rl.atenciones
WHERE fecha_atencion >= date_trunc('month', now()) - interval '11 months'
GROUP BY 1, 2 ORDER BY 1 DESC, 2;

-- 8) Buscar un trabajador por DNI en el padrón (ejecuta la de su empresa)
SELECT * FROM rl.trabajadores_rapel   WHERE dni::text = '46073509';
SELECT * FROM rl.trabajadores_verfrut WHERE dni::text = '46073509';

-- 9) BIENESTAR · casos por módulo (tablas bs_*)
SELECT 'accidentes' AS modulo, COUNT(*) FROM rl.bs_accidentes_casos
UNION ALL SELECT 'subsidios', COUNT(*) FROM rl.bs_subsidios
UNION ALL SELECT 'hallazgos', COUNT(*) FROM rl.bs_quejas
UNION ALL SELECT 'hostigamiento', COUNT(*) FROM rl.bs_hostigamiento;

-- 10) Archivos (fotos y PDF) guardados en Supabase Storage, por carpeta
SELECT bucket_id AS carpeta, COUNT(*) AS archivos,
       pg_size_pretty(SUM((metadata->>'size')::bigint)) AS tamano
FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;
