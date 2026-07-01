// src/app.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const { errorHandler, notFound } = require('./middlewares/error.middleware');

const app = express();

// ── Middlewares globales ─────────────────────────────────────
app.use(cors());

// Webhook de Stripe necesita el body crudo ANTES de express.json
const pagosController = require('./controllers/pagos.controller');
app.post('/api/pagos/stripe/webhook', express.raw({ type: 'application/json' }), pagosController.stripeWebhook);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Rutas principales (ANTES de express.static) ──────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.get('/cliente', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/cliente.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ── Servir frontend estático ──────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Rutas de la API ───────────────────────────────────────────
app.use('/api/reservas',     require('./routes/reserva.routes'));
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/usuarios',     require('./routes/usuario.routes'));
app.use('/api/dashboard',    require('./routes/dashboardRoutes'));
app.use('/api/cabanas',      require('./routes/cabanaRoutes'));
app.use('/api/clientes',     require('./routes/clientRoutes'));

app.use('/api/paquetes',     require('./routes/packageRoutes'));
app.use('/api/servicios',    require('./routes/serviceRoutes'));
app.use('/api/pagos',        require('./routes/pagos.routes'));

// ── Manejo de rutas no encontradas ───────────────────────────
app.use(notFound);

// ── Manejador global de errores ──────────────────────────────
app.use(errorHandler);

module.exports = app;
