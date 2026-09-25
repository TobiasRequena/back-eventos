-- Landing: eventos y organizaciones visibles, logo, buzón de sugerencias y me gusta.
-- Idempotente: se puede correr más de una vez.
-- Las fotos de galería no necesitan columna: se distinguen por key LIKE 'galeria_evento/%',
-- igual que las portadas ('portada_evento/%').
BEGIN;

ALTER TABLE evento
  ADD COLUMN IF NOT EXISTS mostrar_en_landing boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_evento_landing
  ON evento (fecha_inicio)
  WHERE mostrar_en_landing = true AND inscripciones_cerradas = false;

ALTER TABLE organizacion
  ADD COLUMN IF NOT EXISTS mostrar_en_landing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_url varchar(500);

CREATE TABLE IF NOT EXISTS sugerencia_funcion (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto     varchar(500) NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interes_funcion (
  funcion varchar(100) PRIMARY KEY,
  votos   integer NOT NULL DEFAULT 0 CHECK (votos >= 0)
);

CREATE TABLE IF NOT EXISTS interes_funcion_usuario (
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  funcion    varchar(100) NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, funcion)
);

COMMIT;
