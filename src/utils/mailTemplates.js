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
          <p style="margin: 0; color: #854d0e;">⚠️ Tu inscripción tiene un pago pendiente. El organizador del evento te va a contactar con los detalles.</p>
        </div>
        ` : ''}

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <h2 style="margin-top: 0; font-size: 16px; color: #166534;">🎫 Tu credencial de acceso</h2>
          <p style="color: #166534; font-size: 13px;">
            Encontrás tu credencial adjunta a este mail. Guardala y presentala el día del evento para acreditarte.
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

function templateInfoGrupoResponsable({ responsable, grupo, evento }) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const fechaInicio = new Date(evento.fecha_inicio).toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return {
    subject: `👥 Información de tu grupo — ${evento.nombre}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
          ¡Tu grupo fue creado exitosamente!
        </h1>

        <p>Hola <strong>${responsable.nombre} ${responsable.apellido}</strong>,</p>
        <p>Sos el referente del grupo <strong>${grupo.nombre}</strong> para el evento <strong>${evento.nombre}</strong>.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #374151;">Datos del evento</h2>
          <p style="margin: 4px 0;"><strong>Evento:</strong> ${evento.nombre}</p>
          <p style="margin: 4px 0;"><strong>Fecha:</strong> ${fechaInicio}</p>
        </div>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #374151;">Datos de tu grupo</h2>
          <p style="margin: 4px 0;"><strong>Nombre:</strong> ${grupo.nombre}</p>
          ${grupo.parroquia ? `<p style="margin: 4px 0;"><strong>Parroquia:</strong> ${grupo.parroquia}</p>` : ''}
          ${grupo.localidad ? `<p style="margin: 4px 0;"><strong>Localidad:</strong> ${grupo.localidad}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Máximo de integrantes:</strong> ${grupo.max_integrantes}</p>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #1e40af;">🔗 Código de invitación</h2>
          <p style="font-size: 13px; color: #1e40af;">Compartí este código con los integrantes de tu grupo para que puedan inscribirse:</p>
          <div style="background: #fff; border-radius: 6px; padding: 12px; text-align: center; margin: 10px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e40af;">${grupo.codigo_inv}</span>
          </div>
          <p style="font-size: 12px; color: #6b7280; margin: 8px 0 0; text-align: center;">
            O compartí este link directo:
            <a href="${grupo.qr_inv}" style="color: #2563eb;">${grupo.qr_inv}</a>
          </p>
          <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0; text-align: center;">
            El QR de invitación está adjunto a este mail.
          </p>
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
  templateInfoGrupoResponsable,
};