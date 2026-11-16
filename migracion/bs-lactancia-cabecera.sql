/* bs-lactancia-cabecera.sql — _BS_LACTANCIA_V1 (16-nov-2026)
   Registra la cabecera (th_estado) de las dos tablas nuevas para que el servidor las lea desde ya (los horarios sembrados
   eran invisibles sin ella). Idempotente. Uso: cd C:\sistema-rl-verfrut\migracion ; node aplicar-sql.js bs-lactancia-cabecera.sql */
INSERT INTO rl.th_estado (clave, encabezado, ancho, marca, filas, actualizado)
SELECT 'bs_gs_lactancia_horarios', '["id","nombre","meses","desde_fecha","hasta_fecha","lv_horas","sab_horas","detalle","activo","created_by","created_at","updated_by","updated_at","anulado"]', 14, '1794864483521', (SELECT COUNT(*) FROM rl."bs_gs_lactancia_horarios"), now()
WHERE NOT EXISTS (SELECT 1 FROM rl.th_estado WHERE clave = 'bs_gs_lactancia_horarios');
INSERT INTO rl.th_estado (clave, encabezado, ancho, marca, filas, actualizado)
SELECT 'bs_gs_lactancia', '["id","codigo","dni","nombre","empresa","sede","fundo","cargo","supervisor","fecha_parto","parto_multiple","horas_dia","fecha_retorno","fecha_fin","acuerdo_firmado","fecha_acuerdo","descansos","ausencias","estado","fecha_cierre","observaciones","created_by","created_at","updated_by","updated_at","anulado"]', 26, '1794864483521', (SELECT COUNT(*) FROM rl."bs_gs_lactancia"), now()
WHERE NOT EXISTS (SELECT 1 FROM rl.th_estado WHERE clave = 'bs_gs_lactancia');
