const { sequelize }      = require('../database/connection');
const { QueryTypes } = require('sequelize');

const findAllCabanas = async () => {
  return await sequelize.query(
    `SELECT IDCabana, Nombre, Descripcion, CapacidadMaxima, NumeroHabitaciones, Costo, Estado
     FROM Cabanas
     ORDER BY Nombre ASC`,
    { type: QueryTypes.SELECT }
  );
};

const findCabanaById = async (id) => {
  const [cabana] = await sequelize.query(
    `SELECT IDCabana, Nombre, Descripcion, CapacidadMaxima, NumeroHabitaciones, Costo, Estado
     FROM Cabanas WHERE IDCabana = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return cabana || null;
};

const createCabana = async ({ Nombre, Descripcion, CapacidadMaxima, NumeroHabitaciones, Costo, Estado = 1 }) => {
  const transaction = await sequelize.transaction();
  try {
    const [result] = await sequelize.query(
      `INSERT INTO Cabanas (Nombre, Descripcion, CapacidadMaxima, NumeroHabitaciones, Costo, Estado)
       VALUES (:nombre, :descripcion, :capacidad, :numHab, :costo, :estado)`,
      {
        replacements: {
          nombre: Nombre,
          descripcion: Descripcion,
          capacidad: CapacidadMaxima,
          numHab: NumeroHabitaciones,
          costo: Costo,
          estado: Estado,
        },
        type: QueryTypes.INSERT,
        transaction
      }
    );
    
    const newId = result;
    
    // Create habitaciones automatically
    for (let i = 1; i <= NumeroHabitaciones; i++) {
      await sequelize.query(
        `INSERT INTO Habitacion (NombreHabitacion, IDCabana, Estado)
         VALUES (:nombreHab, :idCabana, :estado)`,
        {
          replacements: {
            nombreHab: `${Nombre} - Habitación ${i}`,
            idCabana: newId,
            estado: Estado
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );
    }
    
    await transaction.commit();
    return findCabanaById(newId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateCabana = async (id, data) => {
  const existing = await findCabanaById(id);
  if (!existing) return null;

  const transaction = await sequelize.transaction();
  try {
    const Nombre = data.Nombre ?? existing.Nombre;
    const NumeroHabitaciones = data.NumeroHabitaciones ?? existing.NumeroHabitaciones;
    const Estado = data.Estado ?? existing.Estado;

    await sequelize.query(
      `UPDATE Cabanas
       SET Nombre = :nombre, Descripcion = :descripcion, CapacidadMaxima = :capacidad,
           NumeroHabitaciones = :numHab, Costo = :costo, Estado = :estado
       WHERE IDCabana = :id`,
      {
        replacements: {
          id,
          nombre: Nombre,
          descripcion: data.Descripcion ?? existing.Descripcion,
          capacidad: data.CapacidadMaxima ?? existing.CapacidadMaxima,
          numHab: NumeroHabitaciones,
          costo: data.Costo ?? existing.Costo,
          estado: Estado,
        },
        type: QueryTypes.UPDATE,
        transaction
      }
    );

    // If NumeroHabitaciones increased, add new ones
    if (NumeroHabitaciones > existing.NumeroHabitaciones) {
      const diff = NumeroHabitaciones - existing.NumeroHabitaciones;
      for (let i = 1; i <= diff; i++) {
        const newRoomNumber = existing.NumeroHabitaciones + i;
        await sequelize.query(
          `INSERT INTO Habitacion (NombreHabitacion, IDCabana, Estado)
           VALUES (:nombreHab, :idCabana, :estado)`,
          {
            replacements: {
              nombreHab: `${Nombre} - Habitación ${newRoomNumber}`,
              idCabana: id,
              estado: Estado
            },
            type: QueryTypes.INSERT,
            transaction
          }
        );
      }
    }

    // If state changes, update all children rooms to match? The requirement said "if room becomes inactive, cabin becomes inactive". It didn't specify the reverse, but it's good practice. We'll leave it as is or update rooms to match.
    if (Estado !== existing.Estado) {
      await sequelize.query(
        `UPDATE Habitacion SET Estado = :estado WHERE IDCabana = :idCabana`,
        { replacements: { estado: Estado, idCabana: id }, type: QueryTypes.UPDATE, transaction }
      );
    }

    await transaction.commit();
    return findCabanaById(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteCabana = async (id) => {
  const existing = await findCabanaById(id);
  if (!existing) return null;

  const transaction = await sequelize.transaction();
  try {
    // Delete rooms first
    await sequelize.query(
      'DELETE FROM Habitacion WHERE IDCabana = :idCabana',
      { replacements: { idCabana: id }, type: QueryTypes.DELETE, transaction }
    );
    await sequelize.query(
      'DELETE FROM Cabanas WHERE IDCabana = :id',
      { replacements: { id }, type: QueryTypes.DELETE, transaction }
    );
    await transaction.commit();
    return { deleted: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = { findAllCabanas, findCabanaById, createCabana, updateCabana, deleteCabana };
