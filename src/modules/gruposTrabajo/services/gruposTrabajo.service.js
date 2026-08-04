const { db } = require('../../../config/db');
const repo = require('../repositories/gruposTrabajo.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');
const { desencriptar } = require('../../../utils/encryption');
const ExcelJS = require('exceljs');
const { calcularEdad } = require('../../participantes/services/participantes.service');
const { templateAsignacionGrupo } = require('../../../utils/mailTemplates');
const { enviarMail } = require('../../../utils/mail');
const { getOrSet, invalidar, invalidarPorPrefijo } = require('../../../utils/cache');

// ─── PRESETS DE NOMBRES ──────────────────────────────────────────────────────

const PRESETS = {
  letras: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
  colores: ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Violeta', 'Rosa', 'Celeste', 'Blanco', 'Negro', 'Gris', 'Marrón'],
  animales: ['León', 'Tigre', 'Águila', 'Delfín', 'Lobo', 'Zorro', 'Oso', 'Puma', 'Cóndor', 'Serpiente', 'Jaguar', 'Halcón'],
  comidas: ['Pizza', 'Asado', 'Empanada', 'Milanesa', 'Locro', 'Humita', 'Mate', 'Alfajor', 'Medialunas', 'Facturas', 'Dulce de leche', 'Chimichurri'],
};

const ESTADO_PAGO_LABELS = {
  no_aplica: 'Sin costo',
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

function resolverListaNombres(esquema) {
  if (esquema.nombres_preset === 'custom') return esquema.nombres_lista ?? [];
  return PRESETS[esquema.nombres_preset] ?? PRESETS.letras;
}

/**
 * Genera el nombre de un grupo según el modo y el índice.
 * - por_grupo: consume la lista en orden global, con reciclado si corresponde
 * - por_tanda: el nombre de la tanda ya viene resuelto, se le agrega sufijo numérico
 */
function generarNombreGrupo({ modoNombrado, lista, accionSinNombres, indiceGlobal, nombreTanda, indiceEnTanda }) {
  if (modoNombrado === 'por_tanda') {
    return `${nombreTanda} ${indiceEnTanda + 1}`;
  }

  // por_grupo
  if (indiceGlobal < lista.length) {
    return lista[indiceGlobal];
  }

  if (accionSinNombres === 'bloquear_generacion') {
    throw new Error('NOMBRES_AGOTADOS');
  }

  // reciclar_numerado: vueltas completas
  const vuelta = Math.floor(indiceGlobal / lista.length) + 1;
  const nombre = lista[indiceGlobal % lista.length];
  return `${nombre}-${vuelta}`;
}

// ─── RESOLUCIÓN DE ATRIBUTOS ─────────────────────────────────────────────────

/**
 * Resuelve el valor de un atributo para un participante dado.
 * - origen 'fijo': accede a columnas conocidas de participante
 * - origen 'campo_form': accede a respuestas_form[campo_form_id]
 */
function resolverAtributo(participante, atributo) {
  if (!atributo) return null;

  if (atributo.origen === 'campo_form') {
    const respuestas = participante.respuestas_form ?? {};
    return respuestas[atributo.campo_form_id] ?? null;
  }

  // origen === 'fijo'
  switch (atributo.campo) {
    case 'edad': {
      if (!participante.nacimiento) return null;
      const hoy = new Date();
      const nac = new Date(participante.nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      if (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())) edad--;
      return edad;
    }
    case 'es_mayor':
      return participante.es_mayor;
    case 'grupo_inscripcion':
      return participante.grupo_id ?? null;
    case 'rol_grupo':
      return participante.rol_grupo ?? null;
    case 'estado_pago':
      return participante.estado_pago ?? null;
    case 'taller':
      // Se resuelve desde participante._tallerId si viene enriquecido
      // (ver obtenerUniversoBase que puede hacer el join)
      return participante._tallerId ?? null;
    default:
      return null;
  }
}

// ─── EVALUACIÓN DE CONDICIONES ───────────────────────────────────────────────

function evaluarCondicion(valor, operador, condicionValor, condicionValor2 = null) {
  if (valor === null || valor === undefined) return false;

  switch (operador) {
    case 'igual': return String(valor) === String(condicionValor);
    case 'distinto': return String(valor) !== String(condicionValor);
    case 'mayor_que': return Number(valor) > Number(condicionValor);
    case 'menor_que': return Number(valor) < Number(condicionValor);
    case 'contiene': return String(valor).toLowerCase().includes(String(condicionValor).toLowerCase());
    case 'entre':
      return Number(valor) >= Number(condicionValor) && Number(valor) <= Number(condicionValor2);
    default:
      return false;
  }
}

// ─── ALGORITMO DE DISTRIBUCIÓN ───────────────────────────────────────────────

/**
 * Distribuye un array de participantes en grupos de trabajo.
 * - Si hay balanceoAtributo: round-robin por valor del atributo
 * - Si no: distribución secuencial simple
 *
 * Devuelve un array de arrays (cada sub-array = un grupo).
 */
function distribuir(participantes, cantidadGrupos, balanceoAtributo) {
  if (cantidadGrupos <= 0 || participantes.length === 0) return [];

  const grupos = Array.from({ length: cantidadGrupos }, () => []);

  if (balanceoAtributo) {
    const porValor = {};
    for (const p of participantes) {
      const valorRaw = resolverAtributo(p, balanceoAtributo);
      const valor = normalizarValor(valorRaw);
      console.log(`[balanceo] ${p.nombre} → "${valorRaw}" → normalizado: "${valor}"`);
      if (!porValor[valor]) porValor[valor] = [];
      porValor[valor].push(p);
    }

    const valoresOrdenados = Object.keys(porValor).sort();
    let grupoIdx = 0;

    for (const valor of valoresOrdenados) {
      for (const participante of porValor[valor]) {
        grupos[grupoIdx % cantidadGrupos].push(participante);
        grupoIdx++;
      }
    }
  } else {
    participantes.forEach((p, i) => {
      grupos[i % cantidadGrupos].push(p);
    });
  }

  return grupos;
}

// ─── CÁLCULO DE CANTIDAD DE GRUPOS ───────────────────────────────────────────

function calcularCantidadGrupos(cantidad, modoTamano, valorTamano) {
  if (modoTamano === 'por_cantidad') {
    // valorTamano = cantidad de grupos deseados
    return Math.min(valorTamano, cantidad);
  } else {
    // por_tamano: valorTamano = tamaño de cada grupo
    return Math.max(1, Math.ceil(cantidad / valorTamano));
  }
}

// ─── FUNCIONES DE NEGOCIO ────────────────────────────────────────────────────

async function verificarEventoDeLaOrg(eventoId, orgId, trx = db) {
  const evento = await eventosRepository.buscarPorId(eventoId, trx);
  if (!evento) {
    const error = new Error('Evento no encontrado'); error.status = 404; throw error;
  }
  if (evento.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este evento'); error.status = 403; throw error;
  }
  return evento;
}

async function verificarEsquemaDeLaOrg(esquemaId, orgId, trx = db) {
  const esquema = await repo.buscarPorId(esquemaId, trx);
  if (!esquema) {
    const error = new Error('Esquema no encontrado'); error.status = 404; throw error;
  }
  if (esquema.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este esquema'); error.status = 403; throw error;
  }
  return esquema;
}

async function crearEsquema(eventoId, orgId, usuarioId, datos) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await repo.crearEsquema({ ...datos, eventoId, orgId, creadoPorUsuarioId: usuarioId });
  invalidar(`esquemas:evento:${eventoId}`);
  return esquema;
}

