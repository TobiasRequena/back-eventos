const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');

async function generarCredencial({ qrPersonal, nombreEvento, nombreParticipante, dni, esReferente = false }) {
  // Renderizamos al doble de resolución para mejor calidad
  const SCALE = 2;
  const WIDTH = 400 * SCALE;
  const HEIGHT = 580 * SCALE;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Escalar todo
  ctx.scale(SCALE, SCALE);

  const W = 400;
  const H = 580;

  // Fondo blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Franja superior
  ctx.fillStyle = '#1E3A5F';
  ctx.fillRect(0, 0, W, 75);

  // Nombre del evento
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 17px Arial';
  ctx.textAlign = 'center';
  const nombreEventoCorto = nombreEvento.length > 32
    ? nombreEvento.slice(0, 32) + '...'
    : nombreEvento;
  ctx.fillText(nombreEventoCorto, W / 2, 30);

  ctx.font = '12px Arial';
  ctx.fillStyle = '#BFDBFE';
  ctx.fillText('Credencial de acceso', W / 2, 52);

  // QR
  const qrSize = 240;
  const qrDataUrl = await QRCode.toDataURL(qrPersonal, {
    width: qrSize * SCALE,
    margin: 1,
    color: { dark: '#1E3A5F', light: '#FFFFFF' },
  });
  const qrImage = await loadImage(qrDataUrl);
  ctx.drawImage(qrImage, (W - qrSize) / 2, 90, qrSize, qrSize);

  // Texto bajo el QR según si es referente o no
  ctx.font = '11px Arial';
  ctx.fillStyle = '#6B7280';
  ctx.textAlign = 'center';

  if (esReferente) {
    ctx.fillStyle = '#1E3A5F';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('⭐ Credencial de Referente', W / 2, 350);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#6B7280';
    ctx.fillText('Al escanear este QR se acredita', W / 2, 368);
    ctx.fillText('a vos y a todos los integrantes de tu grupo.', W / 2, 383);
  } else {
    ctx.fillText('Presentá este QR el día del evento', W / 2, 350);
    ctx.fillText('para acreditarte.', W / 2, 365);
  }

  // Separador
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 400);
  ctx.lineTo(360, 400);
  ctx.stroke();

  // Nombre
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 19px Arial';
  ctx.textAlign = 'center';
  const nombreCorto = nombreParticipante.length > 28
    ? nombreParticipante.slice(0, 28) + '...'
    : nombreParticipante;
  ctx.fillText(nombreCorto, W / 2, 435);

  // DNI
  ctx.fillStyle = '#6B7280';
  ctx.font = '13px Arial';
  ctx.fillText(`DNI: ${dni}`, W / 2, 460);

  // Pie
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '10px Arial';
  ctx.fillText('Presentá esta credencial el día del evento', W / 2, 530);

  return canvas.toBuffer('image/png');
}

module.exports = { generarCredencial };