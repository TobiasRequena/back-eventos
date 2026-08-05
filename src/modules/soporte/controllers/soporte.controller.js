require('dotenv').config();
const { enviarMail } = require('../../../utils/mail');

async function contacto(req, res, next) {
  try {
    const { nombre, email, asunto, mensaje } = req.body;

    await enviarMail({
      to: process.env.SUPERADMIN_EMAIL,
      subject: `[Soporte] ${asunto}`,
      html: `
        <h2>Nueva consulta de soporte</h2>
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Asunto:</strong> ${asunto}</p>
        <hr/>
        <p><strong>Mensaje:</strong></p>
        <p>${mensaje.replace(/\n/g, '<br>')}</p>
      `,
      replyTo: email,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

module.exports = { contacto };