async function listarEsquemas(eventoId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  return getOrSet(`esquemas:evento:${eventoId}`, () => repo.listarPorEvento(eventoId));
}

async function obtenerEsquema(eventoId, esquemaId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const tandas = await repo.listarTandasPorEsquema(esquemaId);

  // Contar participantes fuera del esquema solo si ya fue generado
  let nuevosNoContemplados = 0;
  if (esquema.estado === 'generado') {
    // IDs que ya están en el esquema (grupos o pendientes)
    const enGrupos = await db('grupo_trabajo_participante')
      .join('grupo_trabajo', 'grupo_trabajo.id', 'grupo_trabajo_participante.grupo_trabajo_id')
      .where('grupo_trabajo.esquema_id', esquemaId)
      .select('grupo_trabajo_participante.participante_id');

    const enPendientes = await db('participante_esquema_pendiente')
      .where({ esquema_id: esquemaId })
      .select('participante_id');

    const idsContemplados = new Set([
      ...enGrupos.map(r => r.participante_id),
      ...enPendientes.map(r => r.participante_id),
    ]);

    // Universo base actual
    const universo = await obtenerUniversoBase(esquema, eventoId);
    nuevosNoContemplados = universo.filter(p => !idsContemplados.has(p.id)).length;
  }

  return { ...esquema, tandas, nuevosNoContemplados };
}

async function editarEsquema(eventoId, esquemaId, orgId, datos) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await verificarEsquemaDeLaOrg(esquemaId, orgId);

  if (esquema.estado === 'generado') {
    const error = new Error('No se puede editar la configuración de un esquema ya generado. Regeneralo primero.');
    error.status = 409; throw error;
  }

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.universoBase !== undefined) datosDb.universo_base = datos.universoBase;
  if (datos.criterioTandaAtributo !== undefined) datosDb.criterio_tanda_atributo = datos.criterioTandaAtributo ? JSON.stringify(datos.criterioTandaAtributo) : null;
  if (datos.modoTamano !== undefined) datosDb.modo_tamano = datos.modoTamano;
  if (datos.valorTamano !== undefined) datosDb.valor_tamano = datos.valorTamano;
  if (datos.balanceoAtributo !== undefined) datosDb.balanceo_atributo = datos.balanceoAtributo ? JSON.stringify(datos.balanceoAtributo) : null;
  if (datos.filtroElegibilidad !== undefined) datosDb.filtro_elegibilidad = datos.filtroElegibilidad ? JSON.stringify(datos.filtroElegibilidad) : null;
  if (datos.modoNombrado !== undefined) datosDb.modo_nombrado = datos.modoNombrado;
  if (datos.accionSinNombres !== undefined) datosDb.accion_sin_nombres = datos.accionSinNombres;
  if (datos.nombresPreset !== undefined) datosDb.nombres_preset = datos.nombresPreset;
  if (datos.nombresLista !== undefined) datosDb.nombres_lista = JSON.stringify(datos.nombresLista);

  invalidar(`esquemas:evento:${eventoId}`);
  return repo.actualizarEsquema(esquemaId, datosDb);
}

async function eliminarEsquema(eventoId, esquemaId, orgId) {
  invalidar(`esquemas:evento:${eventoId}`);
  await verificarEventoDeLaOrg(eventoId, orgId);
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  await repo.eliminarEsquema(esquemaId);
}

// ─── TANDAS ──────────────────────────────────────────────────────────────────

async function crearTanda(eventoId, esquemaId, orgId, datos) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await verificarEsquemaDeLaOrg(esquemaId, orgId);

  if (!esquema.criterio_tanda_atributo) {
    const error = new Error('Este esquema no tiene criterio de tanda definido');
    error.status = 400; throw error;
  }

  return repo.crearTanda({ ...datos, esquemaId, eventoId, orgId });
}

