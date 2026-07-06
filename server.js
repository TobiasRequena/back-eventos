require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const { initSockets } = require('./src/sockets');
const { verificarConexion } = require('./src/config/db');

const PORT = process.env.PORT || 3001;

async function iniciar() {
    await verificarConexion();

    const httpServer = http.createServer(app);
    initSockets(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
}

iniciar();