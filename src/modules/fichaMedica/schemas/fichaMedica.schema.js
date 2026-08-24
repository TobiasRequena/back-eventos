const { z } = require('zod');

const medicacionItemSchema = z.object({
  nombre: z.string().min(1),
  dosis: z.string().min(1),
  horario: z.string().min(1),
});

const adaptacionesSchema = z.object({
  movilidad: z.boolean().default(false),
  lengua_senas: z.boolean().default(false),
  material_accesible: z.boolean().default(false),
  acompanante: z.boolean().default(false),
  espacio_tranquilo: z.boolean().default(false),
  participacion: z.boolean().default(false),
  otra: z.string().optional(),
}).optional();

const fichaMedicaSchema = z.object({
  obra_social: z.string().max(200).optional(),
  tipo_sangre: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  tiene_diabetes: z.boolean().default(false),
  tiene_asma: z.boolean().default(false),
  tiene_epilepsia: z.boolean().default(false),
  tiene_cardiopatia: z.boolean().default(false),
  otras_condiciones: z.string().optional(),
  alergias: z.string().optional(),
  restricciones_alimentarias: z.string().optional(),
  medicacion: z.array(medicacionItemSchema).optional(),
  tiene_discapacidad: z.boolean().default(false),
  adaptaciones: adaptacionesSchema,
  recomendaciones: z.string().optional(),
});

const crearFichaMedicaSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: fichaMedicaSchema,
});

module.exports = { fichaMedicaSchema, crearFichaMedicaSchema };