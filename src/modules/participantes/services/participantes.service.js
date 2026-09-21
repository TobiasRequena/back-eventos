const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const { db } = require('../../../config/db');
const s3Client = require('../../../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { construirUrlPublica } = require('../../../utils/storage');
const participantesRepository = require('../repositories/participantes.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const formulariosRepository = require('../../formularios/repositories/formularios.repository');
const talleresRepository = require('../../talleres/repositories/talleres.repository');
const gruposRepository = require('../../grupos/repositories/grupos.repository');
const zonasCostoRepository = require('../../zonasCosto/repositories/zonasCosto.repository');

const { enviarMail } = require('../../../utils/mail');
const {
  templateConfirmacionInscripcion,
  templateSolicitudPendiente,
  templateVinculoAceptado,
  templateVinculoRechazado,
} = require('../../../utils/mailTemplates');
const { generarCredencial } = require('../../../utils/generarCredencial');

const { encriptar, desencriptar, hashDni } = require('../../../utils/encryption');
const { eventoEstaCerrado } = require('../../eventos/services/eventos.service');
const { verificarYGenerarCargo, verificarCapacidadInscripcion } = require('../../pagos/services/pagos.service');
const { getOrSet, invalidar } = require('../../../utils/cache');
const fichaMedicaRepository = require('../../fichaMedica/repositories/fichaMedica.repository');
const contactoEmergenciaRepository = require('../../contactoEmergencia/repositories/contactoEmergencia.repository');
const calcularEdad = require('../../../utils/calcularEdad');
const sanitizarParticipante = require('../../../utils/sanitizarParticipante');

/**
 * Calcula si una persona es mayor de edad al momento de la inscripción.
 * "Mayor" = 18 años cumplidos o más al día de hoy.
 */
function calcularEsMayor(nacimiento) {
  const hoy = new Date();
  const fechaNac = new Date(nacimiento);

  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNac = fechaNac.getMonth();

  // Ajuste: si todavía no cumplió años este año, restar 1
  if (mesActual < mesNac || (mesActual === mesNac && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }

  return edad >= 18;
}

async function buscarEventoCacheado(id) {
  return getOrSet(`evento:${id}`, 'detalle', () => eventosRepository.buscarPorId(id));
}


/**
 * Valida que las respuestas al formulario dinámico del evento sean correctas:
 * - Todos los campos requeridos tienen respuesta.
 * - Los campos de tipo 'seleccion' tienen un valor dentro de las opciones válidas.
 * - Los campos de tipo 'booleano' tienen un valor boolean.
 * - Los campos de tipo 'numero' tienen un valor numérico.
 *
 * Recibe los campos del evento (array de campo_form) y el objeto de respuestas
 * { [campo_form_id]: valor } que mandó el front.
 */
function validarRespuestasForm(campos, respuestas = {}) {
  const errores = [];

  for (const campo of campos) {
    const valor = respuestas[campo.id];
    const tieneValor = valor !== undefined && valor !== null && valor !== '';

    // Validar campo requerido
    if (campo.requerido && !tieneValor) {
      errores.push(`El campo "${campo.etiqueta}" es obligatorio`);
      continue; // no seguimos validando el tipo si no hay valor
    }

    // Si no tiene valor y no es requerido, lo saltamos
    if (!tieneValor) continue;

    // Validar tipo
    switch (campo.tipo) {
      case 'numero':
        if (isNaN(Number(valor))) {
          errores.push(`El campo "${campo.etiqueta}" debe ser un número`);
        }
        break;
      case 'booleano':
        if (typeof valor !== 'boolean') {
          errores.push(`El campo "${campo.etiqueta}" debe ser verdadero o falso`);
        }
        break;
      case 'seleccion':
        const opciones = campo.opciones || [];
        if (!opciones.includes(valor)) {
          errores.push(`El campo "${campo.etiqueta}" debe ser uno de: ${opciones.join(', ')}`);
        }
        break;
      case 'fecha':
        if (isNaN(Date.parse(valor))) {
          errores.push(`El campo "${campo.etiqueta}" debe ser una fecha válida`);
        }
        break;
      // 'texto': cualquier string es válido, no hace falta validar
    }
  }

  if (errores.length > 0) {
    const error = new Error(errores.join(' | '));
    error.status = 400;
    throw error;
  }
}

// Verificar si ficha médica es requerida
function fichaMedicaRequerida(configFichaMedica, esMenor) {
  if (configFichaMedica === 'no') return false;
  if (configFichaMedica === 'obligatorio_todos') return true;
  if (configFichaMedica === 'obligatorio_menores' && esMenor) return true;
  if (configFichaMedica === 'obligatorio_mayores' && !esMenor) return true;
  return false;
}

// El contacto de emergencia, cuando el evento lo solicita, es obligatorio
// solo para menores — para mayores queda a criterio del participante.
function contactoEmergenciaRequerido(solicitaContactoEmergencia, esMenor) {
  return Boolean(solicitaContactoEmergencia) && esMenor;
}

/**
 * Crea un participante nuevo en un evento.
 *
 * Reglas de negocio:
 * 1. El evento debe existir y pertenecer a la organización.
 * 2. No puede haber dos participantes con el mismo DNI en el mismo evento.
 * 3. es_mayor se calcula a partir de nacimiento al momento de la inscripción.
 * 4. Las respuestas al formulario se validan contra los campos definidos en campo_form.
 * 5. qr_personal se genera automáticamente (UUID v4).
 * 6. Si el evento tiene costo, el estado_pago arranca en 'pendiente';
 *    si no tiene costo, arranca en 'no_aplica'.
 */
async function crearParticipante(orgId, datos) {
  const resultado = await db.transaction(async (trx) => {
    // 1. Verificar que el evento existe
    const evento = await buscarEventoCacheado(datos.eventoId, trx);
    if (!evento) {
      const error = new Error('Evento no encontrado');
      error.status = 404;
      throw error;
    }

    // Verificar que el evento no esté cerrado
    if (eventoEstaCerrado(evento)) {
      const error = new Error('Las inscripciones para este evento están cerradas');
      error.status = 409;
      throw error;
    }

    // Verificar cupo máximo
    if (evento.cupo_maximo !== null && evento.cupo_maximo !== undefined) {
      const cantidadActual = await participantesRepository.contarPorEvento(evento.id);
      if (cantidadActual >= evento.cupo_maximo) {
        const error = new Error(`El evento está completo. Cupo máximo de ${evento.cupo_maximo} ${evento.cupo_maximo === 1 ? 'inscripto' : 'inscriptos'} alcanzado.`);
        error.status = 409;
        throw error;
      }
    }

    // Límite del tramo pagado de la plataforma
    await verificarCapacidadInscripcion(evento.id, trx);

    const esMenor = calcularEdad(datos.nacimiento) < 18;
    if (fichaMedicaRequerida(evento.config_ficha_medica, esMenor) && !datos.fichaMedica) {
      const error = new Error('La ficha médica es obligatoria para inscribirse en este evento');
      error.status = 400; throw error;
    }
    if (contactoEmergenciaRequerido(evento.solicita_contacto_emergencia, esMenor) && !datos.contactoEmergencia) {
      const error = new Error('El contacto de emergencia es obligatorio para menores en este evento');
      error.status = 400; throw error;
    }

    // Si no viene orgId (inscripción pública sin X-Org-Id), lo tomamos del evento
    const orgIdFinal = orgId ?? evento.org_id;

    // 2. Verificar DNI único en el evento
    const duplicado = await participantesRepository.buscarPorDniEnEvento(
      datos.dni,
      datos.eventoId,
      trx
    );
    if (duplicado) {
      const error = new Error('Ya existe un participante con ese DNI en este evento');
      error.status = 409;
      throw error;
    }

    // 3. Verificar email único en el evento
    const duplicadoEmail = await participantesRepository.buscarPorEmailEnEvento(
      datos.email,
      datos.eventoId,
      trx
    );
    if (duplicadoEmail) {
      const error = new Error('Ya existe un participante con ese email en este evento');
      error.status = 409;
      throw error;
    }

    // 4. Calcular mayoría de edad
    const esMayor = calcularEsMayor(datos.nacimiento);

    // 5. Validar respuestas del formulario
    const campos = await formulariosRepository.listarPorEvento(datos.eventoId);
    if (campos && campos.length > 0) {
      validarRespuestasForm(campos, datos.respuestasForm ?? {});
    }

    // 6. Resolver el costo a cobrar (por zona si el evento lo usa, RN de zona_costo)
    // y determinar el estado de pago inicial. No se guarda un snapshot del monto
    // en participante — se resuelve al vuelo, igual que evento.costo hasta ahora.
    let costoAPagar = evento.costo;
    let zonaCostoId = null;
    if (evento.tiene_precio_por_zona) {
      if (!datos.zonaCostoId) {
        const error = new Error('Debés seleccionar una zona de costo para inscribirte');
        error.status = 400;
        throw error;
      }
      const zonaCosto = await zonasCostoRepository.buscarPorId(datos.zonaCostoId, trx);
      if (!zonaCosto || zonaCosto.evento_id !== datos.eventoId) {
        const error = new Error('La zona de costo seleccionada no es válida para este evento');
        error.status = 400;
        throw error;
      }
      costoAPagar = zonaCosto.costo;
      zonaCostoId = zonaCosto.id;
    }
    const estadoPago = costoAPagar > 0 ? datos.estadoPago : 'no_aplica';

    // 7. Determinar estado_vinculo según rol
    let estadoVinculo = null;
    if (datos.rolGrupo === 'autoinscripto') {
      estadoVinculo = 'pendiente';
    }

    // 8. Generar QR personal único
    const qrPersonal = uuidv4();

    const dniEncriptado = encriptar(datos.dni);
    const dniHash = hashDni(datos.dni);

    const participante = await participantesRepository.crear(
      {
        orgId: orgIdFinal,
        eventoId: datos.eventoId,
        grupoId: datos.grupoId,
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        dniEncriptado,
        dniHash,
        nacimiento: datos.nacimiento,
        esMayor,
        rolGrupo: datos.rolGrupo,
        estadoVinculo,
        responsableId: datos.responsableId,
        respuestasForm: datos.respuestasForm ?? {},
        estadoPago,
        zonaCostoId,
        qrPersonal,
      },
      trx
    );

    if (datos.fichaMedica) {
      console.log('[ficha] creando ficha para participante:', participante.id);
      try {
        await fichaMedicaRepository.crear({
          org_id: orgIdFinal,
          evento_id: datos.eventoId,
          participante_id: participante.id,
          obra_social: datos.fichaMedica.obra_social || null,
          tipo_sangre: datos.fichaMedica.tipo_sangre || null,
          tiene_diabetes: datos.fichaMedica.tiene_diabetes ?? false,
          tiene_asma: datos.fichaMedica.tiene_asma ?? false,
          tiene_epilepsia: datos.fichaMedica.tiene_epilepsia ?? false,
          tiene_cardiopatia: datos.fichaMedica.tiene_cardiopatia ?? false,
          // "" (campo vacío) tiene que guardarse como NULL — las stats y el listado
          // de fichas relevantes filtran con IS NOT NULL, y un "" ahí cuenta como
          // que el participante SÍ tiene la condición/dato cargado.
          otras_condiciones: datos.fichaMedica.otras_condiciones || null,
          alergias: datos.fichaMedica.alergias || null,
          restricciones_alimentarias: datos.fichaMedica.restricciones_alimentarias || null,
          medicacion: datos.fichaMedica.medicacion ? JSON.stringify(datos.fichaMedica.medicacion) : null,
          tiene_discapacidad: datos.fichaMedica.tiene_discapacidad ?? false,
          adaptaciones: datos.fichaMedica.tiene_discapacidad && datos.fichaMedica.adaptaciones
            ? JSON.stringify(datos.fichaMedica.adaptaciones)
            : null,
          recomendaciones: datos.fichaMedica.recomendaciones || null,
        }, trx);
        console.log('[ficha] creada OK');
      } catch (err) {
        console.error('[ficha] error al crear:', err.message);
        throw err;
      }
    }

    if (datos.contactoEmergencia) {
      await contactoEmergenciaRepository.crear({
        org_id: orgIdFinal,
        evento_id: datos.eventoId,
        participante_id: participante.id,
        nombre: datos.contactoEmergencia.nombre,
        telefono: datos.contactoEmergencia.telefono,
        parentesco: datos.contactoEmergencia.parentesco || null,
      }, trx);
    }

    // 9. Inscribir a los talleres elegidos (si vinieron)
    if (datos.tallerIds && datos.tallerIds.length > 0) {
      for (const tallerId of datos.tallerIds) {
        // Verificar que el taller existe y pertenece al mismo evento
        const taller = await talleresRepository.buscarPorId(tallerId, trx);
        if (!taller) {
          const error = new Error(`Taller ${tallerId} no encontrado`);
          error.status = 404;
          throw error;
        }
        if (taller.evento_id !== datos.eventoId) {
          const error = new Error(`El taller ${tallerId} no pertenece a este evento`);
          error.status = 400;
          throw error;
        }

        // Verificar cupo
        if (taller.capacidad !== null) {
          const inscriptos = await talleresRepository.contarInscriptos(tallerId, trx);
          if (inscriptos >= taller.capacidad) {
            const error = new Error(`El taller "${taller.nombre}" ya alcanzó su capacidad máxima`);
            error.status = 409;
            throw error;
          }
        }

        // Verificar cantidad_elegible del bloque (solo si el taller tiene bloque)
        if (taller.bloque_taller_id) {
          const bloque = await talleresRepository.buscarBloquePorId(taller.bloque_taller_id, trx);
          const yaElegidos = await talleresRepository.contarInscripcionesDelParticipanteEnBloque(
            participante.id,
            bloque.id,
            trx
          );
          if (yaElegidos >= bloque.cantidad_elegible) {
            const error = new Error(
              `Ya elegiste el máximo de talleres permitidos para el bloque "${bloque.nombre}" (${bloque.cantidad_elegible})`
            );
            error.status = 409; throw error;
          }
        }

        await talleresRepository.asignarParticipante(
          { participanteId: participante.id, tallerId, orgId: orgIdFinal },
          trx
        );
      }
    }

    // 10. Generar credencial y enviar mail
    const datosParaMail = {
      email: participante.email,
      nombre: participante.nombre,
      apellido: participante.apellido,
      qrPersonal: participante.qr_personal,
      dni: datos.dni,
    };

    // fire and forget — después de que la transacción commitea
    setTimeout(async () => {
      try {
        if (datos.rolGrupo === 'responsable') return;

        const participanteActualizado = await participantesRepository.buscarPorId(participante.id);

        if (costoAPagar == 0 || costoAPagar === null) {
          const credencialBuffer = await generarCredencial({
            qrPersonal: datosParaMail.qrPersonal,
            nombreEvento: evento.nombre,
            nombreParticipante: `${datosParaMail.nombre} ${datosParaMail.apellido}`,
            dni: datosParaMail.dni,
            esReferente: participante.rol_grupo === 'responsable'
          });
          // Buscar el grupo si el participante pertenece a uno
          let grupo = null;
          if (participanteActualizado.grupo_id) {
            grupo = await gruposRepository.buscarPorId(participanteActualizado.grupo_id);
          }

          const { subject, html } = templateConfirmacionInscripcion({
            participante: { ...participanteActualizado, dni: datosParaMail.dni },
            evento,
            grupo,
          });
          enviarMail({
            to: datosParaMail.email,
            subject,
            html,
            attachments: [{
              filename: `credencial_${datosParaMail.dni}.png`,
              content: credencialBuffer,
              contentType: 'image/png',
            }],
          });
        }
      } catch (err) {
        console.error('[mail] Error al enviar mail de inscripción:', err.message);
      }
    }, 3000);

    return sanitizarParticipante({
      ...participante,
      tiene_ficha_medica: !!datos.fichaMedica,
    }, 'admin');
  });

  invalidar(`evento:${datos.eventoId}`);

  // fire and forget FUERA de la transacción
  setImmediate(() => {
    verificarYGenerarCargo(datos.eventoId).catch((err) => {
      console.error('[pagos] Error al verificar cargo:', err.message);
    });
  });

  return resultado;
}

/**
 * Lista los participantes de un evento con filtros opcionales.
 * También verifica pertenencia del evento a la organización.
 */
async function listarParticipantes(eventoId, orgId, filtros = {}) {
  // Validar primero (sin caché — es una check de seguridad)
  const evento = await buscarEventoCacheado(eventoId);
  if (!evento) {
    const error = new Error('Evento no encontrado'); error.status = 404; throw error;
  }
  if (evento.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este evento'); error.status = 403; throw error;
  }

  // Si hay filtros reales (con valor) → no cachear (resultado varía).
  // filtros puede venir con keys en undefined (ej. destructuring de req.query
  // sin que el query param exista), así que no alcanza con mirar Object.keys.
  const hayFiltros = Object.values(filtros).some((v) => v !== undefined);
  if (hayFiltros) {
    const participantes = await participantesRepository.listarPorEvento(eventoId, filtros);
    return participantes.map((p) => sanitizarParticipante(p, 'admin'));
  }

  // Sin filtros → cachear
  return getOrSet(`evento:${eventoId}`, 'participantes', async () => {
    const participantes = await participantesRepository.listarPorEvento(eventoId, filtros);
    return participantes.map((p) => sanitizarParticipante(p, 'admin'));
  });
}

/**
 * Obtiene un participante por id, verificando pertenencia a la organización.
 */
async function obtenerParticipante(id, orgId) {
  const participante = await participantesRepository.buscarPorId(id);

  if (!participante) {
    const error = new Error('Participante no encontrado');
    error.status = 404;
    throw error;
  }

  if (participante.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este participante');
    error.status = 403;
    throw error;
  }

  return sanitizarParticipante(participante, 'admin');
}

/**
 * Edita datos básicos de un participante (nombre, apellido, email, respuestas_form).
 * DNI y nacimiento no se pueden editar — son datos de identidad que no deben
 * cambiar post-inscripción (cambiar el DNI podría evadir la unicidad del evento).
 */
async function editarParticipante(id, orgId, datos) {
  const participante = await obtenerParticipante(id, orgId);

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.apellido !== undefined) datosDb.apellido = datos.apellido;
  if (datos.email !== undefined) datosDb.email = datos.email;
  if (datos.estadoPago !== undefined) datosDb.estado_pago = datos.estadoPago;
  if (datos.pagadoPor !== undefined) datosDb.pagado_por = datos.pagadoPor;
  if (datos.respuestasForm !== undefined) {
    datosDb.respuestas_form = JSON.stringify(datos.respuestasForm);
  }

  const actualizado = await participantesRepository.actualizar(id, datosDb);
  invalidar(`evento:${participante.evento_id}`);
  return actualizado;
}

/**
 * Elimina un participante del evento (baja de inscripción).
 * No elimina si el participante es responsable de un grupo con integrantes —
 * eso lo dejamos como validación futura cuando exista el módulo grupos completo.
 */
async function eliminarParticipante(id, orgId) {
  const participante = await obtenerParticipante(id, orgId);
  await participantesRepository.eliminar(id);

  invalidar(`evento:${participante.evento_id}`);
}

/**
 * Aprueba o rechaza el vínculo de un autoinscripto a un grupo (RN04).
 * Solo puede hacerlo el responsable del grupo — esa verificación la hace
 * el controller/middleware, no este service.
 *
 * Un rechazo NO elimina la inscripción al evento, solo desvincula del grupo
 * (estado_vinculo = 'rechazado', grupo_id queda como estaba — el participante
 * puede volver a vincularse a otro grupo después).
 */
async function actualizarEstadoVinculo(id, orgId, estado, contexto = {}) {
  const participante = await obtenerParticipante(id, orgId);

  if (participante.rol_grupo !== 'autoinscripto') {
    const error = new Error('Solo se puede aprobar/rechazar el vínculo de participantes autoinscriptos');
    error.status = 400;
    throw error;
  }

  if (participante.estado_vinculo !== 'pendiente') {
    const error = new Error('Este participante ya fue aceptado o rechazado anteriormente');
    error.status = 409;
    throw error;
  }

  // Si viene un referente (no un admin), verificar que el participante
  // pertenece al grupo del referente
  if (contexto.referente) {
    if (participante.grupo_id !== contexto.referente.grupoId) {
      const error = new Error('No tenés permisos para gestionar este participante');
      error.status = 403;
      throw error;
    }
  }

  const actualizado = await participantesRepository.actualizar(id, { estado_vinculo: estado });
  invalidar(`evento:${participante.evento_id}`);

  // Notificar al participante del resultado
  const grupo = await gruposRepository.buscarPorId(participante.grupo_id);
  const evento = await buscarEventoCacheado(participante.evento_id);

  if (grupo && evento) {
    const template = estado === 'aceptado'
      ? templateVinculoAceptado({ participante, grupo, evento })
      : templateVinculoRechazado({ participante, grupo, evento });

    enviarMail({ to: participante.email, ...template });
  }

  return actualizado;
}

/**
 * Devuelve la última ubicación conocida de un participante
 * basada en su último checkin_taller (RN12.1).
 * Por ahora devuelve null — se implementa cuando construyamos acreditación.
 */
async function obtenerUltimaUbicacion(id, orgId) {
  await obtenerParticipante(id, orgId);
  // TODO: implementar cuando exista el módulo acreditación
  return null;
}

async function reenviarMailInscripcion(id, orgId, emailOverride = null) {
  const participante = await participantesRepository.buscarPorId(id);

  if (!participante) {
    const error = new Error('Participante no encontrado');
    error.status = 404;
    throw error;
  }

  if (participante.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este participante');
    error.status = 403;
    throw error;
  }

  const evento = await buscarEventoCacheado(participante.evento_id);

  let dniLegible = participante.dni;
  try {
    dniLegible = desencriptar(participante.dni);
  } catch { }

  const credencialBuffer = await generarCredencial({
    qrPersonal: participante.qr_personal,
    nombreEvento: evento.nombre,
    nombreParticipante: `${participante.nombre} ${participante.apellido}`,
    dni: dniLegible,
    esReferente: participante.rol_grupo === 'responsable',
  });

  let grupo = null;

  if (participante.grupo_id) {
    grupo = await gruposRepository.buscarPorId(participante.grupo_id);
  }

  const { subject, html } = templateConfirmacionInscripcion({
    participante: {
      ...participante,
      dni: dniLegible,
    },
    evento,
    grupo,
  });

  const destinatario = emailOverride ?? participante.email;

  await enviarMail({
    to: destinatario,
    subject,
    html,
    attachments: [
      {
        filename: `credencial_${dniLegible}.png`,
        content: credencialBuffer,
        contentType: 'image/png',
      },
    ],
  });
}

/**
 * Genera el PDF de "pasar lista" (presentes/ausentes) para un evento.
 * No persiste nada — es una foto del pase de lista hecho en el front.
 */
async function generarListaPdf(eventoId, orgId, registros, filtros = {}) {
  const evento = await buscarEventoCacheado(eventoId);
  if (!evento) {
    const error = new Error('Evento no encontrado'); error.status = 404; throw error;
  }
  if (evento.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este evento'); error.status = 403; throw error;
  }

  const ids = registros.map((r) => r.participanteId);
  const participantes = await participantesRepository.buscarPorIds(ids);
  const estadoPorId = new Map(registros.map((r) => [r.participanteId, r.estado]));

  const filas = participantes
    .filter((p) => p.evento_id === eventoId)
    .map((p) => {
      let dniLegible = p.dni;
      try { dniLegible = desencriptar(p.dni); } catch { }
      return {
        apellido: p.apellido,
        nombre: p.nombre,
        dni: dniLegible,
        estado: estadoPorId.get(p.id) === 'presente' ? 'Presente' : 'Ausente',
      };
    })
    .sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre));

  // Labels legibles para los filtros conocidos que puede mandar el front.
  // Los "campo_<id>" son respuestas a campos dinámicos del formulario —
  // ahí sí hay que ir a buscar la etiqueta real a campo_form.
  const LABELS_FILTROS = {
    universo: 'Participantes',
    checkin: 'Acreditado',
    pago: 'Estado de pago',
    edad: 'Edad',
    grupo: 'Grupo',
  };

  function formatearValorFiltro(key, valor) {
    if (key === 'checkin') {
      return String(valor).toLowerCase() === 'ausente' ? 'No' : 'Sí';
    }
    return valor;
  }

  const idsCampoDinamico = Object.keys(filtros)
    .filter((k) => k.startsWith('campo_'))
    .map((k) => k.slice('campo_'.length));
  const labelsCampoDinamico = {};
  if (idsCampoDinamico.length > 0) {
    const campos = await formulariosRepository.listarPorEvento(eventoId);
    for (const campo of campos) {
      if (idsCampoDinamico.includes(campo.id)) {
        labelsCampoDinamico[`campo_${campo.id}`] = campo.etiqueta;
      }
    }
  }

  function formatearLabelFiltro(key) {
    return labelsCampoDinamico[key]
      ?? LABELS_FILTROS[key]
      ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  const filtrosTexto = Object.entries(filtros)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${formatearLabelFiltro(k)}: ${formatearValorFiltro(k, v)}`);

  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const izq = doc.page.margins.left;
    const anchoPagina = doc.page.width - izq - doc.page.margins.right;
    const columnas = [
      { label: 'Apellido', key: 'apellido', x: izq, width: anchoPagina * 0.28 },
      { label: 'Nombre', key: 'nombre', x: izq + anchoPagina * 0.28, width: anchoPagina * 0.28 },
      { label: 'DNI', key: 'dni', x: izq + anchoPagina * 0.56, width: anchoPagina * 0.22 },
      { label: 'Estado', key: 'estado', x: izq + anchoPagina * 0.78, width: anchoPagina * 0.22 },
    ];

    // ===== Cabecera: título a la izquierda, fecha a la derecha, misma línea =====
    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(16)
      .text(evento.nombre, izq, y, { width: anchoPagina * 0.7 });
    doc.font('Helvetica').fontSize(10)
      .text(new Date().toLocaleDateString('es-AR'), izq, y + 4, { width: anchoPagina, align: 'right' });
    y += 24;

    // ===== Filtros, en grilla de 3 por fila =====
    if (filtrosTexto.length > 0) {
      doc.font('Helvetica-Bold').fontSize(10).text('Filtros', izq, y);
      y += 15;
      doc.font('Helvetica').fontSize(9);
      const POR_FILA = 3;
      const anchoChip = anchoPagina / POR_FILA;
      for (let i = 0; i < filtrosTexto.length; i += POR_FILA) {
        const fila = filtrosTexto.slice(i, i + POR_FILA);
        fila.forEach((texto, j) => {
          doc.text(texto, izq + j * anchoChip, y, { width: anchoChip - 10 });
        });
        y += 14;
      }
      y += 6;
    }

    const alturaFila = 20;

    function dibujarEncabezadoTabla() {
      doc.font('Helvetica-Bold').fontSize(10);
      columnas.forEach((col) => doc.text(col.label, col.x, y, { width: col.width }));
      y += 16;
      doc.moveTo(izq, y).lineTo(izq + anchoPagina, y).stroke();
      y += 8;
      doc.font('Helvetica').fontSize(10);
    }

    dibujarEncabezadoTabla();

    if (filas.length === 0) {
      doc.fontSize(10).text('No hay participantes para mostrar.', izq, y);
    }

    filas.forEach((fila) => {
      if (y + alturaFila > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        dibujarEncabezadoTabla();
      }
      columnas.forEach((col) => doc.text(fila[col.key], col.x, y, { width: col.width }));
      y += alturaFila;
    });

    doc.end();
  });

  return {
    buffer,
    nombreArchivo: `lista_asistencia_${evento.codigo}.pdf`,
  };
}

async function listarEliminados(eventoId, orgId) {
  const evento = await buscarEventoCacheado(eventoId);
  if (!evento) {
    const error = new Error('Evento no encontrado');
    error.status = 404;
    throw error;
  }
  if (evento.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este evento');
    error.status = 403;
    throw error;
  }

  const eliminados = await participantesRepository.listarEliminadosPorEvento(eventoId);
  return eliminados.map((p) => sanitizarParticipante(p, 'admin'));
}

async function subirAutorizacion(id, orgId, file) {
  let participante;
  if (orgId) {
    participante = await obtenerParticipante(id, orgId);
  } else {
    participante = await participantesRepository.buscarPorId(id);
    if (!participante) {
      const error = new Error('Participante no encontrado');
      error.status = 404; throw error;
    }
  }

  const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(file.mimetype)) {
    const error = new Error('Solo se aceptan PDF o imágenes (JPG, PNG, WebP)');
    error.status = 400; throw error;
  }

  const ext = file.mimetype === 'application/pdf' ? 'pdf' : 'jpg';
  const key = `autorizaciones/${participante.evento_id}/${id}.${ext}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  const url = construirUrlPublica(key);
  await participantesRepository.actualizar(id, { autorizacion_url: url });
  invalidar(`evento:${participante.evento_id}`);

  return { autorizacion_url: url };
}

async function subirCertificado(id, orgId, file) {
  let participante;
  if (orgId) {
    participante = await obtenerParticipante(id, orgId);
  } else {
    participante = await participantesRepository.buscarPorId(id);
    if (!participante) {
      const error = new Error('Participante no encontrado');
      error.status = 404; throw error;
    }
  }

  const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(file.mimetype)) {
    const error = new Error('Solo se aceptan PDF o imágenes (JPG, PNG, WebP)');
    error.status = 400; throw error;
  }

  const ext = file.mimetype === 'application/pdf' ? 'pdf' : 'jpg';
  const key = `certificados/${participante.evento_id}/${id}.${ext}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  const url = construirUrlPublica(key);
  await participantesRepository.actualizar(id, { certificado_url: url });
  invalidar(`evento:${participante.evento_id}`);

  return { certificado_url: url };
}

async function verificarDniEnEvento(dni, eventoId) {
  const participante = await participantesRepository.buscarPorDniYEvento(dni, eventoId);
  if (!participante) {
    return { existe: false };
  }
  return {
    existe: true,
    participanteId: participante.id,
    nombre: participante.nombre,
    apellido: participante.apellido,
    estadoPago: participante.estado_pago,
    zona: participante.zona_nombre
      ? { nombre: participante.zona_nombre, costo: participante.zona_costo }
      : null,
  };
}

async function actualizarEstadoPago(id, orgId, estadoPago) {
  // Verificar permisos con obtenerParticipante
  await obtenerParticipante(id, orgId);

  // Traer participante crudo para el mail (con dni encriptado y qr_personal)
  const participante = await participantesRepository.buscarPorId(id);
  const evento = await eventosRepository.buscarPorId(participante.evento_id);

  await participantesRepository.actualizar(id, { estado_pago: estadoPago });
  invalidar(`evento:${participante.evento_id}`);

  if (estadoPago === 'aprobado') {
    try {
      const dniLegible = desencriptar(participante.dni);
      const credencialBuffer = await generarCredencial({
        qrPersonal: participante.qr_personal,
        nombreEvento: evento.nombre,
        nombreParticipante: `${participante.nombre} ${participante.apellido}`,
        dni: dniLegible,
        esReferente: participante.rol_grupo === 'responsable'
      });
      let grupo = null;
      if (participanteActualizado.grupo_id) {
        grupo = await gruposRepository.buscarPorId(participanteActualizado.grupo_id);
      }

      const { subject, html } = templateConfirmacionInscripcion({
        participante: { ...participanteActualizado, dni: datosParaMail.dni },
        evento,
        grupo,
      });
      enviarMail({
        to: participante.email,
        subject,
        html,
        attachments: [{
          filename: `credencial_${dniLegible}.png`,
          content: credencialBuffer,
          contentType: 'image/png',
        }],
      });
    } catch (err) {
      console.error('[mail] Error al enviar mail de aprobación:', err.message);
    }
  }

  if (estadoPago === 'rechazado') {
    try {
      const { subject, html } = templatePagoRechazado({ participante, evento });
      enviarMail({ to: participante.email, subject, html });
    } catch (err) {
      console.error('[mail] Error al enviar mail de rechazo:', err.message);
    }
  }

  return { ok: true, estadoPago };
}

/**
 * Corrige la zona de costo autodeclarada por el participante. La usa el Admin
 * desde el panel de revisión de pagos cuando el comprobante no coincide con
 * lo que el participante eligió al inscribirse. UPDATE de aplicación, sin
 * estado propio (mismo criterio que RN04) — no dispara recálculo de estado_pago.
 */
async function actualizarZonaCosto(id, orgId, zonaCostoId) {
  const participante = await obtenerParticipante(id, orgId);

  if (zonaCostoId) {
    const zonaCosto = await zonasCostoRepository.buscarPorId(zonaCostoId);
    if (!zonaCosto || zonaCosto.evento_id !== participante.evento_id) {
      const error = new Error('La zona de costo seleccionada no es válida para este evento');
      error.status = 400;
      throw error;
    }
  }

  const actualizado = await participantesRepository.actualizar(id, { zona_costo_id: zonaCostoId });
  invalidar(`evento:${participante.evento_id}`);
  return sanitizarParticipante(actualizado, 'admin');
}

module.exports = {
  crearParticipante,
  listarParticipantes,
  obtenerParticipante,
  editarParticipante,
  eliminarParticipante,
  actualizarEstadoVinculo,
  obtenerUltimaUbicacion,
  calcularEsMayor,
  sanitizarParticipante,
  reenviarMailInscripcion,
  listarEliminados,
  subirAutorizacion,
  subirCertificado,
  verificarDniEnEvento,
  actualizarEstadoPago,
  actualizarZonaCosto,
  generarListaPdf,
};