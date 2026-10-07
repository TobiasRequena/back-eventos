const { z } = require('zod');

// Una cuota vale un porcentaje del costo del participante o un monto fijo.
// La última cuota del plan es siempre "el resto" (sin porcentaje ni monto).
const cuotaSchema = z.object({
  porcentaje: z.number().positive().lt(100).nullable().optional(),
  monto: z.number().positive().nullable().optional(),
  vencimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'vencimiento debe tener formato YYYY-MM-DD')
    .nullable()
    .optional(),
});

// Reutilizado desde eventos.schema (los planes se pueden mandar al crear el evento)
const planPagoItemSchema = z
  .object({
    nombre: z.string().min(1, 'El nombre del plan es obligatorio').max(100),
    cuotas: z.array(cuotaSchema).min(1).max(12, 'Un plan puede tener hasta 12 cuotas'),
    // Con qué cuota aprobada se envía la credencial; null = al completar el pago
    cuotaQr: z.number().int().min(1).nullable().optional(),
  })
  .superRefine((plan, ctx) => {
    const ultima = plan.cuotas.length - 1;
    plan.cuotas.forEach((c, i) => {
      const tieneValor = c.porcentaje != null || c.monto != null;
      if (c.porcentaje != null && c.monto != null) {
        ctx.addIssue({ code: 'custom', message: 'Una cuota es porcentaje o monto, no ambos', path: ['cuotas', i] });
      }
      if (i < ultima && !tieneValor) {
        ctx.addIssue({ code: 'custom', message: `La cuota ${i + 1} necesita un porcentaje o un monto`, path: ['cuotas', i] });
      }
      if (i === ultima && tieneValor) {
        ctx.addIssue({ code: 'custom', message: 'La última cuota es el resto, no lleva valor', path: ['cuotas', i] });
      }
    });
    if (plan.cuotaQr != null && plan.cuotaQr > plan.cuotas.length) {
      ctx.addIssue({ code: 'custom', message: 'La cuota del QR no existe en el plan', path: ['cuotaQr'] });
    }
    const totalPct = plan.cuotas.reduce((s, c) => s + (c.porcentaje ?? 0), 0);
    if (totalPct >= 100) {
      ctx.addIssue({ code: 'custom', message: 'Los porcentajes tienen que sumar menos de 100 (la última cuota es el resto)', path: ['cuotas'] });
    }
  });

const reemplazarPlanesSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
  body: z.object({
    planes: z.array(planPagoItemSchema).max(10),
  }),
});

module.exports = { planPagoItemSchema, reemplazarPlanesSchema };
