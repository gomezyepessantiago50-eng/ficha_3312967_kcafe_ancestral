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
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres.')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El nombre solo puede contener letras.'),

  body('apellido')
    .trim()
    .notEmpty().withMessage('El apellido es obligatorio.')
    .isLength({ min: 2, max: 100 }).withMessage('El apellido debe tener entre 2 y 100 caracteres.')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El apellido solo puede contener letras.'),

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
    .isLength({ min: 7, max: 20 }).withMessage('Número de teléfono inválido (7-20 caracteres).')
    .matches(/^[0-9+\-\s]+$/).withMessage('El teléfono solo puede contener números, +, - y espacios.'),

  body('tipoDocumento')
    .trim()
    .notEmpty().withMessage('El tipo de documento es obligatorio.')
    .isIn(['CC', 'Pasaporte']).withMessage('Tipo de documento inválido. Debe ser CC o Pasaporte.'),

  body('numeroDocumento')
    .trim()
    .notEmpty().withMessage('El número de documento es obligatorio.')
    .isInt().withMessage('El número de documento debe contener solo números.'),

  body('pais')
    .trim()
    .notEmpty().withMessage('El país es obligatorio.')
    .isLength({ min: 2, max: 100 }).withMessage('El país debe tener entre 2 y 100 caracteres.'),

  body('idRol')
    .optional()
    .isInt({ min: 1, max: 2 }).withMessage('Rol inválido.'),

  body('otpCode')
    .trim()
    .notEmpty().withMessage('El código de verificación es obligatorio.')
    .isLength({ min: 6, max: 6 }).withMessage('El código debe tener 6 dígitos.'),
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

const sendOtpRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo electrónico es obligatorio.')
    .isEmail().withMessage('Correo electrónico inválido.')
    .normalizeEmail(),
  
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio.')
];

const updateProfileRules = [
  body('nombre')
    .optional()
    .trim()
    .notEmpty().withMessage('El nombre no puede estar vacío.')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres.')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El nombre solo puede contener letras.'),

  body('apellido')
    .optional()
    .trim()
    .notEmpty().withMessage('El apellido no puede estar vacío.')
    .isLength({ min: 2, max: 100 }).withMessage('El apellido debe tener entre 2 y 100 caracteres.')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El apellido solo puede contener letras.'),

  body('email')
    .optional()
    .trim()
    .notEmpty().withMessage('El correo electrónico no puede estar vacío.')
    .isEmail().withMessage('Correo electrónico inválido.')
    .normalizeEmail(),

  body('telefono')
    .optional()
    .trim()
    .isLength({ min: 7, max: 20 }).withMessage('Número de teléfono inválido (7-20 caracteres).')
    .matches(/^[0-9+\-\s]+$/).withMessage('El teléfono solo puede contener números, +, - y espacios.'),

  body('tipoDocumento')
    .optional()
    .trim()
    .notEmpty().withMessage('El tipo de documento no puede estar vacío.')
    .isIn(['CC', 'Pasaporte']).withMessage('Tipo de documento inválido. Debe ser CC o Pasaporte.'),

  body('numeroDocumento')
    .optional()
    .trim()
    .notEmpty().withMessage('El número de documento no puede estar vacío.')
    .matches(/^\d+$/).withMessage('El número de documento debe contener solo números.'),

  body('pais')
    .optional()
    .trim()
    .notEmpty().withMessage('El país no puede estar vacío.')
    .isLength({ min: 2, max: 100 }).withMessage('El país debe tener entre 2 y 100 caracteres.'),

  body('direccion')
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage('La dirección no puede superar los 150 caracteres.'),
];

module.exports = {
  validar,
  registroRules,
  sendOtpRules,
  loginRules,
  recuperarRules,
  resetRules,
  updateProfileRules,
};
