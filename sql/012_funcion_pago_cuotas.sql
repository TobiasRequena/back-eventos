-- Landing: suma "Pagos en cuotas" a las funciones específicas. Idempotente.
INSERT INTO funcion_landing (nombre, descripcion, en_desarrollo, orden) VALUES
  ('Pagos en cuotas', 'Armá planes en cuotas con montos y vencimientos: cada inscripto elige cómo pagar, sube un comprobante por cuota y le avisamos antes de cada vencimiento. Vos decidís con qué cuota recibe su credencial.', false, 12)
ON CONFLICT (nombre) DO NOTHING;
