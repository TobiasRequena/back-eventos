const { z } = require('zod');

// Mismos nombres que FUNCIONES en front-eventos/src/pages/landing/datosLanding.js.
// Si se agrega o renombra una función allá, hay que actualizarla acá.
const FUNCIONES = [
  'Gestioná tu organización',
  'Historial de eventos',
  'Agrupar automático',
  'Agrupar manual',
  'Comunicaciones',
  'Visualización de datos eficiente',
  'Política de menores',
  'Cupo máximo',
  'Ficha médica',
  'Inscripción grupal',
  'Pasar lista',
  'Botón de emergencia',
];

const funcion = z.enum(FUNCIONES, { message: 'Función desconocida' });

const sugerenciaSchema = z.object({
  body: z.object({ texto: z.string().trim().min(1, 'Escribí tu sugerencia').max(500) }),
});

const meInteresaSchema = z.object({ body: z.object({ funcion }) });

const quitarMeInteresaSchema = z.object({ params: z.object({ funcion }) });

// Al iniciar sesión: los me gusta que la persona ya tenía en el navegador
const sincronizarSchema = z.object({
  // Lo que venga guardado en el navegador puede tener nombres viejos: se descartan en vez de fallar
  body: z.object({
    funciones: z.array(z.string()).max(50).transform((lista) => lista.filter((f) => FUNCIONES.includes(f))),
  }),
});

const galeriaParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de evento inválido'),
    archivoId: z.string().uuid('Id de foto inválido').optional(),
  }),
});

module.exports = { sugerenciaSchema, meInteresaSchema, quitarMeInteresaSchema, sincronizarSchema, galeriaParamsSchema };
