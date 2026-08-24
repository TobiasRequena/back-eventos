/**
 * Templates de mail en HTML. Cada función recibe los datos necesarios
 * y devuelve { subject, html } listo para pasarle a enviarMail().
 *
 * Diseño minimalista pero prolijo — funciona en todos los clientes de mail.
 */

function templateConfirmacionInscripcion({ participante, evento, grupo = null }) {
  const fechaInicio = new Date(evento.fecha_inicio).toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const esPendienteAprobacion = participante.estado_vinculo === 'pendiente';

  return {
    subject: `✅ Inscripción confirmada — ${evento.nombre}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 10px;">
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

        ${grupo ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #1E3A5F;">👥 Tu grupo</h2>
          <p style="margin: 4px 0;"><strong>Nombre:</strong> ${grupo.nombre}</p>
          ${grupo.parroquia ? `<p style="margin: 4px 0;"><strong>Parroquia:</strong> ${grupo.parroquia}</p>` : ''}
          ${grupo.localidad ? `<p style="margin: 4px 0;"><strong>Localidad:</strong> ${grupo.localidad}</p>` : ''}
          ${esPendienteAprobacion ? `
          <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 6px; padding: 12px; margin-top: 12px;">
            <p style="margin: 0; color: #854d0e; font-size: 13px;">
              ⏳ Tu solicitud de ingreso al grupo está <strong>pendiente de aprobación</strong> por el referente.
              Ya estás inscripto en el evento, pero tu participación en el grupo debe ser confirmada.
            </p>
          </div>
          ` : ''}
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
    subject: `Tu solicitud al grupo "${grupo.nombre}" fue aceptada`,
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
    subject: `Tu solicitud al grupo "${grupo.nombre}" fue rechazada`,
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
    subject: `Nueva solicitud de ingreso al grupo "${grupo.nombre}"`,
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
  const linkPanel = `${frontendUrl}/panel-grupo/${grupo.codigo_inv}`;
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
        
        <h1 style="color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 10px;">
          ¡Tu inscripción fue confirmada!
        </h1>
        <p>Hola <strong>${responsable.nombre} ${responsable.apellido}</strong>,</p>
        <p>Tu inscripción al evento <strong>${evento.nombre}</strong> fue registrada y tu grupo fue creado exitosamente.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #374151;">Datos del evento</h2>
          <p style="margin: 4px 0;"><strong>Evento:</strong> ${evento.nombre}</p>
          <p style="margin: 4px 0;"><strong>Fecha:</strong> ${fechaInicio}</p>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <h2 style="margin-top: 0; font-size: 16px; color: #166534;">🎫 Tu credencial de acceso</h2>
          <p style="color: #166534; font-size: 13px;">
            Encontrás tu credencial adjunta a este mail. Guardala y presentala el día del evento para acreditarte.
          </p>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #1E3A5F;">👥 Tu grupo</h2>
          <p style="margin: 4px 0;"><strong>Nombre:</strong> ${grupo.nombre}</p>
          ${grupo.parroquia ? `<p style="margin: 4px 0;"><strong>Parroquia:</strong> ${grupo.parroquia}</p>` : ''}
          ${grupo.localidad ? `<p style="margin: 4px 0;"><strong>Localidad:</strong> ${grupo.localidad}</p>` : ''}
          ${grupo.max_integrantes ? `<p style="margin: 4px 0;"><strong>Máximo de integrantes:</strong> ${grupo.max_integrantes}</p>` : ''}
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #1E3A5F;">🔗 Código de invitación</h2>
          <p style="font-size: 13px; color: #374151;">
            Compartí este código o el QR adjunto con las personas que quieran unirse a tu grupo. 
            Pueden ingresar el código manualmente al inscribirse, escanear el QR, o usar el link directo — 
            los tres hacen exactamente lo mismo.
          </p>
          <div style="background: #fff; border-radius: 6px; padding: 12px; text-align: center; margin: 10px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1E3A5F;">${grupo.codigo_inv}</span>
          </div>
          <p style="font-size: 12px; color: #6b7280; margin: 8px 0 0; text-align: center;">
            Link directo:
            <a href="${grupo.qr_inv}" style="color: #1E3A5F;">${grupo.qr_inv}</a>
          </p>
          <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0; text-align: center;">
            El QR de invitación está adjunto a este mail.
          </p>
        </div>

        <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 16px; color: #854d0e;">IMPORTANTE: Revisá tu panel de referente</h2>
          <p style="font-size: 13px; color: #854d0e; margin: 0;">
            Cuando alguien se una a tu grupo, es fundamental que ingreses al panel para <strong>aceptar o rechazar</strong> a cada integrante. 
            Recordá que aunque estén inscriptos en el evento, su participación en tu grupo depende de tu aprobación.
          </p>
          <div style="text-align: center; margin-top: 12px;">
            <a href="${linkPanel}"
              style="background: #1E3A5F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Ir al panel de referente
            </a>
          </div>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente por Talita Encuentros.
        </p>
      </body>
      </html>
    `,
  };
}

