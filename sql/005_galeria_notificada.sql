-- Mail "ya podés subir las fotos" cuando termina un evento. Idempotente.
BEGIN;

ALTER TABLE evento
  ADD COLUMN IF NOT EXISTS galeria_notificada boolean NOT NULL DEFAULT false;

-- Los eventos que ya terminaron no reciben el mail (si no, al deployar le llegaría uno por cada evento viejo)
UPDATE evento SET galeria_notificada = true WHERE fecha_fin < now() AND galeria_notificada = false;

COMMIT;
