-- consultas-extra.sql — consultas de SOLO LECTURA para VS Code (06-nov-2026)
-- Selecciona una consulta completa y pulsa ▶️ (o Ctrl+Shift+E). Conexión: Supabase RL

-- ═══════════════════════ CONSULTAS NUEVAS (06-nov-2026) ═══════════════════════

-- 11) ATENCIONES · por supervisor en el mes actual (más atenciones arriba)
SELECT supervisor::text AS supervisor, UPPER(empresa::text) AS empresa, COUNT(*) AS atenciones
FROM rl.atenciones
WHERE fecha_atencion >= date_trunc('month', now())
GROUP BY 1, 2 ORDER BY 3 DESC;

-- 12) ATENCIONES · por tipo de documento/trámite en el mes actual
SELECT COALESCE(NULLIF(detalle_documento::text, ''), '(sin detalle)') AS tipo,
       UPPER(empresa::text) AS empresa, COUNT(*) AS atenciones
FROM rl.atenciones
WHERE fecha_atencion >= date_trunc('month', now())
GROUP BY 1, 2 ORDER BY 3 DESC;

-- 13) ATENCIONES · por día en los últimos 7 días
SELECT fecha_atencion AS dia, UPPER(empresa::text) AS empresa, COUNT(*) AS atenciones
FROM rl.atenciones
WHERE fecha_atencion >= current_date - 6
GROUP BY 1, 2 ORDER BY 1 DESC, 2;

-- 14) ATENCIONES · historial de un trabajador (cambia el DNI)
SELECT nro, fecha_atencion, hora_inicio, UPPER(empresa::text) AS empresa, supervisor,
       detalle_documento, estado, observaciones
FROM rl.atenciones WHERE dni::text = '46073509'
ORDER BY fecha_atencion DESC, hora_inicio DESC;

-- 15) ATENCIONES · casos no finalizados (los más antiguos primero)
SELECT nro, fecha_atencion, current_date - fecha_atencion AS dias_abierto,
       nombre, UPPER(empresa::text) AS empresa, supervisor, detalle_documento, estado
FROM rl.atenciones
WHERE COALESCE(UPPER(estado::text), '') NOT IN ('FINALIZADO', 'ANULADO')
ORDER BY fecha_atencion
LIMIT 200;

-- 16) ACUMULACIÓN DE HORAS · solo trabajadores que deben horas (deuda real)
SELECT dni::bigint AS dni, MAX(nombre::text) AS nombre, MAX(UPPER(empresa::text)) AS empresa,
       ROUND(-SUM(horas_acumuladas - horas_permiso - horas_deuda)::numeric, 2) AS horas_que_debe
FROM rl.horas_registros
WHERE COALESCE(LOWER(estado::text), '') <> 'rechazado'
GROUP BY dni
HAVING SUM(horas_acumuladas - horas_permiso - horas_deuda) < 0
ORDER BY horas_que_debe DESC;

-- 17) ACUMULACIÓN DE HORAS · registros del mes actual por usuario que registró
SELECT registrado_por::text AS registrado_por, motivo::text AS motivo, COUNT(*) AS registros
FROM rl.horas_registros
WHERE (fecha_registro AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima') >= date_trunc('month', now() AT TIME ZONE 'America/Lima')
  AND COALESCE(LOWER(estado::text), '') <> 'rechazado'
GROUP BY 1, 2 ORDER BY 1, 3 DESC;
