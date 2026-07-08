const formulariosRepository = require('../repositories/formularios.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');

/**
 * Verifica que el evento exista y pertenezca a la org, y que el campo
 * pertenezca a ese evento. Reutilizado en editar, eliminar, y reordenar.
 */
async function verificarCampoDelEvento(eventoId, campoId, orgId) {
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

  const campo = await formulariosRepository.buscarPorId(campoId);
  if (!campo) {
    const error = new Error('Campo no encontrado');
    error.status = 404;
    throw error;
  }
  if (campo.evento_id !== eventoId) {
    const error = new Error('El campo no pertenece a este evento');
    error.status = 400;
    throw error;
  }

  return { evento, campo };
}

async function listarCampos(eventoId, orgId) {
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

  return formulariosRepository.listarPorEvento(eventoId);
}

async function crearCampo(eventoId, orgId, datos) {
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

  return formulariosRepository.crear(eventoId, orgId, datos);
}

async function editarCampo(eventoId, campoId, orgId, datos) {
  await verificarCampoDelEvento(eventoId, campoId, orgId);

  const datosDb = {};
  if (datos.etiqueta !== undefined) datosDb.etiqueta = datos.etiqueta;
  if (datos.requerido !== undefined) datosDb.requerido = datos.requerido;
  if (datos.orden !== undefined) datosDb.orden = datos.orden;

  // Si cambia el tipo, hay que resetear las opciones según corresponda
  if (datos.tipo !== undefined) {
    datosDb.tipo = datos.tipo;
    datosDb.opciones = datos.tipo === 'seleccion'
      ? JSON.stringify(datos.opciones)
      : null;
  } else if (datos.opciones !== undefined) {
    // Si no cambia el tipo pero sí las opciones (solo válido si el tipo actual es 'seleccion')
    datosDb.opciones = JSON.stringify(datos.opciones);
  }

  return formulariosRepository.actualizar(campoId, datosDb);
}

async function eliminarCampo(eventoId, campoId, orgId) {
  await verificarCampoDelEvento(eventoId, campoId, orgId);
  await formulariosRepository.eliminar(campoId);
}

/**
 * Reordena los campos del formulario.
 * Recibe un array de { id, orden } y actualiza cada uno.
 * Valida que todos los ids pertenezcan al evento antes de actualizar.
 */
async function reordenarCampos(eventoId, orgId, campos) {
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

  // Verificar que todos los ids pertenecen al evento
  const camposExistentes = await formulariosRepository.listarPorEvento(eventoId);
  const idsExistentes = new Set(camposExistentes.map((c) => c.id));

  for (const campo of campos) {
    if (!idsExistentes.has(campo.id)) {
      const error = new Error(`El campo ${campo.id} no pertenece a este evento`);
      error.status = 400;
      throw error;
    }
  }

  return formulariosRepository.reordenar(campos);
}

module.exports = {
  listarCampos,
  crearCampo,
  editarCampo,
  eliminarCampo,
  reordenarCampos,
};