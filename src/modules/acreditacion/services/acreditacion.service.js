const { db } = require('../../../config/db');
const acreditacionRepository = require('../repositories/acreditacion.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');
const gruposRepository = require('../../grupos/repositories/grupos.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const { emitirAEvento } = require('../../../sockets/emitter');
const EVENTOS_WS = require('../../../sockets/event');
const { desencriptar } = require('../../../utils/encryption');
const { eventoEstaCerrado } = require('../../eventos/services/eventos.service');

/**
 * Crea una sesión de acreditador — identidad efímera para el día del evento.
 * No requiere cuenta de usuario, solo nombre y apellido.
 */
async function crearSesion(orgId, datos) {
  const evento = await eventosRepository.buscarPorId(datos.eventoId);
  if (!evento) {
    const error = new Error('Evento no encontrado');
    error.status = 404;
    throw error;
  }

  // Si no viene orgId (acceso público), lo tomamos del evento
  const orgIdFinal = orgId ?? evento.org_id;

  return acreditacionRepository.crearSesion({
    orgId: orgIdFinal,
    eventoId: datos.eventoId,
    puntoAccesoId: datos.puntoAccesoId,
    nombre: datos.nombre,
    apellido: datos.apellido,
  });
}

/**
 * Escanea un QR y devuelve los datos del participante.
 * Si es un referente, devuelve también los integrantes de su grupo
 * para la acreditación grupal.
 *
 * No acredita todavía — solo resuelve el QR y devuelve datos para
 * que el acreditador confirme antes de marcar presentes.
 */
async function escanearQr(qrPersonal, eventoId) {
  const participante = await participantesRepository.buscarPorQr(qrPersonal);

  if (!participante) {
    const error = new Error('QR inválido o no encontrado');
    error.status = 404;
    throw error;
  }

  if (participante.evento_id !== eventoId) {
    const error = new Error('Este QR no corresponde a este evento');
    error.status = 400;
    throw error;
  }

  // Desencriptar DNI para mostrar en la pantalla de acreditación
  let dniLegible = participante.dni;
  try { dniLegible = desencriptar(participante.dni); } catch { }

  const yaAcreditado = await acreditacionRepository.buscarCheckinPorParticipante(participante.id);

  // Si es responsable de un grupo, traemos los integrantes para acreditación grupal
  let grupo = null;
  if (participante.rol_grupo === 'responsable' && participante.grupo_id) {
    const grupoData = await gruposRepository.buscarPorId(participante.grupo_id);
    const integrantes = await gruposRepository.listarIntegrantes(participante.grupo_id);

    // Para cada integrante, verificamos si ya está acreditado
    const integrantesConEstado = await Promise.all(
      integrantes.map(async (i) => {
        const checkin = await acreditacionRepository.buscarCheckinPorParticipante(i.id);
        let dniIntegrante = i.dni;
        try { dniIntegrante = desencriptar(i.dni); } catch { }
        return {
          id: i.id,
          nombre: i.nombre,
          apellido: i.apellido,
          dni: dniIntegrante,
          es_mayor: i.es_mayor,
          estado_pago: i.estado_pago,
          acreditado: !!checkin,
        };
      })
    );

    grupo = {
      id: grupoData.id,
      nombre: grupoData.nombre,
      integrantes: integrantesConEstado,
    };
  }

  return {
    participante: {
      id: participante.id,
      nombre: participante.nombre,
      apellido: participante.apellido,
      dni: dniLegible,
      es_mayor: participante.es_mayor,
      estado_pago: participante.estado_pago,
      rol_grupo: participante.rol_grupo,
      acreditado: !!yaAcreditado,
    },
    grupo, // null si no es referente
  };
}

/**
 * Acredita un participante individual.
 * Si ya fue acreditado, devuelve un error claro (el UNIQUE de la DB también lo impide).
 */
async function acreditarIndividual(participanteId, acreditadorId, orgId, puntoAccesoId) {
  return db.transaction(async (trx) => {
    const participante = await participantesRepository.buscarPorId(participanteId, trx);
    if (!participante) {
      const error = new Error('Participante no encontrado');
      error.status = 404;
      throw error;
    }

    const evento = await eventosRepository.buscarPorId(participante.evento_id, trx);
    if (eventoEstaCerrado(evento)) {
      const error = new Error('Las acreditaciones para este evento están cerradas');
      error.status = 409;
      throw error;
    }

    // Resolver orgId desde el participante si no viene del header
    const orgIdFinal = orgId ?? participante.org_id;

    const yaAcreditado = await acreditacionRepository.buscarCheckinPorParticipante(
      participanteId,
      trx
    );
    if (yaAcreditado) {
      const error = new Error('Este participante ya fue acreditado');
      error.status = 409;
      throw error;
    }

    const checkin = await acreditacionRepository.crearCheckin(
      { orgId: orgIdFinal, participanteId, acreditadorId, puntoAccesoId },
      trx
    );

    const total = await acreditacionRepository.contarAcreditadosPorEvento(
      participante.evento_id,
      trx
    );

    emitirAEvento(participante.evento_id, EVENTOS_WS.CHECKIN_NUEVO, {
      tipo: 'individual',
      participanteId,
      nombre: participante.nombre,
      apellido: participante.apellido,
      nacimiento: participante.nacimiento,
      es_mayor: participante.es_mayor,
      estado_pago: participante.estado_pago,
      grupo_id: participante.grupo_id,
      momento: checkin.momento,
      totalAcreditados: total,
    });

    return checkin;
  });
}

/**
 * Acredita varios participantes de un grupo en una sola operación (RN10).
 * El acreditador marca los que quiere acreditar y confirma de una vez.
 * Los que ya estaban acreditados se saltean sin error.
 */
async function acreditarGrupal(participanteIds, acreditadorId, orgId, puntoAccesoId, eventoId) {
  return db.transaction(async (trx) => {
    let orgIdFinal = orgId;
    if (!orgIdFinal) {
      const evento = await eventosRepository.buscarPorId(eventoId, trx);
      if (!evento) {
        const error = new Error('Evento no encontrado');
        error.status = 404;
        throw error;
      }
      orgIdFinal = evento.org_id;
    }

    const evento = await eventosRepository.buscarPorId(eventoId, trx);
    if (eventoEstaCerrado(evento)) {
      const error = new Error('Las acreditaciones para este evento están cerradas');
      error.status = 409;
      throw error;
    }

    const resultados = [];

    for (const participanteId of participanteIds) {
      const participante = await participantesRepository.buscarPorId(participanteId, trx);
      if (!participante) {
        resultados.push({ participanteId, resultado: 'no_encontrado' });
        continue;
      }

      const yaAcreditado = await acreditacionRepository.buscarCheckinPorParticipante(
        participanteId,
        trx
      );

      const participanteData = {
        id: participante.id,
        nombre: participante.nombre,
        apellido: participante.apellido,
        nacimiento: participante.nacimiento,
        es_mayor: participante.es_mayor,
        estado_pago: participante.estado_pago,
        rol_grupo: participante.rol_grupo,
        grupo_id: participante.grupo_id,
      };

      if (yaAcreditado) {
        resultados.push({
          participanteId,
          resultado: 'ya_acreditado',
          participante: participanteData,
        });
        continue;
      }

      const checkin = await acreditacionRepository.crearCheckin(
        { orgId: orgIdFinal, participanteId, acreditadorId, puntoAccesoId },
        trx
      );

      resultados.push({
        participanteId,
        resultado: 'acreditado',
        checkin,
        participante: participanteData,
      });
    }

    const total = await acreditacionRepository.contarAcreditadosPorEvento(eventoId, trx);
    const acreditadosData = resultados
      .filter((r) => r.resultado === 'acreditado')
      .map((r) => ({
        participanteId: r.participanteId,
        nombre: r.participante.nombre,
        apellido: r.participante.apellido,
        nacimiento: r.participante.nacimiento,
        es_mayor: r.participante.es_mayor,
        estado_pago: r.participante.estado_pago,
        grupo_id: r.participante.grupo_id,
      }));

    emitirAEvento(eventoId, EVENTOS_WS.CHECKIN_NUEVO, {
      tipo: 'grupal',
      acreditados: acreditadosData,
      cantidad: acreditadosData.length,
      totalAcreditados: total,
      momento: new Date(),
    });

    return resultados;
  });
}

module.exports = {
  crearSesion,
  escanearQr,
  acreditarIndividual,
  acreditarGrupal,
};