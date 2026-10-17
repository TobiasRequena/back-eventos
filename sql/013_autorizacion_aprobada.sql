-- El organizador aprueba o rechaza la autorización de menor. Rechazar borra autorizacion_url
-- (el participante la vuelve a subir), así que solo hace falta marcar la aprobación.
-- Idempotente: se puede correr más de una vez.
ALTER TABLE participante ADD COLUMN IF NOT EXISTS autorizacion_aprobada boolean NOT NULL DEFAULT false;
