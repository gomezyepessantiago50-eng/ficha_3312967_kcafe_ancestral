// src/routes/auth.routes.js
'use strict';

const router         = require('express').Router();
const AuthController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const {
  validar,
  registroRules,
  loginRules,
  recuperarRules,
  resetRules,
} = require('../validators/auth.validator');

// ── POST /api/auth/registro ───────────────────────────────────
// Crea una nueva cuenta de usuario
router.post('/registro',
  registroRules,
  validar,
  AuthController.registro
);

// ── POST /api/auth/login ──────────────────────────────────────
// Inicia sesión y devuelve un JWT
router.post('/login',
  loginRules,
  validar,
  AuthController.login
);

// ── POST /api/auth/logout ─────────────────────────────────────
// Cierra sesión (revoca el token)
router.post('/logout',
  verifyToken,
  AuthController.logout
);

// ── POST /api/auth/recuperar ──────────────────────────────────
// Envía token de recuperación de contraseña
router.post('/recuperar',
  recuperarRules,
  validar,
  AuthController.recuperarPassword
);

// ── POST /api/auth/reset-password ────────────────────────────
// Restablece la contraseña con el token de recuperación
router.post('/reset-password',
  resetRules,
  validar,
  AuthController.resetPassword
);

// ── GET /api/auth/perfil ──────────────────────────────────────
// Devuelve el perfil del usuario autenticado
router.get('/perfil',
  verifyToken,
  AuthController.perfil
);

module.exports = router;
