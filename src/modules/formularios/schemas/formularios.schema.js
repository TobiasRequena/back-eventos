const { z } = require('zod');

const TIPO_CAMPO_FORM = ['texto', 'numero', 'fecha', 'seleccion', 'booleano'];

const crearCampoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
  body: z
    .object({
      etiqueta: z.string().min(1, 'La etiqueta es obligatoria').max(100),
      tipo: z.enum(TIPO_CAMPO_FORM),
      opciones: z.array(z.string()).optional(),
      requerido: z.boolean().default(false),
      orden: z.number().int().nonnegative(),
    })
    .refine(
      (data) => data.tipo !== 'seleccion' || (data.opciones && data.opciones.length > 0),
      {
        message: 'Los campos de tipo "seleccion" necesitan al menos una opción',
        path: ['opciones'],
      }
    ),
});

const editarCampoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
    campoId: z.string().uuid('Id de campo inválido'),
  }),
  body: z
    .object({
      etiqueta: z.string().min(1).max(100).optional(),
      tipo: z.enum(TIPO_CAMPO_FORM).optional(),
      opciones: z.array(z.string()).optional(),
      requerido: z.boolean().optional(),
      orden: z.number().int().nonnegative().optional(),
    })
    .refine(
      (data) => !data.tipo || data.tipo !== 'seleccion' || (data.opciones && data.opciones.length > 0),
      {
        message: 'Los campos de tipo "seleccion" necesitan al menos una opción',
        path: ['opciones'],
      }
    ),
});

const idParamsSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
    campoId: z.string().uuid('Id de campo inválido'),
  }),
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
  crearCampoSchema,
  editarCampoSchema,
  idParamsSchema,
  reordenarCamposSchema,
  TIPO_CAMPO_FORM,
};