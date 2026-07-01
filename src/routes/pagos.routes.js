const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Crear sesión de checkout de Stripe (requiere token de autenticación)
router.post('/stripe/checkout', verifyToken, pagosController.crearCheckoutSession);

// Retorno exitoso de Stripe
router.get('/stripe/success', pagosController.stripeSuccess);

module.exports = router;
