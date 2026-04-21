// app.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');  // ← AGREGAR ESTA
require('dotenv').config();

const { errorHandler, notFound } = require('./middlewares/error.middleware');

const app = express();

// ── Middlewares globales ─────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Servir frontend estático ─────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));  // ← AGREGAR ESTA

// ── Ruta de salud ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));  // ← CAMBIAR ESTA
});

// ── Rutas de la API ──────────────────────────────────────────
app.use('/api/reservas', require('./routes/reserva.routes'));

// app.use('/api/cabanas',   require('./routes/cabana.routes'));
// app.use('/api/paquetes',  require('./routes/paquete.routes'));
// app.use('/api/servicios', require('./routes/servicio.routes'));
// app.use('/api/clientes',  require('./routes/cliente.routes'));
// app.use('/api/usuarios',  require('./routes/usuario.routes'));
// app.use('/api/auth',      require('./routes/auth.routes'));

// ── Login temporal para pruebas ──────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  // Admin demo
  if (email === 'admin@kafeancestral.com' && password === 'admin123') {
    return res.json({
      ok: true,
      token: 'token-admin-demo',
      usuario: { nombre: 'Administrador', email, rol: 'admin' }
    });
  }

  // Cliente demo
  if (email === 'cliente@demo.com' && password === '123456') {
    return res.json({
      ok: true,
      token: 'token-cliente-demo',
      usuario: { nombre: 'Cliente Demo', email, rol: 'cliente' }
    });
  }

  // Token demo para selección de rol
  if (email === 'demo' && password === 'demo') {
    const rol = req.body.rol || 'cliente';
    return res.json({
      ok: true,
      token: 'token-demo',
      usuario: { nombre: rol === 'admin' ? 'Admin Demo' : 'Cliente Demo', email: 'demo@demo.com', rol }
    });
  }

  return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas' });
});

// ── Manejo de rutas no encontradas ───────────────────────────
app.use(notFound);

// ── Manejador global de errores ──────────────────────────────
app.use(errorHandler);

module.exports = app;