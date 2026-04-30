const { Habitacion, Cabanas } = require('../models');

/**
 * Retorna todas las habitaciones
 */
const findAllRooms = async () => {
  return Habitacion.findAll({
    attributes: ['IDHabitacion', 'NombreHabitacion', 'Descripcion', 'Costo', 'Estado'],
    order:      [['NombreHabitacion', 'ASC']],
  });
};

/**
 * Retorna una habitación por ID, incluyendo sus cabañas
 * @param {number} id
 */
const findRoomById = async (id) => {
  return Habitacion.findByPk(id, {
    attributes: ['IDHabitacion', 'NombreHabitacion', 'Descripcion', 'Costo', 'Estado'],
    include: [
      {
        model:      Cabanas,
        as:         'cabanas',
        attributes: ['IDCabana', 'NombreCabana', 'Capacidad', 'Ubicacion', 'PrecioNoche', 'Estado'],
      },
    ],
  });
};

/**
 * Crea una nueva habitación con Estado=true por defecto
 * @param {object} data — { NombreHabitacion, Descripcion, Costo }
 */
const createRoom = async (data) => {
  const { NombreHabitacion, Descripcion, Costo } = data;
  return Habitacion.create({
    NombreHabitacion,
    Descripcion,
    Costo,
    Estado: true,
  });
};

/**
 * Actualiza datos generales de una habitación
 * @param {number} id
 * @param {object} data
 */
const updateRoom = async (id, data) => {
  const habitacion = await Habitacion.findByPk(id);
  if (!habitacion) return null;

  const { NombreHabitacion, Descripcion, Costo } = data;
  await habitacion.update({
    ...(NombreHabitacion && { NombreHabitacion }),
    ...(Descripcion      && { Descripcion }),
    ...(Costo            && { Costo }),
  });

  return habitacion;
};

/**
 * Elimina una habitación si no tiene cabañas activas
 * Retorna: { deleted: true } | { deleted: false, reason: string } | null (no encontrada)
 * @param {number} id
 */
const deleteRoom = async (id) => {
  const habitacion = await Habitacion.findByPk(id, {
    include: [{ model: Cabanas, as: 'cabanas', attributes: ['IDCabana', 'Estado'] }],
  });

  if (!habitacion) return null;

  const cabanasActivas = habitacion.cabanas?.filter((c) => c.Estado === true);
  if (cabanasActivas && cabanasActivas.length > 0) {
    return { deleted: false, reason: 'Tiene cabañas activas asociadas.' };
  }

  await habitacion.destroy();
  return { deleted: true };
};

/**
 * Cambia el estado de una habitación (true/false)
 * @param {number} id
 * @param {boolean} Estado
 */
const changeStatus = async (id, Estado) => {
  const habitacion = await Habitacion.findByPk(id);
  if (!habitacion) return null;

  await habitacion.update({ Estado });
  return habitacion;
};

module.exports = {
  findAllRooms,
  findRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  changeStatus,
};
