// src/app.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const { errorHandler, notFound } = require('./middlewares/error.middleware');

const app = express();

// ── Middlewares globales ─────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/habitaciones', require('./routes/roomRoutes'));
app.use('/api/paquetes',     require('./routes/packageRoutes'));
app.use('/api/servicios',    require('./routes/serviceRoutes'));

// ── Manejo de rutas no encontradas ───────────────────────────
app.use(notFound);

// ── Manejador global de errores ──────────────────────────────
app.use(errorHandler);

module.exports = app;
