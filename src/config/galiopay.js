const GALIOPAY_BASE_URL = 'https://pay.galio.app/api';

/**
 * Crea un payment link en GalioPay.
 * Devuelve { url, proofToken, referenceId }
 */
async function crearPaymentLink({ monto, referenceId, descripcion, sandbox = false }) {
  const response = await fetch(`${GALIOPAY_BASE_URL}/payment-links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GALIOPAY_API_KEY}`,
      'x-client-id': process.env.GALIOPAY_CLIENT_ID,
    },
    body: JSON.stringify({
      items: [{ title: descripcion, quantity: 1, unitPrice: monto, currencyId: 'ARS' }],
      referenceId,
      notificationUrl: `${process.env.BACKEND_URL}/api/v1/pagos/webhook/galiopay`,
      sandbox,
      backUrl: {
        success: `${process.env.FRONTEND_URL}/pago-exitoso`,
        failure: `${process.env.FRONTEND_URL}/pago-fallido`,
      },
    }),
  });

  // Log del status y respuesta cruda
  const texto = await response.text();
  console.log('[galiopay] status:', response.status);
  console.log('[galiopay] respuesta cruda:', texto);

  if (!response.ok) {
    throw new Error(`GalioPay error ${response.status}: ${texto}`);
  }

  return JSON.parse(texto);
}

/**
 * Reembolsa un pago en GalioPay.
 * Se usa cuando el admin paga un link que ya fue cancelado y reemplazado.
 */
async function reembolsarPago(galioPaymentId, reason = 'Link de pago reemplazado por uno consolidado') {
  const response = await fetch(`${GALIOPAY_BASE_URL}/payments/${galioPaymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GALIOPAY_API_KEY}`,
      'x-client-id': process.env.GALIOPAY_CLIENT_ID,
    },
    body: JSON.stringify({
      reason,
      refundType: 'total',
    }),
  });

  const texto = await response.text();
  console.log('[galiopay] reembolso status:', response.status);
  console.log('[galiopay] reembolso respuesta:', texto);

  if (!response.ok) {
    throw new Error(`GalioPay reembolso error ${response.status}: ${texto}`);
  }

  return JSON.parse(texto);
}

module.exports = { crearPaymentLink, reembolsarPago };