const roomService = require('../services/roomService');

/**
 * GET /habitaciones
 * Lista todas las habitaciones
 */
const getAllRooms = async (req, res, next) => {
  try {
    const habitaciones = await roomService.findAllRooms();

    return res.status(200).json({
      success: true,
      data:    habitaciones,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /habitaciones/:id
 * Detalle de una habitación + cabañas asociadas
 */
const getRoomById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const habitacion = await roomService.findRoomById(id);

    if (!habitacion) {
      return res.status(404).json({
        success: false,
        message: 'Habitación no encontrada.',
      });
    }

    return res.status(200).json({
      success: true,
      data:    habitacion,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /habitaciones
 * Crea una nueva habitación (admin)
 */
const createRoom = async (req, res, next) => {
  try {
    const nuevaHabitacion = await roomService.createRoom(req.body);

    return res.status(201).json({
      success: true,
      message: 'Habitación creada correctamente.',
      data:    nuevaHabitacion,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /habitaciones/:id
 * Edita datos generales de una habitación (admin)
 */
const updateRoom = async (req, res, next) => {
  try {
    const { id } = req.params;

    const habitacion = await roomService.updateRoom(id, req.body);

    if (!habitacion) {
      return res.status(404).json({
        success: false,
        message: 'Habitación no encontrada.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Habitación actualizada correctamente.',
      data:    habitacion,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /habitaciones/:id
 * Elimina una habitación — falla si tiene cabañas activas
 */
const deleteRoom = async (req, res, next) => {
  try {
    const { id } = req.params;

    const resultado = await roomService.deleteRoom(id);

    if (!resultado) {
      return res.status(404).json({
        success: false,
        message: 'Habitación no encontrada.',
      });
    }

    if (!resultado.deleted) {
      return res.status(409).json({
        success: false,
        message: `No se puede eliminar: ${resultado.reason}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Habitación eliminada correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /habitaciones/:id/estado
 * Cambia el estado disponible/no disponible (admin)
 */
const changeRoomStatus = async (req, res, next) => {
  try {
    const { id }    = req.params;
    const { Estado } = req.body;

    const habitacion = await roomService.changeStatus(id, Estado);

    if (!habitacion) {
      return res.status(404).json({
        success: false,
        message: 'Habitación no encontrada.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Estado actualizado a ${Estado ? '"disponible"' : '"no disponible"'}.`,
      data:    habitacion,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  changeRoomStatus,
};
