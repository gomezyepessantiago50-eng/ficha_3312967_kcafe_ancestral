const { body, validationResult } = require('express-validator');

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

const updateClientRules = [
  body('Nombre')
    .optional()
    .isString().withMessage('El Nombre debe ser texto.')
    .isLength({ min: 2, max: 50 }).withMessage('El Nombre debe tener entre 2 y 50 caracteres.'),

  body('Apellido')
    .optional()
    .isString().withMessage('El Apellido debe ser texto.')
    .isLength({ min: 2, max: 50 }).withMessage('El Apellido debe tener entre 2 y 50 caracteres.'),

  body('Email')
    .optional()
    .isEmail().withMessage('El Email no tiene un formato válido.')
    .isLength({ max: 50 }).withMessage('El Email no puede superar los 50 caracteres.'),

  body('Telefono')
    .optional()
    .isString().withMessage('El Telefono debe ser texto.')
    .isLength({ max: 50 }).withMessage('El Telefono no puede superar los 50 caracteres.'),

  body('Direccion')
    .optional()
    .isString().withMessage('La Direccion debe ser texto.')
    .isLength({ max: 50 }).withMessage('La Direccion no puede superar los 50 caracteres.'),

  body('TipoDocumento')                              // ← adentro del arreglo
    .optional()
    .isIn(['CC', 'TI', 'CE', 'PASAPORTE'])
    .withMessage('TipoDocumento debe ser CC, TI, CE o PASAPORTE.'),
];

const validateUpdateClient = [...updateClientRules, handleValidationErrors];

module.exports = { validateUpdateClient };