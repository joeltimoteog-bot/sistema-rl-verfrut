-- _ALCANCE_V1 (21-nov-2026, decision de Joel): alcance de cada usuario dentro de sus modulos.
-- PROPIO = solo lo que registra · SEDE = todo lo de su sede (Olmos o Piura) · GENERAL = las dos sedes.
-- Solo AGREGA una columna; todos quedan en PROPIO (como funciona hoy) salvo jtimoteo (GENERAL).
ALTER TABLE rl.usuarios ADD COLUMN IF NOT EXISTS alcance extensions.citext NOT NULL DEFAULT 'PROPIO';
UPDATE rl.usuarios SET alcance = 'GENERAL' WHERE lower(usuario) = 'jtimoteo' AND alcance <> 'GENERAL';
SELECT alcance, count(*) AS usuarios FROM rl.usuarios GROUP BY alcance ORDER BY alcance;
