-- "Funciones específicas" de la landing: pasan del código a la base (única fuente de verdad).
-- Para agregar una función: INSERT acá; para ocultarla sin perder votos: activa = false.
-- Idempotente: se puede correr más de una vez.
BEGIN;

CREATE TABLE IF NOT EXISTS funcion_landing (
  nombre        varchar(100) PRIMARY KEY,
  descripcion   text         NOT NULL DEFAULT '',
  en_desarrollo boolean      NOT NULL DEFAULT false,
  orden         integer      NOT NULL,
  activa        boolean      NOT NULL DEFAULT true
);

INSERT INTO funcion_landing (nombre, descripcion, en_desarrollo, orden) VALUES
  ('Gestioná tu organización', 'Sumá a tu equipo con distintos roles, compartí los eventos entre todos y trabajá sobre los mismos datos, sin planillas sueltas.', false, 1),
  ('Agrupar automático', 'Armá grupos de trabajo en un clic: Talita reparte a los inscriptos según los criterios que vos elijas.', false, 2),
  ('Agrupar manual', 'Seleccioná varios participantes a la vez y movelos al grupo que quieras. Ideal para ajustar a mano después del armado automático.', false, 3),
  ('Comunicaciones', 'Enviá mails a tus inscriptos directamente desde la plataforma.', false, 4),
  ('Registro de pagos', 'Recibí los comprobantes de transferencia de tus inscriptos, revisalos y mantené un registro de los pagos.', false, 5),
  ('Visualización de datos eficiente', 'Filtrá, buscá y descargá en Excel la información de tus inscriptos, con estadísticas claras de tu evento.', false, 6),
  ('Política de menores', 'Definí si tu evento admite menores y pedí automáticamente la autorización firmada de madre, padre o tutor.', false, 7),
  ('Cupo máximo', 'Poné un límite de inscriptos y Talita cierra la inscripción sola cuando se completa.', false, 8),
  ('Ficha médica', 'Pedí la ficha médica en la inscripción y tené a mano alergias, medicación y datos de salud cuando los necesites.', false, 9),
  ('Inscripción grupal', 'Un referente inscribe a su grupo y cada integrante completa sus datos desde su propio link.', false, 10),
  ('Pasar lista', 'Tomá lista de los participantes de forma rápida y comunicate con los que faltan.', false, 11),
  ('Botón de emergencia', 'Accedé en segundos a los contactos de emergencia y la ficha médica de cualquier participante.', false, 12),
  ('Historial de eventos', '', true, 13),
  ('Pagos dentro de la plataforma', '', true, 14)
ON CONFLICT (nombre) DO NOTHING;

-- Votos de nombres que no existen (pruebas, nombres con mal encoding): se borran para poder agregar las FK
DELETE FROM interes_funcion WHERE funcion NOT IN (SELECT nombre FROM funcion_landing);
DELETE FROM interes_funcion_usuario WHERE funcion NOT IN (SELECT nombre FROM funcion_landing);

-- Los votos quedan atados a la función: si se renombra, se renombran; si se borra, se borran
ALTER TABLE interes_funcion DROP CONSTRAINT IF EXISTS fk_interes_funcion_funcion;
ALTER TABLE interes_funcion
  ADD CONSTRAINT fk_interes_funcion_funcion FOREIGN KEY (funcion)
  REFERENCES funcion_landing (nombre) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE interes_funcion_usuario DROP CONSTRAINT IF EXISTS fk_interes_funcion_usuario_funcion;
ALTER TABLE interes_funcion_usuario
  ADD CONSTRAINT fk_interes_funcion_usuario_funcion FOREIGN KEY (funcion)
  REFERENCES funcion_landing (nombre) ON UPDATE CASCADE ON DELETE CASCADE;

COMMIT;
