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
    .notEmpty().withMessage('El Nombre es obligatorio.')
    .isString().withMessage('El Nombre debe ser texto.')
    .isLength({ min: 2, max: 50 }).withMessage('El Nombre debe tener entre 2 y 50 caracteres.'),

  body('Apellido')
    .notEmpty().withMessage('El Apellido es obligatorio.')
    .isString().withMessage('El Apellido debe ser texto.')
    .isLength({ min: 2, max: 50 }).withMessage('El Apellido debe tener entre 2 y 50 caracteres.'),

  body('Email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('El Email no tiene un formato válido.')
    .isLength({ max: 50 }).withMessage('El Email no puede superar los 50 caracteres.'),

  body('Telefono')
    .notEmpty().withMessage('El Teléfono es obligatorio.')
    .isString().withMessage('El Telefono debe ser texto.')
    .isLength({ max: 50 }).withMessage('El Telefono no puede superar los 50 caracteres.'),

  body('Direccion')
    .optional({ checkFalsy: true })
    .isString().withMessage('La Direccion debe ser texto.')
    .isLength({ max: 50 }).withMessage('La Direccion no puede superar los 50 caracteres.'),

  body('Pais')
    .notEmpty().withMessage('La Nacionalidad (País) es obligatoria.')
    .isString().withMessage('El Pais debe ser texto.')
    .isLength({ max: 100 }).withMessage('El Pais no puede superar los 100 caracteres.'),

  body('TipoDocumento')
    .optional({ checkFalsy: true })
    .isIn(['CC', 'TI', 'CE', 'PASAPORTE'])
    .withMessage('TipoDocumento debe ser CC, TI, CE o PASAPORTE.'),
];

const validateUpdateClient = [...updateClientRules, handleValidationErrors];

module.exports = { validateUpdateClient };