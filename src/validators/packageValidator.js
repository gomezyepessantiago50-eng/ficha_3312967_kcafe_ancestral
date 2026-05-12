const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Errores de validación.', errors: errors.array() });
  }
  next();
};

const createPackageRules = [
  body('NombrePaquete')
    .notEmpty().withMessage('El NombrePaquete es obligatorio.')
    .isString()
    .isLength({ max: 30 }).withMessage('El NombrePaquete no puede superar 30 caracteres.'),
  body('Descripcion')
    .notEmpty().withMessage('La Descripcion es obligatoria.')
    .isString(),
  body('Precio')
    .notEmpty().withMessage('El Precio es obligatorio.')
    .isFloat({ min: 0.01 }).withMessage('El Precio debe ser mayor a 0.'),
];

const updatePackageRules = [
  body('NombrePaquete').optional().isString().isLength({ max: 30 }),
  body('Descripcion').optional().isString(),
  body('Precio').optional().isFloat({ min: 0.01 }).withMessage('El Precio debe ser mayor a 0.'),
];

const packageStatusRules = [
  body('Estado').notEmpty().withMessage('El Estado es obligatorio.').isBoolean(),
];

const validateCreatePackage = [...createPackageRules, handleValidationErrors];
const validateUpdatePackage = [...updatePackageRules, handleValidationErrors];
const validatePackageStatus = [...packageStatusRules, handleValidationErrors];

module.exports = { validateCreatePackage, validateUpdatePackage, validatePackageStatus };
