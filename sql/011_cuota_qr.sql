-- La cuota con la que sale la credencial se elige por plan (antes era un switch por evento).
-- Solo hace falta en bases que ya corrieron la primera versión de 010; en el resto no cambia nada.
-- Idempotente: se puede correr más de una vez.
BEGIN;

ALTER TABLE plan_pago ADD COLUMN IF NOT EXISTS cuota_qr smallint; -- NULL = al completar el pago
ALTER TABLE pago      ADD COLUMN IF NOT EXISTS envia_qr boolean NOT NULL DEFAULT false;
ALTER TABLE evento    DROP COLUMN IF EXISTS qr_con_pago_parcial;

COMMIT;
