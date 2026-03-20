const express    = require('express');
const router     = express.Router();
const {
  getAllClients,
  searchClients,
  getClientById,
  getClientHistory,
  updateClient,
} = require('../controllers/clientController');

const { validateUpdateClient } = require('../validator/clientValidator');

// ─── Rutas de Clientes ──────────────────────────────────────────────────────

/**
 * GET /clientes
 * Lista todos los clientes (tabla con búsqueda opcional por query param)
 */
router.get('/', getAllClients);

/**
 * GET /clientes/search?q=texto
 * Busca clientes por nombre, apellido o correo
 */
router.get('/search', searchClients);

/**
 * GET /clientes/:nroDocumento
 * Perfil del cliente: info personal + historial de reservas
 */
router.get('/:nroDocumento', getClientById);

/**
 * GET /clientes/:nroDocumento/historial
 * Solo el historial de reservas del cliente
 */
router.get('/:nroDocumento/historial', getClientHistory);

/**
 * PUT /clientes/:nroDocumento
 * Actualiza los datos de contacto de un cliente (solo admin)
 */
router.put('/:nroDocumento', validateUpdateClient, updateClient);

module.exports = router;
