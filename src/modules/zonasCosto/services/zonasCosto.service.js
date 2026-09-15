const zonasCostoRepository = require('../repositories/zonasCosto.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const { invalidar } = require('../../../utils/cache');

async function verificarEvento(eventoId, orgId) {
  const evento = await eventosRepository.buscarPorId(eventoId);
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
  return evento;
}

async function verificarZonaDelEvento(eventoId, zonaId, orgId) {
  await verificarEvento(eventoId, orgId);

  const zona = await zonasCostoRepository.buscarPorId(zonaId);
  if (!zona) {
    const error = new Error('Zona no encontrada');
    error.status = 404;
    throw error;
  }
  if (zona.evento_id !== eventoId) {
    const error = new Error('La zona no pertenece a este evento');
    error.status = 400;
    throw error;
  }

  return zona;
}

async function listarZonas(eventoId, orgId) {
  await verificarEvento(eventoId, orgId);
  return zonasCostoRepository.listarPorEvento(eventoId);
}

async function crearZona(eventoId, orgId, datos) {
  await verificarEvento(eventoId, orgId);
  const zona = await zonasCostoRepository.crear(eventoId, orgId, datos);
  invalidar(`evento:${eventoId}`);
  return zona;
}

async function editarZona(eventoId, zonaId, orgId, datos) {
  await verificarZonaDelEvento(eventoId, zonaId, orgId);
  const zona = await zonasCostoRepository.actualizar(zonaId, datos);
  invalidar(`evento:${eventoId}`);
  return zona;
}

async function eliminarZona(eventoId, zonaId, orgId) {
  await verificarZonaDelEvento(eventoId, zonaId, orgId);
  await zonasCostoRepository.eliminar(zonaId);
  invalidar(`evento:${eventoId}`);
}

module.exports = {
  listarZonas,
  crearZona,
  editarZona,
  eliminarZona,
};
