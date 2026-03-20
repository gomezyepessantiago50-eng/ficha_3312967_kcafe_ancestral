const express = require('express');
const router  = express.Router();
const {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  changeRoomStatus,
} = require('../controllers/roomController');

const {
  validateCreateRoom,
  validateUpdateRoom,
  validateRoomStatus,
} = require('../validator/roomValidator');

// ─── Rutas de Habitaciones ──────────────────────────────────────────────────

/**
 * GET /habitaciones
 * Lista todas las habitaciones
 */
router.get('/', getAllRooms);

/**
 * GET /habitaciones/:id
 * Detalle de una habitación + cabañas asociadas
 */
router.get('/:id', getRoomById);

/**
 * POST /habitaciones
 * Crea una nueva habitación (admin)
 */
router.post('/', validateCreateRoom, createRoom);

/**
 * PUT /habitaciones/:id
 * Edita datos generales de una habitación (admin)
 */
router.put('/:id', validateUpdateRoom, updateRoom);

/**
 * DELETE /habitaciones/:id
 * Elimina una habitación (admin) — falla si tiene cabañas activas
 */
router.delete('/:id', deleteRoom);

/**
 * PATCH /habitaciones/:id/estado
 * Cambia el estado disponible/no disponible (admin)
 */
router.patch('/:id/estado', validateRoomStatus, changeRoomStatus);

module.exports = router;
