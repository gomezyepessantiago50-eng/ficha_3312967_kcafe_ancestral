// validators/reserva.validator.js
const { body, param } = require('express-validator');

const crearReservaValidator = [
  body('NroDocumentoCliente')
    .if(body('NroDocumentoCliente').exists())
    .notEmpty().withMessage('El documento del cliente es requerido')
    .isString().withMessage('El documento debe ser texto'),

  body('documento')
    .if(body('documento').exists())
    .notEmpty().withMessage('El documento del cliente es requerido')
    .isString().withMessage('El documento debe ser texto'),

  body('FechaInicio')
    .if(body('FechaInicio').exists())
    .notEmpty().withMessage('La fecha de inicio es requerida')
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value) => {
      const [year, month, day] = String(value).split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, day));
      const today = new Date();
      const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      if (start <= todayUtc) {
        throw new Error('La fecha de inicio debe ser a partir de mañana');
      }
      return true;
    }),

  body('fecha_inicio')
    .if(body('fecha_inicio').exists())
    .notEmpty().withMessage('La fecha de inicio es requerida')
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value) => {
      const [year, month, day] = String(value).split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, day));
      const today = new Date();
      const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      if (start <= todayUtc) {
        throw new Error('La fecha de inicio debe ser a partir de mañana');
      }
      return true;
    }),

  body('FechaFinalizacion')
    .if(body('FechaFinalizacion').exists())
    .notEmpty().withMessage('La fecha de finalización es requerida')
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const start = req.body.FechaInicio || req.body.fecha_inicio;
      if (new Date(value) <= new Date(start)) {
        throw new Error('La fecha de finalización debe ser posterior a la de inicio');
      }
      return true;
    }),

  body('fecha_fin')
    .if(body('fecha_fin').exists())
    .notEmpty().withMessage('La fecha de finalización es requerida')
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const start = req.body.FechaInicio || req.body.fecha_inicio;
      if (new Date(value) <= new Date(start)) {
        throw new Error('La fecha de finalización debe ser posterior a la de inicio');
      }
      return true;
    }),

  body('MetodoPago')
    .optional()
    .isString().withMessage('Método de pago inválido'),

  body('SubTotal')
    .optional()
    .isFloat({ min: 0 }).withMessage('SubTotal debe ser un número positivo'),

  body('Descuento')
    .optional()
    .isFloat({ min: 0 }).withMessage('Descuento debe ser un número positivo'),

  body('IVA')
    .optional()
    .isFloat({ min: 0 }).withMessage('IVA debe ser un número positivo'),
];

const editarReservaValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de reserva inválido'),

  body('FechaInicio')
    .optional()
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value) => {
      const [year, month, day] = String(value).split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, day));
      const today = new Date();
      const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      if (start <= todayUtc) {
        throw new Error('La fecha de inicio debe ser a partir de mañana');
      }
      return true;
    }),

  body('FechaFinalizacion')
    .optional()
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)'),

  body('MetodoPago')
    .optional()
    .isString().withMessage('Método de pago inválido'),
];

const idParamValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID inválido'),
];

const bloquearFechasValidator = [
  body('FechaInicio')
    .if(body('FechaInicio').exists())
    .notEmpty().withMessage('La fecha de inicio es requerida')
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)'),

  body('fecha_inicio')
    .if(body('fecha_inicio').exists())
    .notEmpty().withMessage('La fecha de inicio es requerida')
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)'),

  body('FechaFin')
    .if(body('FechaFin').exists())
    .notEmpty().withMessage('La fecha fin es requerida')
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const start = req.body.FechaInicio || req.body.fecha_inicio;
      if (new Date(value) < new Date(start)) {
        throw new Error('La fecha fin no puede ser anterior a la de inicio');
      }
      return true;
    }),

  body('fecha_fin')
    .if(body('fecha_fin').exists())
    .notEmpty().withMessage('La fecha fin es requerida')
    .isDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const start = req.body.FechaInicio || req.body.fecha_inicio;
      if (new Date(value) < new Date(start)) {
        throw new Error('La fecha fin no puede ser anterior a la de inicio');
      }
      return true;
    }),

  body('Motivo')
    .optional()
    .isString()
    .isLength({ max: 200 }).withMessage('Motivo máximo 200 caracteres'),
];

module.exports = {
  crearReservaValidator,
  editarReservaValidator,
  idParamValidator,
  bloquearFechasValidator,
};