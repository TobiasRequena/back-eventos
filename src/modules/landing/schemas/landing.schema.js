const { z } = require('zod');

// Que la función exista se valida contra la tabla funcion_landing (en el controller)
const funcion = z.string().trim().min(1).max(100);

const sugerenciaSchema = z.object({
  body: z.object({ texto: z.string().trim().min(1, 'Escribí tu sugerencia').max(500) }),
});

const meInteresaSchema = z.object({ body: z.object({ funcion }) });

const quitarMeInteresaSchema = z.object({ params: z.object({ funcion }) });

// Al iniciar sesión: los me gusta que la persona ya tenía en el navegador
const sincronizarSchema = z.object({
  // Lo que venga guardado en el navegador puede tener nombres viejos: el controller los descarta
  body: z.object({ funciones: z.array(z.string().max(100)).max(50) }),
});

const galeriaParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de evento inválido'),
    archivoId: z.string().uuid('Id de foto inválido').optional(),
  }),
});

module.exports = { sugerenciaSchema, meInteresaSchema, quitarMeInteresaSchema, sincronizarSchema, galeriaParamsSchema };