function templatePagoPlataformaPendiente({ emailAdmin, evento, monto, linkPago, cantidadParticipantes }) {
  return {
    subject: `Pago pendiente — ${evento.nombre}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
          Pago pendiente de plataforma
        </h1>

        <p>El evento <strong>${evento.nombre}</strong> cruzó un nuevo tramo de inscriptos.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Evento:</strong> ${evento.nombre}</p>
          <p style="margin: 4px 0;"><strong>Inscriptos actuales:</strong> ${cantidadParticipantes}</p>
          <p style="margin: 4px 0;"><strong>Monto a pagar:</strong> $${monto.toLocaleString('es-AR')}</p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${linkPago}" 
             style="background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px;">
            Pagar ahora
          </a>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente por Talita Encuentros.
          Si ya realizaste el pago, ignorá este mensaje.
        </p>

      </body>
      </html>
    `,
  };
}

function templateAsignacionGrupo({ participante, grupo, evento }) {
  return {
    subject: `Tu grupo de trabajo — ${evento.nombre}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 10px;">
          Grupo de trabajo
        </h1>

        <p>Hola <strong>${participante.nombre} ${participante.apellido}</strong>,</p>
        <p>Te informamos que fuiste asignado a un grupo de trabajo para el evento <strong>${evento.nombre}</strong>.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <p style="margin: 16px 0 4px 0; font-size: 13px; color: #6b7280;">Tu grupo</p>
          <p style="margin: 0; font-size: 28px; font-weight: bold; color: #1E3A5F;">${grupo.nombre}</p>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente por Talita Encuentros.
        </p>

      </body>
      </html>
    `,
  };
}

function templateRecuperarContrasena({ nombre, codigo }) {
  return {
    subject: 'Código de recuperación — Talita Encuentros',
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 10px;">
          Recuperar contraseña
        </h1>

        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Tu código de recuperación es:</p>

        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #1E3A5F;">
            ${codigo}
          </span>
        </div>

        <p style="color: #6b7280; font-size: 13px;">
          Este código expira en <strong>15 minutos</strong>. Si no solicitaste este cambio, ignorá este mail.
        </p>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente por Talita Encuentros.
        </p>

      </body>
      </html>
    `,
  };
}

function templatePagoRechazado({ participante, evento }) {
  return {
    subject: `Pago rechazado — ${evento.nombre}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        
        <h1 style="color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 10px;">
          Pago rechazado
        </h1>
        <p>Hola <strong>${participante.nombre} ${participante.apellido}</strong>,</p>
        <p>Lamentablemente el comprobante de pago que enviaste para el evento <strong>${evento.nombre}</strong> fue rechazado por el organizador.</p>
        <p>Por favor contactate con el organizador para regularizar tu situación.</p>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mail fue generado automáticamente por Talita Encuentros.
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
  templatePagoPlataformaPendiente,
  templateAsignacionGrupo,
  templateRecuperarContrasena,
  templatePagoRechazado
};