async function editarTanda(eventoId, esquemaId, tandaId, orgId, datos) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const datosDb = {};
  if (datos.orden !== undefined) datosDb.orden = datos.orden;
  if (datos.nombreResuelto !== undefined) datosDb.nombre_resuelto = datos.nombreResuelto;
  if (datos.condicion !== undefined) datosDb.condicion = JSON.stringify(datos.condicion);
  return repo.actualizarTanda(tandaId, datosDb);
}

async function eliminarTanda(eventoId, esquemaId, tandaId, orgId) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  await repo.eliminarTanda(tandaId);
}

async function reordenarTandas(eventoId, esquemaId, orgId, tandas) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  await repo.reordenarTandas(tandas);
}

// ─── EXCLUIDOS ───────────────────────────────────────────────────────────────

async function excluirParticipantes(eventoId, esquemaId, orgId, participanteIds) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const filas = participanteIds.map(pid => ({
    esquema_id: esquemaId,
    participante_id: pid,
    motivo: 'excluido_admin',
  }));
  await repo.agregarPendientes(filas);
}

async function quitarExcluido(eventoId, esquemaId, participanteId, orgId) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  await repo.eliminarPendiente(esquemaId, participanteId);
}

// ─── PREVIEW ─────────────────────────────────────────────────────────────────

async function preview(eventoId, esquemaId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const tandas = await repo.listarTandasPorEsquema(esquemaId);
  const excluidosAdmin = await repo.listarExcluidosAdmin(esquemaId);
  const idsExcluidosAdmin = new Set(excluidosAdmin.map(e => e.participante_id));

  const participantes = await obtenerUniversoBase(esquema, eventoId);
  const elegibles = aplicarFiltros(participantes, esquema, idsExcluidosAdmin);

  if (tandas.length === 0) {
    const cantGrupos = calcularCantidadGrupos(elegibles.length, esquema.modo_tamano, esquema.valor_tamano);
    return {
      tieneTandas: false,
      totalElegibles: elegibles.length,
      cantidadGrupos: cantGrupos,
      pendientesEstimados: 0,
    };
  }

  const resultadosPorTanda = [];
  let sinClasificar = 0;

  for (const tanda of tandas) {
    const enTanda = elegibles.filter(p =>
      evaluarCondicion(
        resolverAtributo(p, esquema.criterio_tanda_atributo),
        tanda.condicion.operador,
        tanda.condicion.valor,
        tanda.condicion.valor2
      )
    );
    const cantGrupos = calcularCantidadGrupos(enTanda.length, esquema.modo_tamano, esquema.valor_tamano);
    resultadosPorTanda.push({ tandaId: tanda.id, nombre: tanda.nombre_resuelto, cantidad: enTanda.length, grupos: cantGrupos });
  }

  // Contar sin clasificar
  const clasificados = new Set();
  for (const tanda of tandas) {
    for (const p of elegibles) {
      if (evaluarCondicion(
        resolverAtributo(p, esquema.criterio_tanda_atributo),
        tanda.condicion.operador,
        tanda.condicion.valor,
        tanda.condicion.valor2
      )) clasificados.add(p.id);
    }
  }
  sinClasificar = elegibles.filter(p => !clasificados.has(p.id)).length;

  return {
    tieneTandas: true,
    tandas: resultadosPorTanda,
    sinClasificar,
    totalElegibles: elegibles.length,
  };
}

// ─── HELPERS INTERNOS ────────────────────────────────────────────────────────

async function obtenerUniversoBase(esquema, eventoId) {
  const baseQuery = esquema.universo_base === 'acreditados'
    ? db('participante')
      .join('checkin', 'checkin.participante_id', 'participante.id')
      .where('participante.evento_id', eventoId)
      .where('participante.activo', true)
      .select('participante.*')
    : db('participante')
      .where({ evento_id: eventoId, activo: true })
      .select('*');

  const participantes = await baseQuery;

  // Si ningún atributo usa 'taller', no hace falta el JOIN extra
  const usaTaller = [
    esquema.criterio_tanda_atributo,
    esquema.balanceo_atributo,
    ...(esquema.filtro_elegibilidad ?? []).map(f => f.atributo),
  ].some(a => a?.origen === 'fijo' && a?.campo === 'taller');

  if (!usaTaller) return participantes;

  // Traer el taller más próximo en tiempo para cada participante
  const tallerMasProximo = await db('participante_taller')
    .join('taller', 'taller.id', 'participante_taller.taller_id')
    .whereIn('participante_taller.participante_id', participantes.map(p => p.id))
    .where('taller.evento_id', eventoId)
    .orderBy('taller.inicio', 'asc')
    .select(
      'participante_taller.participante_id',
      'taller.id as taller_id',
      'taller.nombre as taller_nombre',
      'taller.inicio',
    )
    .then(rows => {
      // Quedarnos con el primero por participante (ya viene ordenado por inicio ASC)
      const mapa = {};
      for (const row of rows) {
        if (!mapa[row.participante_id]) {
          mapa[row.participante_id] = row.taller_id;
        }
      }
      return mapa;
    });

  // Enriquecer participantes con _tallerId
  return participantes.map(p => ({
    ...p,
    _tallerId: tallerMasProximo[p.id] ?? null,
  }));
}

function aplicarFiltros(participantes, esquema, idsExcluidosAdmin) {
  return participantes.filter(p => {
    if (idsExcluidosAdmin.has(p.id)) return false;
    if (!esquema.filtro_elegibilidad || esquema.filtro_elegibilidad.length === 0) return true;

    return esquema.filtro_elegibilidad.every(condicion =>
      evaluarCondicion(
        resolverAtributo(p, condicion.atributo),
        condicion.operador,
        condicion.valor
      )
    );
  });
}

