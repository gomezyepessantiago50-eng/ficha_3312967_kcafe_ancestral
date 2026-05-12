const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Errores de validación.', errors: errors.array() });
  }
  next();
};

const createServiceRules = [
  body('NombreServicio')
    .notEmpty().withMessage('El NombreServicio es obligatorio.')
    .isString()
    .isLength({ max: 30 }).withMessage('El NombreServicio no puede superar 30 caracteres.'),
  body('Descripcion')
    .notEmpty().withMessage('La Descripcion es obligatoria.')
    .isString()
    .isLength({ max: 50 }),
  body('CantidadMaximaPersonas')
    .notEmpty().withMessage('La CantidadMaximaPersonas es obligatoria.')
    .isInt({ min: 1 }).withMessage('Debe ser un número entero mayor a 0.'),
  body('Costo')
    .notEmpty().withMessage('El Costo es obligatorio.')
    .isFloat({ min: 0.01 }).withMessage('El Costo debe ser mayor a 0.'),
];

const updateServiceRules = [
  body('NombreServicio').optional().isString().isLength({ max: 30 }),
  body('Descripcion').optional().isString().isLength({ max: 50 }),
  body('CantidadMaximaPersonas').optional().isInt({ min: 1 }),
  body('Costo').optional().isFloat({ min: 0.01 }),
  body('Duracion').optional().isString().isLength({ max: 50 }),
];

const serviceStatusRules = [
  body('Estado').notEmpty().withMessage('El Estado es obligatorio.').isBoolean(),
];

const validateCreateService = [...createServiceRules, handleValidationErrors];
const validateUpdateService = [...updateServiceRules, handleValidationErrors];
const validateServiceStatus = [...serviceStatusRules, handleValidationErrors];

module.exports = { validateCreateService, validateUpdateService, validateServiceStatus };
