const { z } = require('zod');

const crearSesionSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
    apellido: z.string().min(1, 'El apellido es obligatorio').max(150),
    eventoId: z.string().uuid('eventoId inválido'),
    puntoAccesoId: z.string().uuid().nullish(),
  }),
});

const escanearQrSchema = z.object({
  body: z.object({
    qrPersonal: z.string().min(1, 'El QR es obligatorio'),
    acreditadorId: z.string().uuid('acreditadorId inválido'),
    eventoId: z.string().uuid('eventoId inválido'),
  }),
});

const checkinGrupalSchema = z.object({
  body: z.object({
    participanteIds: z.array(z.string().uuid()).min(1, 'Debe incluir al menos un participante'),
    acreditadorId: z.string().uuid('acreditadorId inválido'),
    eventoId: z.string().uuid('eventoId inválido'),
    puntoAccesoId: z.string().uuid().nullish(),
  }),
});

module.exports = {
  crearSesionSchema,
  escanearQrSchema,
  checkinGrupalSchema,
};