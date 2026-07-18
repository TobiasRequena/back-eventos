// const { Resend } = require('resend');

// const resend = new Resend(process.env.RESEND_API_KEY);

// /**
//  * Función base para enviar mails via Resend.
//  * Todos los mails de la plataforma pasan por acá.
//  */
// async function enviarMail({ to, subject, html }) {
//   try {
//     const { data, error } = await resend.emails.send({
//       from: process.env.MAIL_FROM,
//       to,
//       subject,
//       html,
//     });

//     if (error) {
//       console.error('[mail] Error al enviar:', error);
//       return { ok: false, error };
//     }

//     console.log('[mail] Enviado OK:', data?.id);
//     return { ok: true, data };
//   } catch (err) {
//     console.error('[mail] Excepción al enviar:', err.message);
//     return { ok: false, error: err };
//   }
// }

// module.exports = { enviarMail };

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

/**
 * Función base para enviar mails via SMTP.
 * Misma interfaz que antes — el resto del código no cambia nada.
 */
async function enviarMail({ to, subject, html, attachments = [] }) {
  try {
    const info = await transporter.sendMail({
      from: `"Talita Encuentro" <${process.env.MAIL_FROM}>`,
      to,
      subject,
      html,
      attachments,
    });

    console.log('[mail] Enviado OK:', info.messageId);
    return { ok: true, data: info };
  } catch (err) {
    console.error('[mail] Error al enviar:', err.message);
    return { ok: false, error: err };
  }
}

module.exports = { enviarMail };