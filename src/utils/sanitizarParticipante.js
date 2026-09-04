const { desencriptar } = require('./encryption');
const calcularEdad = require('./calcularEdad');

function sanitizarParticipante(participante, contexto = 'admin') {
  const tieneFicha = Boolean(participante.tiene_ficha_medica);
  const tieneAuto = Boolean(participante.tiene_autorizacion || participante.autorizacion_url);
  const tieneCert = Boolean(participante.tiene_certificado || participante.certificado_url);

  if (contexto === 'admin') {
    let dniLegible = participante.dni;
    try { dniLegible = desencriptar(participante.dni); } catch { }

    const {
      dni_hash,
      grupo_nombre,
      acreditador_nombre,
      acreditador_apellido,
      acreditado_en,
      ...resto
    } = participante;

    return {
      ...resto,
      dni: dniLegible,
      edad: calcularEdad(participante.nacimiento),
      tiene_ficha_medica: tieneFicha,
      tiene_autorizacion: tieneAuto,
      tiene_certificado: tieneCert,
      acreditado: participante.acreditado ?? false,
      acreditado_en: participante.acreditado_en ?? null,
      acreditador: participante.acreditador_nombre
        ? { nombre: participante.acreditador_nombre, apellido: participante.acreditador_apellido }
        : participante.acreditador ?? null,
      grupo: participante.grupo_nombre
        ? { id: participante.grupo_id, nombre: participante.grupo_nombre }
        : participante.grupo ?? null,
    };
  }
}

module.exports = sanitizarParticipante;