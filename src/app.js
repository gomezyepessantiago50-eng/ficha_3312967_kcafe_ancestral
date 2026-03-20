const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
const path         = require('path');
const { logger }   = require('./middlewares/logger');
const errorHandler = require('./errors/errorHandler');

// ─── Rutas ──────────────────────────────────────────────────────────────────
const clientRoutes = require('./routes/clientRoutes');
const roomRoutes   = require('./routes/roomRoutes');
// Los compañeros registran sus rutas aquí cuando estén listas:
// const reservaRoutes  = require('./routes/reservaRoutes');
// const servicioRoutes = require('./routes/servicioRoutes');
// const cabanaRoutes   = require('./routes/cabanaRoutes');
// const paqueteRoutes  = require('./routes/paqueteRoutes');
// const authRoutes     = require('./routes/authRoutes');

const app = express();

// ─── Middlewares globales ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(logger);
app.use(express.static(path.join(__dirname, 'public')));
// ─── Registro de rutas ───────────────────────────────────────────────────────
app.use('/api/clientes',     clientRoutes);
app.use('/api/habitaciones', roomRoutes);
// app.use('/api/reservas',     reservaRoutes);
// app.use('/api/servicios',    servicioRoutes);
// app.use('/api/cabanas',      cabanaRoutes);
// app.use('/api/paquetes',     paqueteRoutes);
// app.use('/api/auth',         authRoutes);

// ─── Ruta base — sirve el index.html ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ─── Ruta no encontrada (404) ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada.`,
  });
});

// ─── Manejador global de errores ─────────────────────────────────────────────
// Debe ir siempre de último
app.use(errorHandler);

module.exports = app;
