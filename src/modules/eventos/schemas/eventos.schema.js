const { z } = require('zod');

const POLITICA_MENOR = ['obligatorio', 'opcional', 'no_aplica'];
const MODO_TALLER = ['paralelos', 'secuenciales', 'ninguno'];
const TIPO_CAMPO_FORM = ['texto', 'numero', 'fecha', 'seleccion', 'booleano'];

// Schema de un campo de formulario individual, dentro del array.
// Lo separamos para reusarlo también cuando construyamos el módulo
// formularios (POST /eventos/:id/campos-form va a usar este mismo shape).
const campoFormSchema = z
  .object({
    etiqueta: z.string().min(1, 'La etiqueta del campo es obligatoria').max(100),
    tipo: z.enum(TIPO_CAMPO_FORM),
    opciones: z.array(z.string()).optional(), // solo tiene sentido si tipo === 'seleccion'
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
      modoTaller: z.enum(MODO_TALLER).default('ninguno'),
      cbuCvu: z.string().max(50).optional(),
      aliasCobro: z.string().max(50).optional(),
      costo: z.number().nonnegative().default(0),
      camposForm: z.array(campoFormSchema).optional().default([]),
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
    modoTaller: z.enum(MODO_TALLER).optional(),
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
  MODO_TALLER,
  TIPO_CAMPO_FORM,
};