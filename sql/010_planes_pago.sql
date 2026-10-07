-- Planes de pago en cuotas para las inscripciones.
-- El organizador define planes (ej. "Pago total", "3 cuotas"); cada cuota vale un
-- porcentaje o un monto fijo, y la última es siempre "el resto" (porcentaje y monto NULL).
-- Al inscribirse, el participante elige un plan y se crea una fila en `pago` por cuota
-- (snapshot del monto). Los comprobantes quedan ligados a la cuota con archivo.pago_id.
-- Idempotente: se puede correr más de una vez.
BEGIN;

CREATE TABLE IF NOT EXISTS plan_pago (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES organizacion(id) ON DELETE CASCADE,
  evento_id uuid NOT NULL REFERENCES evento(id) ON DELETE CASCADE,
  nombre    varchar(100) NOT NULL,
  orden     smallint NOT NULL DEFAULT 0,
  cuota_qr  smallint -- con qué cuota aprobada sale la credencial; NULL = al completar el pago
);
CREATE INDEX IF NOT EXISTS idx_plan_pago_evento ON plan_pago (evento_id);

CREATE TABLE IF NOT EXISTS plan_pago_cuota (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_pago_id uuid NOT NULL REFERENCES plan_pago(id) ON DELETE CASCADE,
  numero       smallint NOT NULL CHECK (numero BETWEEN 1 AND 12),
  porcentaje   numeric(5,2) CHECK (porcentaje > 0 AND porcentaje < 100),
  monto        numeric(12,2) CHECK (monto > 0),
  vencimiento  date,
  CHECK (porcentaje IS NULL OR monto IS NULL), -- ambos NULL = "resto" (última cuota)
  UNIQUE (plan_pago_id, numero)
);

ALTER TABLE pago ADD COLUMN IF NOT EXISTS numero_cuota         smallint;
ALTER TABLE pago ADD COLUMN IF NOT EXISTS vencimiento          date;
ALTER TABLE pago ADD COLUMN IF NOT EXISTS recordatorio_enviado boolean NOT NULL DEFAULT false;
ALTER TABLE pago ADD COLUMN IF NOT EXISTS envia_qr             boolean NOT NULL DEFAULT false;

ALTER TABLE archivo ADD COLUMN IF NOT EXISTS pago_id uuid REFERENCES pago(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_archivo_pago ON archivo (pago_id);

-- Backfill: una cuota única para cada inscripto con costo que todavía no tenga cuotas.
-- 'pendiente_aprobacion' queda como cuota 'pendiente' con comprobante = "en revisión".
INSERT INTO pago (org_id, evento_id, participante_id, tipo, metodo, monto, estado, numero_cuota)
SELECT p.org_id, p.evento_id, p.id, 'inscripcion', 'transferencia',
       COALESCE(z.costo, e.costo),
       CASE p.estado_pago
         WHEN 'aprobado'  THEN 'aprobado'
         WHEN 'rechazado' THEN 'rechazado'
         ELSE 'pendiente'
       END::estado_pago_registro,
       1
FROM participante p
JOIN evento e ON e.id = p.evento_id
LEFT JOIN zona_costo z ON z.id = p.zona_costo_id
WHERE p.estado_pago <> 'no_aplica'
  AND NOT EXISTS (
    SELECT 1 FROM pago x WHERE x.participante_id = p.id AND x.tipo = 'inscripcion'
  );

-- Ligar los comprobantes existentes a esa cuota única
UPDATE archivo a
SET pago_id = x.id
FROM pago x
WHERE x.participante_id = a.participante_id
  AND x.tipo = 'inscripcion'
  AND x.numero_cuota = 1
  AND a.pago_id IS NULL
  AND a.key LIKE 'comprobante_pago/%';

COMMIT;
