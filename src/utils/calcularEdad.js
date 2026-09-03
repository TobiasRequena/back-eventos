function calcularEdad(nacimiento) {
  if (!nacimiento) return null;

  const hoy = new Date();
  const nac = new Date(nacimiento);

  let edad = hoy.getFullYear() - nac.getFullYear();

  if (
    hoy < new Date(
      hoy.getFullYear(),
      nac.getMonth(),
      nac.getDate()
    )
  ) {
    edad--;
  }

  return edad;
}

module.exports = calcularEdad;