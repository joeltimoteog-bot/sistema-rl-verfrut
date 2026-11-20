/* alerta-subsidio.sql — _SUBSIDIO_REGISTRO_V1 (20-nov-2026, decision de Joel: opcion B)
   Columna nueva en rl.atenciones con la alerta de subsidio que mostro Nueva atencion al registrar un CITT, CMP o
   descanso medico (dias del ano, desde cuando corresponde subsidio EsSalud, maternidad o SCTR). Es una FOTO del momento
   del registro. Sale en el Excel de Mis Atenciones y de Consulta por DNI como "Alerta Subsidio".
   Solo AGREGA una columna vacia (no cambia ni borra nada). Idempotente.
   Uso: cd C:\sistema-rl-verfrut\migracion ; node aplicar-sql.js alerta-subsidio.sql */
ALTER TABLE rl.atenciones ADD COLUMN IF NOT EXISTS alerta_subsidio extensions.citext;
