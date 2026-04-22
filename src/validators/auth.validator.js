// src/validators/auth.validator.js
'use strict';

const { body, validationResult } = require('express-validator');

// ── Middleware para procesar errores de validación ────────────
const validar = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({
      ok:      false,
      mensaje: 'Datos de entrada inválidos.',
      errores: errores.array().map(e => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
};

// ── Reglas de validación ──────────────────────────────────────
const registroRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres.'),

  body('apellido')
    .trim()
    .notEmpty().withMessage('El apellido es obligatorio.')
    .isLength({ min: 2, max: 100 }).withMessage('El apellido debe tener entre 2 y 100 caracteres.'),

  body('email')
    .trim()
    .notEmpty().withMessage('El correo electrónico es obligatorio.')
    .isEmail().withMessage('Correo electrónico inválido.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria.')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.')
    .matches(/\d/).withMessage('La contraseña debe contener al menos un número.'),

  body('telefono')
    .optional()
    .trim()
    .isLength({ min: 7, max: 20 }).withMessage('Número de teléfono inválido (7-20 caracteres).'),

  body('idRol')
    .optional()
    .isInt({ min: 1, max: 2 }).withMessage('Rol inválido.'),
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo electrónico es obligatorio.')
    .isEmail().withMessage('Correo electrónico inválido.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria.'),
];

const recuperarRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo electrónico es obligatorio.')
    .isEmail().withMessage('Correo electrónico inválido.')
    .normalizeEmail(),
];

const resetRules = [
  body('token')
    .trim()
    .notEmpty().withMessage('El token es obligatorio.'),

  body('nuevaPassword')
    .notEmpty().withMessage('La nueva contraseña es obligatoria.')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.')
    .matches(/\d/).withMessage('La contraseña debe contener al menos un número.'),
];

module.exports = {
  validar,
  registroRules,
  loginRules,
  recuperarRules,
  resetRules,
};
