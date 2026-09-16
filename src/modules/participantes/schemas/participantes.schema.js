const { z } = require('zod');

const ROL_GRUPO = ['responsable', 'integrante', 'autoinscripto', 'ninguno'];
const ESTADO_VINCULO = ['pendiente', 'aceptado', 'rechazado'];
const ESTADO_PAGO = ['no_aplica', 'pendiente', 'aprobado', 'rechazado'];
const PAGADO_POR = ['individual', 'grupal'];

const crearParticipanteSchema = z.object({
  body: z.object({
    // Datos personales
    nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
    apellido: z.string().min(1, 'El apellido es obligatorio').max(150),
    email: z.string().email('Email inválido').max(255),
    dni: z.string().min(1, 'El DNI es obligatorio').max(20),
    nacimiento: z.string().regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'nacimiento debe tener formato YYYY-MM-DD'
    ),

    // Contexto del evento
    eventoId: z.string().uuid('eventoId inválido'),


    // Grupo (opcional — si no viene, es inscripción individual)
    grupoId: z.string().uuid().nullable().optional(),

    rolGrupo: z.enum(ROL_GRUPO).default('ninguno'),
    responsableId: z.string().uuid().nullable().optional(),
    // solo si es menor vinculado a un responsable

    tallerIds: z.array(z.string().uuid()).optional().default([]),
    estadoPago: z.enum(['pendiente', 'aprobado', 'no_aplica', 'rechazado']).optional(),
    zonaCostoId: z.string().uuid('zonaCostoId inválido').nullable().optional(),

    // Respuestas al formulario dinámico del evento
    // Objeto libre: { [campo_form_id]: valor }
    // La validación profunda (tipos, requeridos, opciones) la hace el service
    // consultando campo_form en la base — Zod solo garantiza que sea un objeto.
    respuestasForm: z.record(z.unknown()).optional().default({}),

    // Ficha médica opcional
    fichaMedica: z.record(z.unknown()).nullable().optional(),
  }),
});

const editarParticipanteSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de participante inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(150).optional(),
    apellido: z.string().min(1).max(150).optional(),
    email: z.string().email().max(255).optional(),
    respuestasForm: z.record(z.unknown()).optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de participante inválido'),
  }),
});

const actualizarEstadoVinculoSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de participante inválido'),
  }),
  body: z.object({
    estado: z.enum(['aceptado', 'rechazado']),
  }),
});

const reenviarMailSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de participante inválido'),
  }),
  body: z.object({
    email: z.string().email('Email inválido').optional(),
  }),
});

const actualizarEstadoPagoSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    estadoPago: z.enum(['pendiente', 'pendiente_aprobacion', 'aprobado', 'rechazado']),
  }),
});

const actualizarZonaCostoSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de participante inválido'),
  }),
  body: z.object({
    zonaCostoId: z.string().uuid('zonaCostoId inválido').nullable(),
  }),
});

const listaPdfSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('eventoId inválido'),
  }),
  body: z.object({
    registros: z
      .array(
        z.object({
          participanteId: z.string().uuid('participanteId inválido'),
          estado: z.enum(['presente', 'ausente']),
        })
      )
      .min(1, 'Debe enviar al menos un registro'),
    // Datos de los filtros aplicados en el front, solo para mostrar en la cabecera del PDF
    filtros: z.record(z.string()).optional(),
  }),
});

module.exports = {
  crearParticipanteSchema,
  editarParticipanteSchema,
  idParamSchema,
  actualizarEstadoVinculoSchema,
  ROL_GRUPO,
  ESTADO_VINCULO,
  ESTADO_PAGO,
  PAGADO_POR,
  reenviarMailSchema,
  actualizarEstadoPagoSchema,
  actualizarZonaCostoSchema,
  listaPdfSchema,
};