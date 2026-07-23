require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const { initSockets } = require('./src/sockets');
const { verificarConexion } = require('./src/config/db');
const { purgarEliminados } = require('./src/modules/participantes/repositories/participantes.repository');

// Purga automática de participantes eliminados hace más de 90 días
// Corre una vez al día al levantar el servidor y cada 24hs después
async function programarPurga() {
    const INTERVALO = 24 * 60 * 60 * 1000; // 24 horas en ms

    async function purgar() {
        try {
            const cantidad = await purgarEliminados();
            if (cantidad > 0) {
                console.log(`[purga] ${cantidad} participantes eliminados físicamente`);
            }
        } catch (err) {
            console.error('[purga] Error al purgar participantes:', err.message);
        }
    }

    await purgar(); // primera vez al levantar
    setInterval(purgar, INTERVALO);
}

const PORT = process.env.PORT || 3001;

async function iniciar() {
    await verificarConexion();
    programarPurga(); // sin await — corre en background

    const httpServer = http.createServer(app);
    initSockets(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
}

iniciar();