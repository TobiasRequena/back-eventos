const { z } = require('zod');

// Contextos posibles de una subida — determina a qué FK de `archivo`
// se asocia el archivo subido.
const CONTEXTO_ARCHIVO = ['portada_evento', 'comprobante_pago'];

const subirArchivoSchema = z.object({
  body: z.object({
    orgId: z.string().uuid('orgId es obligatorio'),
    eventoId: z.string().uuid().optional(),
    participanteId: z.string().uuid().optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de archivo inválido'),
  }),
});

module.exports = { subirArchivoSchema, idParamSchema, CONTEXTO_ARCHIVO };