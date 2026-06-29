const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorHandler = require('./middlewares/errorHandler');

const { routerAnidado: talleresAnidado, routerPlano: talleresPlano } = require('./modules/talleres/routes/talleres.routes');
const routerOrganizaciones = require('./modules/organizaciones/routes/organizaciones.routes');
const routerEventos = require('./modules/eventos/routes/eventos.routes');
const routerAuth = require('./modules/auth/routes/auth.routes');
const routerArchivos = require('./modules/archivos/routes/archivos.routes');

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
app.use('/api/v1/auth', routerAuth);
app.use('/api/v1/organizaciones', routerOrganizaciones);
app.use('/api/v1/eventos', routerEventos);
app.use('/api/v1/eventos', talleresAnidado);
app.use('/api/v1/talleres', talleresPlano);
app.use('/api/v1/archivos', routerArchivos);

// 404 para rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: { message: 'Recurso no encontrado' } });
});

// Manejo de errores (siempre al final)
app.use(errorHandler);

module.exports = app;