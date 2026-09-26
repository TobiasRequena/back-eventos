require('dotenv').config();
const { enviarMail } = require('../../../utils/mail');
const escapeHtml = require('../../../utils/escapeHtml');

async function contacto(req, res, next) {
  try {
    // Lo escribe cualquiera desde la landing: se escapa antes de meterlo en el HTML del mail
    const [nombre, email, asunto, mensaje] = [req.body.nombre, req.body.email, req.body.asunto, req.body.mensaje].map(escapeHtml);

    await enviarMail({
      to: process.env.SUPERADMIN_EMAIL,
      from: `Talita Encuentro <soporte@notificaciones.talitaencuentro.com>`,
      subject: `[Soporte Talita] ${req.body.asunto}`,
      html: `
        <h2>Nueva consulta de soporte</h2>
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Asunto:</strong> ${asunto}</p>
        <hr/>
        <p><strong>Mensaje:</strong></p>
        <p>${mensaje.replace(/\n/g, '<br>')}</p>
      `,
      replyTo: req.body.email,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

module.exports = { contacto };