const { body, validationResult } = require('express-validator');

/**
 * Middleware que evalúa los errores de validación acumulados
 * y responde con 400 si existen.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación.',
      errors:  errors.array(),
    });
  }
  next();
};

// ─── Reglas para POST /habitaciones ─────────────────────────────────────────
const createRoomRules = [
  body('NombreHabitacion')
    .notEmpty().withMessage('El NombreHabitacion es obligatorio.')
    .isString().withMessage('El NombreHabitacion debe ser texto.')
    .isLength({ max: 30 }).withMessage('El NombreHabitacion no puede superar los 30 caracteres.'),

  body('Descripcion')
    .notEmpty().withMessage('La Descripcion es obligatoria.')
    .isString().withMessage('La Descripcion debe ser texto.')
    .isLength({ max: 50 }).withMessage('La Descripcion no puede superar los 50 caracteres.'),

  body('Costo')
    .notEmpty().withMessage('El Costo es obligatorio.')
    .isFloat({ min: 0.01 }).withMessage('El Costo debe ser un número mayor a 0.'),
];

// ─── Reglas para PUT /habitaciones/:id ──────────────────────────────────────
const updateRoomRules = [
  body('NombreHabitacion')
    .optional()
    .isString().withMessage('El NombreHabitacion debe ser texto.')
    .isLength({ max: 30 }).withMessage('El NombreHabitacion no puede superar los 30 caracteres.'),

  body('Descripcion')
    .optional()
    .isString().withMessage('La Descripcion debe ser texto.')
    .isLength({ max: 50 }).withMessage('La Descripcion no puede superar los 50 caracteres.'),

  body('Costo')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('El Costo debe ser un número mayor a 0.'),
];

// ─── Reglas para PATCH /habitaciones/:id/estado ──────────────────────────────
const roomStatusRules = [
  body('Estado')
    .notEmpty().withMessage('El campo Estado es obligatorio.')
    .isBoolean().withMessage('El Estado debe ser true o false.'),
];

const validateCreateRoom  = [...createRoomRules,  handleValidationErrors];
const validateUpdateRoom  = [...updateRoomRules,  handleValidationErrors];
const validateRoomStatus  = [...roomStatusRules,  handleValidationErrors];

module.exports = {
  validateCreateRoom,
  validateUpdateRoom,
  validateRoomStatus,
};
