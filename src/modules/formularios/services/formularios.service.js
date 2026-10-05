const { db } = require('../../../config/db');
const formulariosRepository = require('../repositories/formularios.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const { getOrSet, invalidar } = require('../../../utils/cache');

/**
 * Verifica que el evento exista y pertenezca a la org, y que el campo
 * pertenezca a ese evento.
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

async function listarCampos(eventoId, orgId, { incluirInactivos = false } = {}) {
  const clave = incluirInactivos ? 'campos_form_todos' : 'campos_form';
  return getOrSet(`evento:${eventoId}`, clave, async () => {
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

    return formulariosRepository.listarPorEvento(eventoId, { incluirInactivos });
  })
}

/**
 * Las respuestas guardan el texto de la opción (string, o array en multi-select),
 * así que al renombrar opciones hay que reescribirlas. `mapa` es Map(viejo → nuevo).
 */
function aplicarRenombres(valor, mapa) {
  if (Array.isArray(valor)) return valor.map((v) => (mapa.has(v) ? mapa.get(v) : v));
  return mapa.has(valor) ? mapa.get(valor) : valor;
}

/**
 * Al desactivar `multiple`, las respuestas con una sola opción pasan de array a string.
 * Devuelve null si alguna eligió más de una (no se puede desactivar sin perder datos).
 */
function aSeleccionSimple(valor) {
  if (!Array.isArray(valor)) return valor;
  if (valor.length > 1) return null;
  return valor[0];
}

/**
 * Edita etiqueta, opciones, multiple y/o estado (baja lógica / reactivación) de un campo.
 * No se puede cambiar el tipo ni el requerido, y las opciones solo se agregan
 * o renombran: opciones[i] es la versión (renombrada o no) de la opción i original,
 * las posiciones extra son opciones nuevas. Eliminar no se permite porque puede
 * haber participantes que la eligieron.
 */
async function editarCampo(eventoId, campoId, orgId, datos) {
  const { campo } = await verificarCampoDelEvento(eventoId, campoId, orgId);

  const datosDb = {};
  if (datos.etiqueta !== undefined) datosDb.etiqueta = datos.etiqueta;
  if (datos.activo !== undefined) {
    datosDb.activo = datos.activo;
    datosDb.eliminado_en = datos.activo ? null : new Date();
  }

  if (datos.multiple !== undefined) {
    if (campo.tipo !== 'seleccion') {
      const error = new Error('Solo los campos de selección pueden permitir varias opciones');
      error.status = 400;
      throw error;
    }
    datosDb.multiple = datos.multiple;
  }
  const pasaASimple = campo.multiple && datos.multiple === false;

  const renombres = new Map();
  if (datos.opciones !== undefined) {
    if (campo.tipo !== 'seleccion') {
      const error = new Error('Solo los campos de selección tienen opciones');
      error.status = 400;
      throw error;
    }
    const originales = campo.opciones || [];
    if (datos.opciones.length < originales.length) {
      const error = new Error('No se pueden eliminar opciones: puede haber participantes que las eligieron');
      error.status = 400;
      throw error;
    }
    originales.forEach((viejo, i) => {
      if (viejo !== datos.opciones[i]) renombres.set(viejo, datos.opciones[i]);
    });
    datosDb.opciones = JSON.stringify(datos.opciones);
  }

  if (Object.keys(datosDb).length === 0) return campo;

  const actualizado = await db.transaction(async (trx) => {
    const resultado = await formulariosRepository.actualizar(campoId, datosDb, trx);
    if (renombres.size > 0 || pasaASimple) {
      // ponytail: un UPDATE por participante afectado; pasar a un solo UPDATE en SQL si hay eventos con miles
      const filas = await formulariosRepository.listarRespuestasDeCampo(eventoId, campoId, trx);
      for (const fila of filas) {
        const respuestas = fila.respuestas_form || {};
        let nuevo = aplicarRenombres(respuestas[campoId], renombres);
        if (pasaASimple) {
          nuevo = aSeleccionSimple(nuevo);
          if (nuevo === null) {
            const error = new Error('No se puede volver a una sola opción: hay participantes que eligieron varias');
            error.status = 400;
            throw error;
          }
        }
        if (JSON.stringify(nuevo) === JSON.stringify(respuestas[campoId])) continue;
        await formulariosRepository.actualizarRespuestas(fila.id, { ...respuestas, [campoId]: nuevo }, trx);
      }
    }
    return resultado;
  });

  invalidar(`evento:${eventoId}`);
  return actualizado;
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
  const camposExistentes = await formulariosRepository.listarPorEvento(eventoId, { incluirInactivos: true });
  const idsExistentes = new Set(camposExistentes.map((c) => c.id));

  for (const campo of campos) {
    if (!idsExistentes.has(campo.id)) {
      const error = new Error(`El campo ${campo.id} no pertenece a este evento`);
      error.status = 400;
      throw error;
    }
  }

  const resultado = await formulariosRepository.reordenar(campos);
  invalidar(`evento:${eventoId}`);
  return resultado;
}

module.exports = {
  listarCampos,
  editarCampo,
  reordenarCampos,
  aplicarRenombres,
  aSeleccionSimple,
};