/**
 * Templates de mail en HTML. Cada función recibe los datos necesarios
 * y devuelve { subject, html } listo para pasarle a enviarMail().
 *
 * Diseño minimalista pero prolijo — funciona en todos los clientes de mail.
 */

function templateConfirmacionInscripcion({ participante, evento }) {
  const fechaInicio = new Date(evento.fecha_inicio).toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return {
    subject: `✅ Inscripción confirmada — ${evento.nombre}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
          ¡Tu inscripción fue confirmada!
        </h1>

        <p>Hola <strong>${participante.nombre} ${participante.apellido}</strong>,</p>
        <p>Tu inscripción al evento <strong>${evento.nombre}</strong> fue registrada exitosamente.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #374151;">Datos del evento</h2>
          <p style="margin: 4px 0;"><strong>Evento:</strong> ${evento.nombre}</p>
          <p style="margin: 4px 0;"><strong>Fecha:</strong> ${fechaInicio}</p>
          ${evento.descripcion ? `<p style="margin: 4px 0;"><strong>Descripción:</strong> ${evento.descripcion}</p>` : ''}
        </div>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #374151;">Tus datos</h2>
          <p style="margin: 4px 0;"><strong>Nombre:</strong> ${participante.nombre} ${participante.apellido}</p>
          <p style="margin: 4px 0;"><strong>DNI:</strong> ${participante.dni}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${participante.email}</p>
        </div>

        ${evento.costo > 0 ? `
        <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #854d0e;">💳 Información de pago</h2>
          <p style="margin: 4px 0;">El costo de inscripción es <strong>$${evento.costo}</strong>.</p>
          ${evento.cbu_cvu ? `<p style="margin: 4px 0;"><strong>CBU/CVU:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 4px;">${evento.cbu_cvu}</code></p>` : ''}
          ${evento.alias_cobro ? `<p style="margin: 4px 0;"><strong>Alias:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 4px;">${evento.alias_cobro}</code></p>` : ''}
          <p style="margin: 8px 0 0; font-size: 13px; color: #713f12;">Una vez realizado el pago, subí el comprobante desde el portal de inscripción.</p>
        </div>
        ` : ''}

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <h2 style="margin-top: 0; font-size: 16px; color: #166534;">🎫 Tu código QR personal</h2>
          <p style="color: #166534; font-size: 13px;">Presentá este código el día del evento para acreditarte.</p>
          <div style="background: #fff; display: inline-block; padding: 12px; border-radius: 8px; margin-top: 8px;">
            <img 
              src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${participante.qr_personal}" 
              alt="QR personal"
              width="180" height="180"
              style="display: block;"
            />
          </div>
          <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">
            Código: <strong>${participante.qr_personal}</strong>
          </p>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente. Si tenés alguna duda, contactá al organizador del evento.
        </p>

      </body>
      </html>
    `,
  };
}

function templateVinculoAceptado({ participante, grupo, evento }) {
  return {
    subject: `✅ Tu solicitud al grupo "${grupo.nombre}" fue aceptada`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">
          ¡Fuiste aceptado en el grupo!
        </h1>

        <p>Hola <strong>${participante.nombre} ${participante.apellido}</strong>,</p>
        <p>El responsable del grupo <strong>${grupo.nombre}</strong> aceptó tu solicitud de ingreso al evento <strong>${evento.nombre}</strong>.</p>

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Grupo:</strong> ${grupo.nombre}</p>
          ${grupo.parroquia ? `<p style="margin: 4px 0;"><strong>Parroquia:</strong> ${grupo.parroquia}</p>` : ''}
          ${grupo.localidad ? `<p style="margin: 4px 0;"><strong>Localidad:</strong> ${grupo.localidad}</p>` : ''}
        </div>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente.
        </p>

      </body>
      </html>
    `,
  };
}

function templateVinculoRechazado({ participante, grupo, evento }) {
  return {
    subject: `❌ Tu solicitud al grupo "${grupo.nombre}" fue rechazada`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
          Tu solicitud no fue aceptada
        </h1>

        <p>Hola <strong>${participante.nombre} ${participante.apellido}</strong>,</p>
        <p>El responsable del grupo <strong>${grupo.nombre}</strong> no aceptó tu solicitud de ingreso al evento <strong>${evento.nombre}</strong>.</p>
        <p>Podés intentar unirte a otro grupo o participar de forma individual.</p>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente.
        </p>

      </body>
      </html>
    `,
  };
}

function templateSolicitudPendiente({ responsable, participante, grupo }) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return {
    subject: `📋 Nueva solicitud de ingreso al grupo "${grupo.nombre}"`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
          Nueva solicitud de ingreso
        </h1>

        <p>Hola <strong>${responsable.nombre} ${responsable.apellido}</strong>,</p>
        <p><strong>${participante.nombre} ${participante.apellido}</strong> quiere unirse a tu grupo <strong>${grupo.nombre}</strong>.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Nombre:</strong> ${participante.nombre} ${participante.apellido}</p>
          <p style="margin: 4px 0;"><strong>DNI:</strong> ${participante.dni}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${participante.email}</p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${frontendUrl}/grupos/${grupo.id}/solicitudes" 
             style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Ver solicitudes del grupo
          </a>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente.
        </p>

      </body>
      </html>
    `,
  };
}

module.exports = {
  templateConfirmacionInscripcion,
  templateVinculoAceptado,
  templateVinculoRechazado,
  templateSolicitudPendiente,
};