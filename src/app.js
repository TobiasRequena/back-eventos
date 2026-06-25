const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares globales
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck — útil para verificar que el server y Railway responden
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Acá van montándose las rutas de cada módulo a medida que las construyamos:
app.use('/api/v1/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/v1/organizaciones', require('./modules/organizaciones/routes/organizaciones.routes'));
// ...

// 404 para rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: { message: 'Recurso no encontrado' } });
});

// Manejo de errores (siempre al final)
app.use(errorHandler);

module.exports = app;