// ─── GENERACIÓN ──────────────────────────────────────────────────────────────

async function generar(eventoId, esquemaId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const tandas = await repo.listarTandasPorEsquema(esquemaId);
  const lista = resolverListaNombres(esquema);

  // Validación previa: si modo_nombrado='por_grupo' y accion='bloquear_generacion'
  // calcular total de grupos y comparar con lista
  if (esquema.modo_nombrado === 'por_grupo' && esquema.accion_sin_nombres === 'bloquear_generacion') {
    const excluidosAdmin = await repo.listarExcluidosAdmin(esquemaId);
    const idsExcluidosAdmin = new Set(excluidosAdmin.map(e => e.participante_id));
    const participantes = await obtenerUniversoBase(esquema, eventoId);
    const elegibles = aplicarFiltros(participantes, esquema, idsExcluidosAdmin);

    // Agregar excluidos por sistema a pendientes
    const idsElegibles = new Set(elegibles.map(p => p.id));
    const excluidosSistema = participantes
      .filter(p => !idsElegibles.has(p.id) && !idsExcluidosAdmin.has(p.id))
      .map(p => ({
        esquema_id: esquemaId,
        participante_id: p.id,
        motivo: 'excluido_sistema',
      }));

    pendientes.push(...excluidosSistema);

    let totalGrupos = 0;
    if (tandas.length === 0) {
      totalGrupos = calcularCantidadGrupos(elegibles.length, esquema.modo_tamano, esquema.valor_tamano);
    } else {
      for (const tanda of tandas) {
        const enTanda = elegibles.filter(p =>
          evaluarCondicion(
            resolverAtributo(p, esquema.criterio_tanda_atributo),
            tanda.condicion.operador,
            tanda.condicion.valor,
            tanda.condicion.valor2
          )
        );
        totalGrupos += calcularCantidadGrupos(enTanda.length, esquema.modo_tamano, esquema.valor_tamano);
      }
    }

    if (totalGrupos > lista.length) {
      const error = new Error(`Los nombres se agotan: se generarían ${totalGrupos} grupos pero la lista solo tiene ${lista.length} nombres.`);
      error.status = 422; throw error;
    }
  }

  return db.transaction(async (trx) => {
    // Leer excluidos ANTES de borrar
    const excluidosAdmin = await repo.listarExcluidosAdmin(esquemaId, trx);
    const idsExcluidosAdmin = new Set(excluidosAdmin.map(e => e.participante_id));

    // Recién ahora borrar todo lo generado anteriormente
    await repo.eliminarGruposDeEsquema(esquemaId, trx);
    await repo.eliminarPendientesDeEsquema(esquemaId, trx);

    // Restaurar excluidos_admin en pendientes
    const filasPendientesAdmin = excluidosAdmin.map(e => ({
      esquema_id: esquemaId,
      participante_id: e.participante_id,
      motivo: 'excluido_admin',
    }));

    const participantes = await obtenerUniversoBase(esquema, eventoId);
    const elegibles = aplicarFiltros(participantes, esquema, idsExcluidosAdmin);

    const pendientes = [];
    const gruposParaInsertar = [];
    const integrantesParaInsertar = [];

    let indiceGlobalGrupo = 0;

    const procesarConjunto = (conjunto, tandaId, nombreTanda) => {
      if (conjunto.length === 0) return;

      const cantGrupos = calcularCantidadGrupos(conjunto.length, esquema.modo_tamano, esquema.valor_tamano);
      const subgrupos = distribuir(conjunto, cantGrupos, esquema.balanceo_atributo);

      subgrupos.forEach((integrantes, idxEnTanda) => {
        let nombre;
        try {
          nombre = generarNombreGrupo({
            modoNombrado: esquema.modo_nombrado,
            lista,
            accionSinNombres: esquema.accion_sin_nombres,
            indiceGlobal: indiceGlobalGrupo,
            nombreTanda,
            indiceEnTanda: idxEnTanda,
          });
        } catch (e) {
          if (e.message === 'NOMBRES_AGOTADOS') throw e;
          nombre = `Grupo ${indiceGlobalGrupo + 1}`;
        }

        gruposParaInsertar.push({
          org_id: esquema.org_id,
          evento_id: eventoId,
          esquema_id: esquemaId,
          tanda_id: tandaId ?? null,
          nombre,
          orden_global: indiceGlobalGrupo,
        });

        // Guardamos los integrantes para asignarlos después de insertar los grupos (necesitamos el id)
        integrantesParaInsertar.push(integrantes.map(p => p.id));
        indiceGlobalGrupo++;
      });
    };

    if (tandas.length === 0) {
      // Sin tandas: todo el universo elegible como un solo conjunto
      procesarConjunto(elegibles, null, null);

    } else {
      const clasificados = new Set();

      for (const tanda of tandas) {
        const enTanda = elegibles.filter(p => {
          const val = resolverAtributo(p, esquema.criterio_tanda_atributo);
          return evaluarCondicion(val, tanda.condicion.operador, tanda.condicion.valor, tanda.condicion.valor2);
        });

        enTanda.forEach(p => clasificados.add(p.id));
        procesarConjunto(enTanda, tanda.id, tanda.nombre_resuelto ?? `Tanda ${tanda.orden + 1}`);
      }

      // Sin clasificar
      const sinClasificar = elegibles.filter(p => !clasificados.has(p.id));
      sinClasificar.forEach(p => pendientes.push({ esquema_id: esquemaId, participante_id: p.id, motivo: 'sin_clasificar' }));
    }

    // Agregar excluidos por sistema
    const idsElegibles = new Set(elegibles.map(p => p.id));
    const excluidosSistema = participantes
      .filter(p => !idsElegibles.has(p.id) && !idsExcluidosAdmin.has(p.id))
      .map(p => ({
        esquema_id: esquemaId,
        participante_id: p.id,
        motivo: 'excluido_sistema',
      }));
    pendientes.push(...excluidosSistema);

    // Insertar grupos y asignar integrantes
    const gruposInsertados = await repo.crearGruposTrabajo(gruposParaInsertar, trx);

    const filasMiembros = [];
    gruposInsertados.forEach((grupo, i) => {
      (integrantesParaInsertar[i] ?? []).forEach(participanteId => {
        filasMiembros.push({ grupo_trabajo_id: grupo.id, participante_id: participanteId });
      });
    });

    if (filasMiembros.length > 0) {
      await repo.agregarIntegrantes(filasMiembros, trx);
    }

    // Insertar pendientes (sin_clasificar + excluidos_admin)
    const todosLosPendientes = [...pendientes, ...filasPendientesAdmin];
    if (todosLosPendientes.length > 0) {
      await repo.agregarPendientes(todosLosPendientes, trx);
    }

    // Actualizar estado del esquema
    await repo.actualizarEsquema(esquemaId, {
      estado: 'generado',
      generado_en: new Date(),
    }, trx);

    invalidar(`grupos_trabajo:${esquemaId}`);
    invalidar(`pendientes:${esquemaId}`);
    invalidar(`esquema:${esquemaId}`);

    return {
      gruposGenerados: gruposInsertados.length,
      pendientes: todosLosPendientes.length,
    };
  });
}

