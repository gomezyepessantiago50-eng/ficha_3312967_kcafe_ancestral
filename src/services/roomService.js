const { sequelize }      = require('../database/connection');
const { QueryTypes } = require('sequelize');

const findAllRooms = async () => {
  return await sequelize.query(
    `SELECT h.IDHabitacion, h.NombreHabitacion, h.IDCabana, h.Estado, h.ImagenHabitacion,
            c.Nombre AS NombreCabaña
     FROM Habitacion h
     LEFT JOIN Cabanas c ON h.IDCabana = c.IDCabana
     ORDER BY h.NombreHabitacion ASC`,
    { type: QueryTypes.SELECT }
  );
};

const findRoomById = async (id) => {
  const [habitacion] = await sequelize.query(
    `SELECT h.IDHabitacion, h.NombreHabitacion, h.IDCabana, h.Estado, h.ImagenHabitacion,
            c.Nombre AS NombreCabaña
     FROM Habitacion h
     LEFT JOIN Cabanas c ON h.IDCabana = c.IDCabana
     WHERE h.IDHabitacion = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return habitacion || null;
};

const createRoom = async (data) => {
  const { NombreHabitacion, IDCabana } = data;
  const [result] = await sequelize.query(
    `INSERT INTO Habitacion (NombreHabitacion, IDCabana, Estado)
     VALUES (:nombre, :idCabana, true)`,
    {
      replacements: { nombre: NombreHabitacion, idCabana: IDCabana, imagen: data.ImagenHabitacion || null },
      type: QueryTypes.INSERT,
    }
  );
  return findRoomById(result);
};

const updateRoom = async (id, data) => {
  const existing = await findRoomById(id);
  if (!existing) return null;

  const { NombreHabitacion, IDCabana, ImagenHabitacion } = data;
  await sequelize.query(
    `UPDATE Habitacion
     SET NombreHabitacion = :nombre, IDCabana = :idCabana
         ${ImagenHabitacion !== undefined ? ', ImagenHabitacion = :imagen' : ''}
     WHERE IDHabitacion = :id`,
    {
      replacements: {
        id,
        nombre: NombreHabitacion ?? existing.NombreHabitacion,
        idCabana: IDCabana ?? existing.IDCabana,
        imagen: ImagenHabitacion ?? existing.ImagenHabitacion,
      },
      type: QueryTypes.UPDATE,
    }
  );

  return findRoomById(id);
};

const deleteRoom = async (id) => {
  const existing = await findRoomById(id);
  if (!existing) return null;

  await sequelize.query(
    'DELETE FROM Habitacion WHERE IDHabitacion = :id',
    { replacements: { id }, type: QueryTypes.DELETE }
  );
  return { deleted: true };
};

const changeStatus = async (id, Estado) => {
  const existing = await findRoomById(id);
  if (!existing) return null;

  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      'UPDATE Habitacion SET Estado = :estado WHERE IDHabitacion = :id',
      { replacements: { id, estado: Estado }, type: QueryTypes.UPDATE, transaction }
    );

    // Business Logic: If room becomes inactive, the parent Cabana also becomes inactive.
    if (!Estado) {
      await sequelize.query(
        'UPDATE Cabanas SET Estado = false WHERE IDCabana = :idCabana',
        { replacements: { idCabana: existing.IDCabana }, type: QueryTypes.UPDATE, transaction }
      );
    } else {
      // If room becomes active, check if all rooms in that cabana are active. 
      // Actually the user said "hasta que se vuelva a modificar el estado de la habitacion", 
      // let's just reactivate the cabana if ANY room is active, or if ALL are active.
      // Let's activate cabana if all its rooms are active.
      const inactiveRooms = await sequelize.query(
        'SELECT count(*) as count FROM Habitacion WHERE IDCabana = :idCabana AND Estado = false AND IDHabitacion != :id',
        { replacements: { idCabana: existing.IDCabana, id }, type: QueryTypes.SELECT, transaction }
      );
      if (inactiveRooms[0].count === 0) {
        await sequelize.query(
          'UPDATE Cabanas SET Estado = true WHERE IDCabana = :idCabana',
          { replacements: { idCabana: existing.IDCabana }, type: QueryTypes.UPDATE, transaction }
        );
      }
    }

    await transaction.commit();
    return findRoomById(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  findAllRooms,
  findRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  changeStatus,
};
