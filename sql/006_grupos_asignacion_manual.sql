-- Grupos de trabajo: el admin arma los grupos a mano en vez de generarlos. Idempotente.
BEGIN;

ALTER TABLE esquema_grupos_trabajo
  ADD COLUMN IF NOT EXISTS asignacion_manual boolean NOT NULL DEFAULT false;

COMMIT;
