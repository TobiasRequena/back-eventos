const { z } = require('zod');

// Formato genérico de atributo — usado para criterio_tanda_atributo y balanceo_atributo
const atributoSchema = z.object({
  origen: z.enum(['fijo', 'campo_form']),
  campo: z.enum(['edad', 'es_mayor', 'grupo_inscripcion', 'rol_grupo', 'estado_pago', 'taller']).optional(),
  campo_form_id: z.string().uuid().optional(),
}).refine(
  (d) => d.origen === 'fijo' ? !!d.campo : !!d.campo_form_id,
  { message: 'Debe especificar campo o campo_form_id según el origen' }
);

// Condición de filtro de elegibilidad
const condicionFiltroSchema = z.object({
  atributo: atributoSchema,
  operador: z.enum(['igual', 'distinto', 'mayor_que', 'menor_que', 'contiene']),
  valor: z.unknown(),
});

// Condición de tanda — el atributo lo define el esquema, la tanda solo tiene operador+valor
const condicionTandaSchema = z.object({
  operador: z.enum(['igual', 'distinto', 'mayor_que', 'menor_que', 'entre']),
  valor: z.unknown(),
  valor2: z.unknown().optional(), // solo para operador 'entre'
});

const crearEsquemaSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(150),
    universoBase: z.enum(['inscriptos', 'acreditados']).default('inscriptos'),
    criterioTandaAtributo: atributoSchema.optional(),
    modoTamano: z.enum(['por_cantidad', 'por_tamano']),
    valorTamano: z.number().int().positive(),
    balanceoAtributo: atributoSchema.optional(),
    filtroElegibilidad: z.array(condicionFiltroSchema).max(3).optional(),
    modoNombrado: z.enum(['por_tanda', 'por_grupo']).default('por_grupo'),
    accionSinNombres: z.enum(['bloquear_generacion', 'reciclar_numerado']).default('reciclar_numerado'),
    nombresPreset: z.enum(['letras', 'colores', 'animales', 'comidas', 'custom']).default('letras'),
    nombresLista: z.array(z.string()).default([]),
  }),
});

const editarEsquemaSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
  }),
  body: z.object({
    nombre: z.string().min(1).max(150).optional(),
    universoBase: z.enum(['inscriptos', 'acreditados']).optional(),
    criterioTandaAtributo: atributoSchema.nullable().optional(),
    modoTamano: z.enum(['por_cantidad', 'por_tamano']).optional(),
    valorTamano: z.number().int().positive().optional(),
    balanceoAtributo: atributoSchema.nullable().optional(),
    filtroElegibilidad: z.array(condicionFiltroSchema).max(3).nullable().optional(),
    modoNombrado: z.enum(['por_tanda', 'por_grupo']).optional(),
    accionSinNombres: z.enum(['bloquear_generacion', 'reciclar_numerado']).optional(),
    nombresPreset: z.enum(['letras', 'colores', 'animales', 'comidas', 'custom']).optional(),
    nombresLista: z.array(z.string()).optional(),
  }),
});

const crearTandaSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
  }),
  body: z.object({
    orden: z.number().int().nonnegative(),
    nombreResuelto: z.string().max(100).optional(),
    condicion: condicionTandaSchema,
  }),
});

const editarTandaSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
    tandaId: z.string().uuid(),
  }),
  body: z.object({
    orden: z.number().int().nonnegative().optional(),
    nombreResuelto: z.string().max(100).nullable().optional(),
    condicion: condicionTandaSchema.optional(),
  }),
});

const reordenarTandasSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
  }),
  body: z.object({
    tandas: z.array(z.object({
      id: z.string().uuid(),
      orden: z.number().int().nonnegative(),
    })).min(1),
  }),
});

const excluirParticipantesSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
  }),
  body: z.object({
    participanteIds: z.array(z.string().uuid()).min(1),
  }),
});

const asignarAGrupoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
    grupoId: z.string().uuid(),
  }),
  body: z.object({
    participanteId: z.string().uuid(),
  }),
});

const quitarDeGrupoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
    grupoId: z.string().uuid(),
    participanteId: z.string().uuid(),
  }),
});

const esquemaIdParamSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
  }),
});

const eventoIdParamSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
  }),
});

const quitarExcluidoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
    participanteId: z.string().uuid(),
  }),
});

const grupoIdParamSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
    esquemaId: z.string().uuid(),
    grupoId: z.string().uuid(),
  }),
});

module.exports = {
  crearEsquemaSchema,
  editarEsquemaSchema,
  crearTandaSchema,
  editarTandaSchema,
  reordenarTandasSchema,
  excluirParticipantesSchema,
  asignarAGrupoSchema,
  quitarDeGrupoSchema,
  esquemaIdParamSchema,
  eventoIdParamSchema,
  quitarExcluidoSchema,
  grupoIdParamSchema,
};