// ─── AJUSTES MANUALES ────────────────────────────────────────────────────────

async function asignarAGrupo(eventoId, esquemaId, grupoId, participanteId, orgId) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const grupo = await repo.buscarGrupoPorId(grupoId);
  if (!grupo || grupo.esquema_id !== esquemaId) {
    const error = new Error('Grupo no encontrado en este esquema'); error.status = 404; throw error;
  }

  invalidar(`grupos_trabajo:${esquemaId}`);
  invalidar(`pendientes:${esquemaId}`);
  return db.transaction(async (trx) => {
    // Si está en otro grupo del mismo esquema, moverlo
    const grupos = await trx('grupo_trabajo').where({ esquema_id: esquemaId }).select('id');
    for (const g of grupos) {
      const integrante = await repo.buscarIntegrante(g.id, participanteId, trx);
      if (integrante && g.id !== grupoId) {
        await repo.eliminarIntegrante(g.id, participanteId, trx);
        break;
      }
    }

    // Quitar de pendientes si estaba
    await repo.eliminarPendiente(esquemaId, participanteId, trx);

    // Agregar al grupo destino
    await repo.agregarIntegrantes([{ grupo_trabajo_id: grupoId, participante_id: participanteId }], trx);
  });
}

async function quitarDeGrupo(eventoId, esquemaId, grupoId, participanteId, orgId) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);

  return db.transaction(async (trx) => {
    await repo.eliminarIntegrante(grupoId, participanteId, trx);
    await repo.agregarPendientes([{
      esquema_id: esquemaId,
      participante_id: participanteId,
      motivo: 'retirado_manual',
    }], trx);
  });
}

async function listarGrupos(eventoId, esquemaId, orgId) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  return getOrSet(`grupos_trabajo:${esquemaId}`, async () => {
    const grupos = await repo.listarGruposPorEsquema(esquemaId);

    // Desencriptar DNI de cada integrante
    return grupos.map(g => ({
      ...g,
      integrantes: g.integrantes.map(i => {
        let dniLegible = i.dni;
        try { dniLegible = desencriptar(i.dni); } catch { }
        return { ...i, dni: dniLegible };
      }),
    }));
  });
}

async function listarPendientes(eventoId, esquemaId, orgId) {
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const pendientes = await repo.listarPendientesPorEsquema(esquemaId);

  return pendientes.map(p => {
    let dniLegible = p.dni;
    try { dniLegible = desencriptar(p.dni); } catch { }
    return { ...p, dni: dniLegible };
  });
}

function obtenerPresets() {
  return Object.entries(PRESETS).map(([key, valores]) => ({ key, valores }));
}

function normalizarValor(valor) {
  if (valor === null || valor === undefined) return '__sin_valor__';
  if (typeof valor !== 'string') return String(valor);
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .trim();
}

