const { desencriptar } = require('./encryption');
const calcularEdad = require('./calcularEdad');

function sanitizarParticipante(participante, contexto = 'admin') {
  const tieneFicha = Boolean(participante.tiene_ficha_medica);
  const tieneAuto = Boolean(participante.tiene_autorizacion || participante.autorizacion_url);
  const tieneCert = Boolean(participante.tiene_certificado || participante.certificado_url);

  if (contexto === 'admin') {
    let dniLegible = participante.dni;
    try { dniLegible = desencriptar(participante.dni); } catch { }
    return {
      ...participante,
      dni: dniLegible,
      dni_hash: undefined,
      edad: calcularEdad(participante.nacimiento),
      tiene_ficha_medica: tieneFicha,
      tiene_autorizacion: tieneAuto,
      tiene_certificado: tieneCert,
    };
  }

  return {
    id: participante.id,
    nombre: participante.nombre,
    apellido: participante.apellido,
    nacimiento: participante.nacimiento,
    edad: calcularEdad(participante.nacimiento),
    estado_pago: participante.estado_pago,
    estado_vinculo: participante.estado_vinculo,
    rol_grupo: participante.rol_grupo,
    grupo_id: participante.grupo_id,
    tiene_ficha_medica: tieneFicha,
    tiene_autorizacion: tieneAuto,
    tiene_certificado: tieneCert,
    autorizacion_url: participante.autorizacion_url,
    certificado_url: participante.certificado_url,
  };
}

module.exports = sanitizarParticipante;