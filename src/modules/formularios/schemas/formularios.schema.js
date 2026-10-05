const { z } = require('zod');

const TIPO_CAMPO_FORM = ['texto', 'numero', 'fecha', 'seleccion', 'booleano'];

// Solo se edita etiqueta, opciones (agregar/renombrar), multiple y estado (baja lógica).
// No se cambia tipo ni requerido, y no se pueden crear campos después de crear el evento.
const editarCampoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
    campoId: z.string().uuid('Id de campo inválido'),
  }),
  body: z
    .object({
      etiqueta: z.string().trim().min(1, 'La etiqueta es obligatoria').max(100).optional(),
      opciones: z.array(z.string().trim().min(1, 'Las opciones no pueden estar vacías')).min(1).optional(),
      activo: z.boolean().optional(),
      multiple: z.boolean().optional(),
    })
    .strict()
    .refine(
      (data) => !data.opciones || new Set(data.opciones).size === data.opciones.length,
      { message: 'Las opciones no pueden repetirse', path: ['opciones'] }
    ),
});

// Schema para reordenar — recibe un array de { id, orden }
const reordenarCamposSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
  body: z.object({
    campos: z.array(
      z.object({
        id: z.string().uuid('Id de campo inválido'),
        orden: z.number().int().nonnegative(),
      })
    ).min(1, 'Debe incluir al menos un campo para reordenar'),
  }),
});

module.exports = {
  editarCampoSchema,
  reordenarCamposSchema,
  TIPO_CAMPO_FORM,
};