async function generarExcelGrupos(eventoId, esquemaId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const evento = await eventosRepository.buscarPorId(eventoId);
  const grupos = await repo.listarGruposPorEsquema(esquemaId);

  // Desencriptar DNIs
  const gruposConDni = grupos.map(g => ({
    ...g,
    integrantes: g.integrantes.map(i => {
      let dniLegible = i.dni;
      try { dniLegible = desencriptar(i.dni); } catch { }
      return { ...i, dni: dniLegible };
    }),
  }));

  // Traer todos los participantes del evento para la hoja 1
  const participantes = await db('participante')
    .leftJoin(
      db('grupo_trabajo_participante')
        .join('grupo_trabajo', 'grupo_trabajo.id', 'grupo_trabajo_participante.grupo_trabajo_id')
        .where('grupo_trabajo.esquema_id', esquemaId)
        .select('grupo_trabajo_participante.participante_id', 'grupo_trabajo.nombre as grupo_trabajo_nombre')
        .as('gtp'),
      'gtp.participante_id', 'participante.id'
    )
    .leftJoin('checkin', 'checkin.participante_id', 'participante.id')
    .where('participante.evento_id', eventoId)
    .where('participante.activo', true)
    .select(
      'participante.id',
      'participante.nombre',
      'participante.apellido',
      'participante.dni',
      'participante.nacimiento',
      'participante.estado_pago',
      'gtp.grupo_trabajo_nombre',
      db.raw('(checkin.id IS NOT NULL) as acreditado'),
    )
    .orderBy('participante.apellido', 'asc');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Talita Encuentros';
  workbook.created = new Date();

  // ─── HOJA 1: Listado completo ─────────────────────────────────────────────
  const sheet1 = workbook.addWorksheet('Participantes');

  const COL_START = 2;
  const HEADER_ROW = 2;
  const DATA_START_ROW = 3;

  const columnas = [
    { header: 'Apellido', key: 'apellido' },
    { header: 'Nombre', key: 'nombre' },
    { header: 'DNI', key: 'dni' },
    { header: 'Fecha de nacimiento', key: 'nacimiento' },
    { header: 'Edad', key: 'edad' },
    { header: 'Estado de pago', key: 'estado_pago' },
    { header: 'Grupo de trabajo', key: 'grupo_trabajo_nombre' },
    { header: 'Acreditado', key: 'acreditado' },
  ];

  sheet1.columns = [
    { key: '_spacer', width: 3 },
    ...columnas.map(({ key }) => ({ key, width: 20 })),
  ];

  sheet1.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  const BORDE = { style: 'thin', color: { argb: 'FF000000' } };
  const BORDE_GRUESO = { style: 'medium', color: { argb: 'FF000000' } };

  const lastRow1 = participantes.length ? DATA_START_ROW + participantes.length - 1 : HEADER_ROW;
  const lastCol1 = COL_START + columnas.length - 1;

  sheet1.autoFilter = {
    from: { row: HEADER_ROW, column: COL_START },
    to: { row: HEADER_ROW, column: lastCol1 },
  };

  // Headers hoja 1
  columnas.forEach((col, i) => {
    const cell = sheet1.getCell(HEADER_ROW, COL_START + i);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.border = { top: BORDE, left: BORDE, right: BORDE, bottom: BORDE };
    cell.alignment = { horizontal: 'center' };
  });

  // Datos hoja 1
  participantes.forEach((p, idx) => {
    let dniLegible = p.dni;
    try { dniLegible = desencriptar(p.dni); } catch { }

    const rowNumber = DATA_START_ROW + idx;
    const fila = {
      apellido: p.apellido,
      nombre: p.nombre,
      dni: dniLegible,
      nacimiento: p.nacimiento ? new Date(p.nacimiento) : null,
      edad: calcularEdad(p.nacimiento),
      estado_pago: ESTADO_PAGO_LABELS[p.estado_pago] ?? p.estado_pago,
      grupo_trabajo_nombre: p.grupo_trabajo_nombre ?? 'Sin grupo',
      acreditado: p.acreditado ? 'Sí' : 'No',
    };

    columnas.forEach((col, i) => {
      const cell = sheet1.getCell(rowNumber, COL_START + i);
      cell.value = fila[col.key] ?? null;
      cell.font = { name: 'Arial', size: 10 };
      cell.border = { left: BORDE, right: BORDE };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      }
    });
  });

  sheet1.getColumn(COL_START + 3).numFmt = 'dd/mm/yyyy';

  const MIN_WIDTH = 10;
  const MAX_WIDTH = 55;

  columnas.forEach((col, i) => {
    const colIndex = COL_START + i;
    let maxLen = col.header.length;
    sheet1.getColumn(colIndex).eachCell({ includeEmpty: false }, (cell, rowNum) => {
      if (rowNum === HEADER_ROW) return;
      const valor = cell.value;
      const largo = valor instanceof Date ? 10 : String(valor ?? '').length;
      if (largo > maxLen) maxLen = largo;
    });
    sheet1.getColumn(colIndex).width = Math.min(Math.max(maxLen + 4, MIN_WIDTH), MAX_WIDTH);
  });

  // Borde grueso perimetral hoja 1
  for (let r = HEADER_ROW; r <= lastRow1; r++) {
    for (let c = COL_START; c <= lastCol1; c++) {
      const cell = sheet1.getCell(r, c);
      const actual = cell.border || {};
      cell.border = {
        top: r === HEADER_ROW ? BORDE_GRUESO : actual.top,
        bottom: r === lastRow1 ? BORDE_GRUESO : actual.bottom,
        left: c === COL_START ? BORDE_GRUESO : actual.left,
        right: c === lastCol1 ? BORDE_GRUESO : actual.right,
      };
    }
  }

  // ─── HOJA 2: Grupos ───────────────────────────────────────────────────────
  const sheet2 = workbook.addWorksheet('Grupos');

  // Layout: 2 columnas de grupos (col B y col D), separadas por col C vacía
  // Cada grupo: header en negrita, luego integrantes, luego fila vacía entre grupos
  const COL_GRUPO_1 = 2; // B
  const COL_GRUPO_2 = 4; // D

  let currentRow = 2;
  let colIdx = 0; // 0 = columna izquierda, 1 = columna derecha

  // Calcular la fila de inicio de cada grupo
  // Procesamos de a pares
  for (let i = 0; i < gruposConDni.length; i += 2) {
    const grupoIzq = gruposConDni[i];
    const grupoDer = gruposConDni[i + 1] ?? null;

    const startRow = currentRow;

    // Header grupo izquierdo
    const headerIzq = sheet2.getCell(currentRow, COL_GRUPO_1);
    headerIzq.value = `Grupo ${grupoIzq.nombre}`;
    headerIzq.font = { bold: true };
    headerIzq.border = { top: BORDE_GRUESO, left: BORDE_GRUESO, right: BORDE_GRUESO, bottom: BORDE_GRUESO };

    // Header grupo derecho
    if (grupoDer) {
      const headerDer = sheet2.getCell(currentRow, COL_GRUPO_2);
      headerDer.value = `Grupo ${grupoDer.nombre}`;
      headerDer.font = { bold: true }; // ← headerDer, no headerIzq
      headerDer.border = { top: BORDE_GRUESO, left: BORDE_GRUESO, right: BORDE_GRUESO, bottom: BORDE_GRUESO }; // ← headerDer
    }

    currentRow++;

    // Integrantes — usar el máximo de los dos grupos para saber cuántas filas ocupar
    const maxIntegrantes = Math.max(
      grupoIzq.integrantes.length,
      grupoDer?.integrantes.length ?? 0
    );

    for (let j = 0; j < maxIntegrantes; j++) {
      const integranteIzq = grupoIzq.integrantes[j];
      const integranteDer = grupoDer?.integrantes[j];
      const esUltimoIzq = j === grupoIzq.integrantes.length - 1;
      const esUltimoDer = j === (grupoDer?.integrantes.length ?? 0) - 1;

      if (integranteIzq) {
        const cell = sheet2.getCell(currentRow, COL_GRUPO_1);
        cell.value = `${integranteIzq.nombre} ${integranteIzq.apellido}`;
        cell.font = { name: 'Arial', size: 10 };
        cell.border = {
          left: BORDE_GRUESO,
          right: BORDE_GRUESO,
          bottom: esUltimoIzq ? BORDE_GRUESO : undefined,
        };
        if (j % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
        }
      }

      if (integranteDer) {
        const cell = sheet2.getCell(currentRow, COL_GRUPO_2);
        cell.value = `${integranteDer.nombre} ${integranteDer.apellido}`;
        cell.font = { name: 'Arial', size: 10 };
        cell.border = {
          left: BORDE_GRUESO,
          right: BORDE_GRUESO,
          bottom: esUltimoDer ? BORDE_GRUESO : undefined,
        };
        if (j % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
        }
      }

      currentRow++;
    }

    // Fila vacía entre pares de grupos
    currentRow++;
  }

  // Ancho de columnas hoja 2
  sheet2.getColumn(COL_GRUPO_1).width = 30;
  sheet2.getColumn(3).width = 5; // separador
  sheet2.getColumn(COL_GRUPO_2).width = 30;

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer,
    nombreArchivo: `grupos_${esquema.nombre.replace(/\s+/g, '_')}_${evento.codigo}.xlsx`,
  };
}

