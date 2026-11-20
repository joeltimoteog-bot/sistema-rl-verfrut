-- _SECTORES_OLMOS_V1 (20-nov-2026, decision de Joel): sectores de la empresa OLMOS en el padron unico (rl.sectores).
-- Un sector por fundo. Solo AGREGA filas; si alguna ya existe no se toca (ON CONFLICT DO NOTHING).
INSERT INTO rl.sectores (codigo, nombre, empresa, tipo, activo, orden, notas, actualizado_por) VALUES
  ('BOMAREA',  'Bomarea',  'OLMOS', 'CAMPO', 1, 130, 'Fundo de Olmos', 'jtimoteo'),
  ('PIRONA',   'Pirona',   'OLMOS', 'CAMPO', 1, 140, 'Fundo de Olmos', 'jtimoteo'),
  ('MOSQUETA', 'Mosqueta', 'OLMOS', 'CAMPO', 1, 150, 'Fundo de Olmos', 'jtimoteo'),
  ('HEFEI',    'Hefei',    'OLMOS', 'CAMPO', 1, 160, 'Fundo de Olmos', 'jtimoteo'),
  ('LEFKADA',  'Lefkada',  'OLMOS', 'CAMPO', 1, 170, 'Fundo de Olmos', 'jtimoteo')
ON CONFLICT (codigo) DO NOTHING;
SELECT codigo, nombre, empresa, tipo, activo, orden FROM rl.sectores WHERE empresa = 'OLMOS' ORDER BY orden;
