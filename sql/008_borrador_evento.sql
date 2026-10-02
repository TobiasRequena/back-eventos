-- Borrador del evento que arma el asistente IA, uno por usuario (se ve desde cualquier dispositivo).
-- Sin sesión vive en el navegador; al entrar se asocia al usuario. Se borra al crear el evento.
-- Idempotente: se puede correr más de una vez.
BEGIN;

CREATE TABLE IF NOT EXISTS borrador_evento (
  usuario_id     uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  borrador       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  mensajes       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

COMMIT;
