ALTER TABLE pago
  ADD COLUMN tramo_id uuid REFERENCES tramo_precio_plataforma(id);