async function generarExcelGrupoIndividual(eventoId, esquemaId, grupoId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  await verificarEsquemaDeLaOrg(esquemaId, orgId);
  const evento = await eventosRepository.buscarPorId(eventoId);

  const grupo = await repo.buscarGrupoPorId(grupoId);
  if (!grupo || grupo.esquema_id !== esquemaId) {
    const error = new Error('Grupo no encontrado en este esquema');
    error.status = 404; throw error;
  }

  const integrantes = await db('grupo_trabajo_participante')
    .join('participante', 'participante.id', 'grupo_trabajo_participante.participante_id')
    .leftJoin('checkin', 'checkin.participante_id', 'participante.id')
    .where('grupo_trabajo_participante.grupo_trabajo_id', grupoId)
    .select(
      'participante.id',
      'participante.nombre',
      'participante.apellido',
      'participante.dni',
      'participante.nacimiento',
      'participante.estado_pago',
      db.raw('(checkin.id IS NOT NULL) as acreditado'),
    )
    .orderBy('participante.apellido', 'asc');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Talita Encuentros';
  workbook.created = new Date();

  const COL_START = 2;
  const HEADER_ROW = 2;
  const DATA_START_ROW = 3;
  const BORDE = { style: 'thin', color: { argb: 'FF000000' } };
  const BORDE_GRUESO = { style: 'medium', color: { argb: 'FF000000' } };

  // ─── HOJA 1: Listado ──────────────────────────────────────────────────────
  const sheet1 = workbook.addWorksheet('Participantes');

  const columnas = [
    { header: 'Apellido', key: 'apellido' },
    { header: 'Nombre', key: 'nombre' },
    { header: 'DNI', key: 'dni' },
    { header: 'Fecha de nacimiento', key: 'nacimiento' },
    { header: 'Edad', key: 'edad' },
    { header: 'Estado de pago', key: 'estado_pago' },
    { header: 'Acreditado', key: 'acreditado' },
  ];

  sheet1.columns = [
    { key: '_spacer', width: 3 },
    ...columnas.map(({ key }) => ({ key, width: 20 })),
  ];

  sheet1.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  // Título del grupo
  const titleCell = sheet1.getCell(1, COL_START);
  titleCell.value = `Grupo ${grupo.nombre} — ${evento.nombre}`;
  titleCell.font = { bold: true, name: 'Arial', size: 13 };

  sheet1.autoFilter = {
    from: { row: HEADER_ROW, column: COL_START },
    to: { row: HEADER_ROW, column: COL_START + columnas.length - 1 },
  };

  // Headers
  columnas.forEach((col, i) => {
    const cell = sheet1.getCell(HEADER_ROW, COL_START + i);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.border = { top: BORDE, left: BORDE, right: BORDE, bottom: BORDE };
    cell.alignment = { horizontal: 'center' };
  });

  // Datos
  integrantes.forEach((p, idx) => {
    let dniLegible = p.dni;
    try { dniLegible = desencriptar(p.dni); } catch { }

    const rowNumber = DATA_START_ROW + idx;
    const fila = {
      apellido: p.apellido,
      nombre: p.nombre,
      dni: dniLegible,
      nacimiento: p.nacimiento ? new Date(p.nacimiento) : null,
      edad: calcularEdad(p.nacimiento),
      estado_pago: ESTADO_PAGO_LABELS[p.estado_pago] ?? p.estado_pago,
      acreditado: p.acreditado ? 'Sí' : 'No',
    };

    columnas.forEach((col, i) => {
      const cell = sheet1.getCell(rowNumber, COL_START + i);
      cell.value = fila[col.key] ?? null;
      cell.font = { name: 'Arial', size: 10 };
      cell.border = { left: BORDE, right: BORDE };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      }
    });
  });

  sheet1.getColumn(COL_START + 3).numFmt = 'dd/mm/yyyy';

  const MIN_WIDTH = 10;
  const MAX_WIDTH = 55;

  columnas.forEach((col, i) => {
    const colIndex = COL_START + i;
    let maxLen = col.header.length;
    sheet1.getColumn(colIndex).eachCell({ includeEmpty: false }, (cell, rowNum) => {
      if (rowNum === HEADER_ROW) return;
      const valor = cell.value;
      const largo = valor instanceof Date ? 10 : String(valor ?? '').length;
      if (largo > maxLen) maxLen = largo;
    });
    sheet1.getColumn(colIndex).width = Math.min(Math.max(maxLen + 4, MIN_WIDTH), MAX_WIDTH);
  });

  // Borde grueso perimetral
  const lastRow = integrantes.length ? DATA_START_ROW + integrantes.length - 1 : HEADER_ROW;
  const lastCol = COL_START + columnas.length - 1;
  for (let r = HEADER_ROW; r <= lastRow; r++) {
    for (let c = COL_START; c <= lastCol; c++) {
      const cell = sheet1.getCell(r, c);
      const actual = cell.border || {};
      cell.border = {
        top: r === HEADER_ROW ? BORDE_GRUESO : actual.top,
        bottom: r === lastRow ? BORDE_GRUESO : actual.bottom,
        left: c === COL_START ? BORDE_GRUESO : actual.left,
        right: c === lastCol ? BORDE_GRUESO : actual.right,
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer,
    nombreArchivo: `grupo_${grupo.nombre}_${evento.codigo}.xlsx`,
  };
}

/**
 * Envía mail de asignación de grupo a UN participante puntual.
 */
async function enviarMailAsignacion(eventoId, esquemaId, participanteId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await verificarEsquemaDeLaOrg(esquemaId, orgId);

  if (esquema.estado !== 'generado') {
    const error = new Error('El esquema todavía no fue generado');
    error.status = 400; throw error;
  }

  const evento = await eventosRepository.buscarPorId(eventoId);

  // Buscar en qué grupo está el participante
  const resultado = await db('grupo_trabajo_participante')
    .join('grupo_trabajo', 'grupo_trabajo.id', 'grupo_trabajo_participante.grupo_trabajo_id')
    .join('participante', 'participante.id', 'grupo_trabajo_participante.participante_id')
    .where('grupo_trabajo.esquema_id', esquemaId)
    .where('grupo_trabajo_participante.participante_id', participanteId)
    .select(
      'participante.nombre',
      'participante.apellido',
      'participante.email',
      'grupo_trabajo.nombre as grupo_nombre',
    )
    .first();

  if (!resultado) {
    const error = new Error('El participante no está asignado a ningún grupo de este esquema');
    error.status = 404; throw error;
  }

  const { subject, html } = templateAsignacionGrupo({
    participante: { nombre: resultado.nombre, apellido: resultado.apellido },
    grupo: { nombre: resultado.grupo_nombre },
    esquema: { nombre: esquema.nombre },
    evento,
  });

  await enviarMail({ to: resultado.email, subject, html });
}

/**
 * Envía mail de asignación de grupo a TODOS los participantes del esquema.
 * Fire and forget — no bloquea, pero reporta errores por consola.
 */
async function enviarMailAsignacionMasivo(eventoId, esquemaId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  const esquema = await verificarEsquemaDeLaOrg(esquemaId, orgId);

  if (esquema.estado !== 'generado') {
    const error = new Error('El esquema todavía no fue generado');
    error.status = 400; throw error;
  }

  const evento = await eventosRepository.buscarPorId(eventoId);

  const asignaciones = await db('grupo_trabajo_participante')
    .join('grupo_trabajo', 'grupo_trabajo.id', 'grupo_trabajo_participante.grupo_trabajo_id')
    .join('participante', 'participante.id', 'grupo_trabajo_participante.participante_id')
    .where('grupo_trabajo.esquema_id', esquemaId)
    .select(
      'participante.nombre',
      'participante.apellido',
      'participante.email',
      'grupo_trabajo.nombre as grupo_nombre',
    );

  // Enviar en lote, fire and forget
  let enviados = 0;
  let errores = 0;

  for (const a of asignaciones) {
    try {
      const { subject, html } = templateAsignacionGrupo({
        participante: { nombre: a.nombre, apellido: a.apellido },
        grupo: { nombre: a.grupo_nombre },
        esquema: { nombre: esquema.nombre },
        evento,
      });
      await enviarMail({ to: a.email, subject, html });
      enviados++;
    } catch (err) {
      console.error(`[grupos] Error al enviar mail a ${a.email}:`, err.message);
      errores++;
    }
  }

  return { enviados, errores, total: asignaciones.length };
}

module.exports = {
  crearEsquema,
  listarEsquemas,
  obtenerEsquema,
  editarEsquema,
  eliminarEsquema,
  crearTanda,
  editarTanda,
  eliminarTanda,
  reordenarTandas,
  excluirParticipantes,
  quitarExcluido,
  preview,
  generar,
  asignarAGrupo,
  quitarDeGrupo,
  listarGrupos,
  listarPendientes,
  obtenerPresets,
  normalizarValor,
  generarExcelGrupos,
  generarExcelGrupoIndividual,
  enviarMailAsignacion,
  enviarMailAsignacionMasivo
};