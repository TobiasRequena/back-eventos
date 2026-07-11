const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Función base para enviar mails via Resend.
 * Todos los mails de la plataforma pasan por acá.
 */
async function enviarMail({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[mail] Error al enviar:', error);
      return { ok: false, error };
    }

    console.log('[mail] Enviado OK:', data?.id);
    return { ok: true, data };
  } catch (err) {
    console.error('[mail] Excepción al enviar:', err.message);
    return { ok: false, error: err };
  }
}

module.exports = { enviarMail };