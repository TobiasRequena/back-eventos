-- Baja lógica de campos del formulario de inscripción: las respuestas de los
-- participantes quedan en respuestas_form y el campo se puede reactivar.
-- También agrega `multiple`: los campos de selección pueden permitir elegir varias
-- opciones (la respuesta se guarda como array de strings).
-- Idempotente: se puede correr más de una vez.
BEGIN;

ALTER TABLE campo_form ADD COLUMN IF NOT EXISTS activo       boolean NOT NULL DEFAULT true;
ALTER TABLE campo_form ADD COLUMN IF NOT EXISTS eliminado_en timestamptz;
ALTER TABLE campo_form ADD COLUMN IF NOT EXISTS multiple     boolean NOT NULL DEFAULT false;

COMMIT;
