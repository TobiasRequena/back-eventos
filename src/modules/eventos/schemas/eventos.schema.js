const { z } = require('zod');
const { bloqueTallerSchema } = require('../../talleres/schemas/talleres.schema');

const POLITICA_MENOR = ['obligatorio', 'opcional', 'no_aplica'];
const TIPO_CAMPO_FORM = ['texto', 'numero', 'fecha', 'seleccion', 'booleano'];

const campoFormSchema = z
  .object({
    etiqueta: z.string().min(1, 'La etiqueta del campo es obligatoria').max(100),
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
  );

const crearEventoSchema = z.object({
  body: z
    .object({
      nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
      descripcion: z.string().max(2000).optional(),
      codigo: z
        .string()
        .min(3, 'El código debe tener al menos 3 caracteres')
        .max(20)
        .regex(/^[A-Za-z0-9_-]+$/, 'El código solo puede tener letras, números, guiones'),
      fechaInicio: z.string().datetime({ message: 'fechaInicio debe ser una fecha ISO válida' }),
      fechaFin: z.string().datetime({ message: 'fechaFin debe ser una fecha ISO válida' }),
      politicaMenor: z.enum(POLITICA_MENOR).default('no_aplica'),
      tieneGrupos: z.boolean().default(false),
      tieneTalleres: z.boolean().default(false),
      cbuCvu: z.string().max(50).optional(),
      aliasCobro: z.string().max(50).optional(),
      costo: z.number().nonnegative().default(0),
      camposForm: z.array(campoFormSchema).optional().default([]),
      // Reemplaza al viejo array plano `talleres` — ahora cada elemento
      // es un bloque con sus talleres adentro (ver nota en MODELO_DATOS.md
      // sobre bloque_taller).
      bloquesTaller: z.array(bloqueTallerSchema).optional().default([]),
    })
    .refine((data) => new Date(data.fechaFin) >= new Date(data.fechaInicio), {
      message: 'fechaFin debe ser igual o posterior a fechaInicio',
      path: ['fechaFin'],
    }),
});

const editarEventoSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de evento inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(150).optional(),
    descripcion: z.string().max(2000).optional(),
    fechaInicio: z.string().datetime().optional(),
    fechaFin: z.string().datetime().optional(),
    politicaMenor: z.enum(POLITICA_MENOR).optional(),
    tieneGrupos: z.boolean().optional(),
    tieneTalleres: z.boolean().optional(),
    cbuCvu: z.string().max(50).optional(),
    aliasCobro: z.string().max(50).optional(),
    costo: z.number().nonnegative().optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de evento inválido'),
  }),
});

const buscarPorCodigoSchema = z.object({
  params: z.object({
    codigo: z.string().min(1),
  }),
});

module.exports = {
  crearEventoSchema,
  editarEventoSchema,
  idParamSchema,
  buscarPorCodigoSchema,
  campoFormSchema,
  POLITICA_MENOR,
  TIPO_CAMPO_FORM,
};