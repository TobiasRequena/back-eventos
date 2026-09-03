require('dotenv').config();
const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM1) {
  throw new Error('[mail] Faltan variables de entorno RESEND_API_KEY o MAIL_FROM1');
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Función base para enviar mails via Resend.
 * Todos los mails de la plataforma pasan por acá.
 */
async function enviarMail({ to, subject, html, from, attachments = [] }) {
  if (!to || !subject || !html) {
    console.error('[mail] Parámetros incompletos:', { to, subject });
    return { ok: false, error: 'Parámetros incompletos' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from || `Talita Encuentro <${process.env.MAIL_FROM1}>`,
      to,
      subject,
      html,
      attachments,
    });

    if (error) {
      console.error('[mail] Error al enviar a', to, ':', error);
      return { ok: false, error };
    }

    console.log('[mail] Enviado OK a', to, '- id:', data?.id);
    return { ok: true, data };
  } catch (err) {
    console.error('[mail] Excepción al enviar a', to, ':', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { enviarMail };

// ─────────────────────────────────────────────────────────
// ALTERNATIVA: Amazon SES (nodemailer + SESv2)
// Requiere dominio verificado en SES y salir del sandbox.
// Env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MAIL_FROM
// ─────────────────────────────────────────────────────────
// const nodemailer = require('nodemailer');
// const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');

// if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.MAIL_FROM) {
//   throw new Error('[mail] Faltan variables de entorno de SES (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MAIL_FROM)');
// }

// const ses = new SESv2Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// const transporter = nodemailer.createTransport({
//   SES: { sesClient: ses, SendEmailCommand },
// });

// async function enviarMail({ to, subject, html, attachments = [] }) {
//   if (!to || !subject || !html) {
//     console.error('[mail] Parámetros incompletos:', { to, subject });
//     return { ok: false, error: 'Parámetros incompletos' };
//   }

//   try {
//     const info = await transporter.sendMail({
//       from: `"Talita Encuentro" <${process.env.MAIL_FROM}>`,
//       to,
//       subject,
//       html,
//       attachments,
//     });

//     console.log('[mail] Enviado OK a', to, '- id:', info.messageId);
//     return { ok: true, data: info };
//   } catch (err) {
//     console.error('[mail] Error al enviar a', to, ':', err.message);
//     return { ok: false, error: err.message };
//   }
// }

// module.exports = { enviarMail };

// ─────────────────────────────────────────────────────────
// ALTERNATIVA: SMTP genérico (Gmail u otro)
// Env vars: MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM
// ─────────────────────────────────────────────────────────
// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   host: process.env.MAIL_HOST,
//   port: Number(process.env.MAIL_PORT),
//   secure: false,
//   auth: {
//     user: process.env.MAIL_USER,
//     pass: process.env.MAIL_PASS,
//   },
// });

// /**
//  * Función base para enviar mails via SMTP.
//  * Misma interfaz que antes — el resto del código no cambia nada.
//  */
// async function enviarMail({ to, subject, html, attachments = [] }) {
//   try {
//     const info = await transporter.sendMail({
//       from: `"Talita Encuentro" <${process.env.MAIL_FROM}>`,
//       to,
//       subject,
//       html,
//       attachments,
//     });

//     console.log('[mail] Enviado OK:', info.messageId);
//     return { ok: true, data: info };
//   } catch (err) {
//     console.error('[mail] Error al enviar:', err.message);
//     return { ok: false, error: err };
//   }
// }

// module.exports = { enviarMail };