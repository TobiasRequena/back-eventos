const service = require('../services/gruposTrabajo.service');

async function listarEsquemas(req, res, next) {
  try {
    const esquemas = await service.listarEsquemas(req.params.eventoId, req.orgId);
    res.status(200).json({ esquemas });
  } catch (error) { next(error); }
}

async function crearEsquema(req, res, next) {
  try {
    const esquema = await service.crearEsquema(
      req.params.eventoId, req.orgId, req.usuario.sub, req.body
    );
    res.status(201).json({ esquema });
  } catch (error) { next(error); }
}

async function obtenerEsquema(req, res, next) {
  try {
    const esquema = await service.obtenerEsquema(
      req.params.eventoId, req.params.esquemaId, req.orgId
    );
    res.status(200).json({ esquema });
  } catch (error) { next(error); }
}

async function editarEsquema(req, res, next) {
  try {
    const esquema = await service.editarEsquema(
      req.params.eventoId, req.params.esquemaId, req.orgId, req.body
    );
    res.status(200).json({ esquema });
  } catch (error) { next(error); }
}

async function eliminarEsquema(req, res, next) {
  try {
    await service.eliminarEsquema(
      req.params.eventoId, req.params.esquemaId, req.orgId
    );
    res.status(204).send();
  } catch (error) { next(error); }
}

// ─── TANDAS ──────────────────────────────────────────────────────────────────

async function crearTanda(req, res, next) {
  try {
    const tanda = await service.crearTanda(
      req.params.eventoId, req.params.esquemaId, req.orgId, req.body
    );
    res.status(201).json({ tanda });
  } catch (error) { next(error); }
}

async function editarTanda(req, res, next) {
  try {
    const tanda = await service.editarTanda(
      req.params.eventoId, req.params.esquemaId, req.params.tandaId, req.orgId, req.body
    );
    res.status(200).json({ tanda });
  } catch (error) { next(error); }
}

async function eliminarTanda(req, res, next) {
  try {
    await service.eliminarTanda(
      req.params.eventoId, req.params.esquemaId, req.params.tandaId, req.orgId
    );
    res.status(204).send();
  } catch (error) { next(error); }
}

async function reordenarTandas(req, res, next) {
  try {
    await service.reordenarTandas(
      req.params.eventoId, req.params.esquemaId, req.orgId, req.body.tandas
    );
    res.status(200).json({ ok: true });
  } catch (error) { next(error); }
}

// ─── EXCLUIDOS ───────────────────────────────────────────────────────────────

async function excluirParticipantes(req, res, next) {
  try {
    await service.excluirParticipantes(
      req.params.eventoId, req.params.esquemaId, req.orgId, req.body.participanteIds
    );
    res.status(200).json({ ok: true });
  } catch (error) { next(error); }
}

async function quitarExcluido(req, res, next) {
  try {
    await service.quitarExcluido(
      req.params.eventoId, req.params.esquemaId, req.params.participanteId, req.orgId
    );
    res.status(204).send();
  } catch (error) { next(error); }
}

// ─── PREVIEW ─────────────────────────────────────────────────────────────────

async function preview(req, res, next) {
  try {
    const resultado = await service.preview(
      req.params.eventoId, req.params.esquemaId, req.orgId
    );
    res.status(200).json(resultado);
  } catch (error) { next(error); }
}

// ─── GENERACIÓN ──────────────────────────────────────────────────────────────

async function generar(req, res, next) {
  try {
    const resultado = await service.generar(
      req.params.eventoId, req.params.esquemaId, req.orgId
    );
    res.status(200).json(resultado);
  } catch (error) { next(error); }
}

// ─── GRUPOS Y PENDIENTES ─────────────────────────────────────────────────────

async function listarGrupos(req, res, next) {
  try {
    const grupos = await service.listarGrupos(
      req.params.eventoId, req.params.esquemaId, req.orgId
    );
    res.status(200).json({ grupos });
  } catch (error) { next(error); }
}

async function listarPendientes(req, res, next) {
  try {
    const pendientes = await service.listarPendientes(
      req.params.eventoId, req.params.esquemaId, req.orgId
    );
    res.status(200).json({ pendientes });
  } catch (error) { next(error); }
}

async function asignarAGrupo(req, res, next) {
  try {
    await service.asignarAGrupo(
      req.params.eventoId, req.params.esquemaId, req.params.grupoId,
      req.body.participanteId, req.orgId
    );
    res.status(200).json({ ok: true });
  } catch (error) { next(error); }
}

async function quitarDeGrupo(req, res, next) {
  try {
    await service.quitarDeGrupo(
      req.params.eventoId, req.params.esquemaId, req.params.grupoId,
      req.params.participanteId, req.orgId
    );
    res.status(200).json({ ok: true });
  } catch (error) { next(error); }
}

// ─── PRESETS ─────────────────────────────────────────────────────────────────

async function obtenerPresets(req, res, next) {
  try {
    const presets = service.obtenerPresets();
    res.status(200).json({ presets });
  } catch (error) { next(error); }
}

// ─── EXCEL ─────────────────────────────────────────────────────────────────

async function descargarExcelGrupos(req, res, next) {
  try {
    const { buffer, nombreArchivo } = await service.generarExcelGrupos(
      req.params.eventoId,
      req.params.esquemaId,
      req.orgId
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(buffer);
  } catch (error) { next(error); }
}

async function descargarExcelGrupoIndividual(req, res, next) {
  try {
    const { buffer, nombreArchivo } = await service.generarExcelGrupoIndividual(
      req.params.eventoId,
      req.params.esquemaId,
      req.params.grupoId,
      req.orgId
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(buffer);
  } catch (error) { next(error); }
}

// ─── MAIL ─────────────────────────────────────────────────────────────────
async function enviarMailAsignacion(req, res, next) {
  try {
    await service.enviarMailAsignacion(
      req.params.eventoId,
      req.params.esquemaId,
      req.params.participanteId,
      req.orgId
    );
    res.status(200).json({ ok: true });
  } catch (error) { next(error); }
}

async function enviarMailAsignacionPorGrupo(req, res, next) {
  try {
    const resultado = await service.enviarMailAsignacionPorGrupo(
      req.params.eventoId,
      req.params.esquemaId,
      req.params.grupoId,
      req.orgId
    );
    res.status(200).json(resultado);
  } catch (error) { next(error); }
}

async function enviarMailAsignacionMasivo(req, res, next) {
  try {
    const resultado = await service.enviarMailAsignacionMasivo(
      req.params.eventoId,
      req.params.esquemaId,
      req.orgId
    );
    res.status(200).json(resultado);
  } catch (error) { next(error); }
}

module.exports = {
  listarEsquemas,
  crearEsquema,
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
  listarGrupos,
  listarPendientes,
  asignarAGrupo,
  quitarDeGrupo,
  obtenerPresets,
  descargarExcelGrupos,
  descargarExcelGrupoIndividual,
  enviarMailAsignacion,
  enviarMailAsignacionPorGrupo,
  enviarMailAsignacionMasivo,
};