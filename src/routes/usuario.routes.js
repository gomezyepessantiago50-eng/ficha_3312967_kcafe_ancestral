// src/routes/usuario.routes.js
'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/usuario.controller');
const { verifyToken, soloAdmin } = require('../middlewares/auth.middleware');

// Todas las rutas requieren token + ser admin
router.use(verifyToken, soloAdmin);

// ── GET  /api/usuarios?email=xxx  → buscar por correo ────────
router.get('/',       ctrl.listarUsuarios);
router.get('/buscar', ctrl.buscarPorEmail);

// ── PUT  /api/usuarios/:id/rol   → cambiar rol ───────────────
router.put('/:id/rol', ctrl.cambiarRol);

// ── POST /api/usuarios/:id/reset → generar reset password ────
router.post('/:id/reset', ctrl.generarReset);

// ── DELETE /api/usuarios/:id    → eliminar cuenta ────────────
router.delete('/:id', ctrl.eliminarCuenta);

module.exports = router;
