const { sequelize }      = require('../database/connection');
const { QueryTypes } = require('sequelize');

const findAllCabanas = async () => {
  return await sequelize.query(
    `SELECT IDCabana, NombreCabana AS Nombre, Descripcion, Ubicacion, Capacidad AS CapacidadMaxima, NumeroHabitaciones, PrecioNoche AS Costo, Estado, ImagenCabana, ImagenHabitacion
     FROM cabanas
     ORDER BY NombreCabana ASC`,
    { type: QueryTypes.SELECT }
  );
};

const findCabanaById = async (id) => {
  const [cabana] = await sequelize.query(
    `SELECT IDCabana, NombreCabana AS Nombre, Descripcion, Ubicacion, Capacidad AS CapacidadMaxima, NumeroHabitaciones, PrecioNoche AS Costo, Estado, ImagenCabana, ImagenHabitacion
     FROM cabanas WHERE IDCabana = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return cabana || null;
};

const createCabana = async ({ Nombre, Descripcion, Ubicacion, CapacidadMaxima, NumeroHabitaciones, Costo, Estado = 1, ImagenCabana = null, ImagenHabitacion = null }) => {
  const transaction = await sequelize.transaction();
  try {
    const [result] = await sequelize.query(
      `INSERT INTO cabanas (NombreCabana, Descripcion, Ubicacion, Capacidad, NumeroHabitaciones, PrecioNoche, Estado, ImagenCabana, ImagenHabitacion)
       VALUES (:nombre, :descripcion, :ubicacion, :capacidad, :numHabitaciones, :costo, :estado, :imagenCabana, :imagenHabitacion)`,
      {
        replacements: {
          nombre: Nombre,
          descripcion: Descripcion,
          ubicacion: Ubicacion || null,
          capacidad: CapacidadMaxima,
          numHabitaciones: NumeroHabitaciones || 1,
          costo: Costo,
          estado: Estado,
          imagenCabana: ImagenCabana,
          imagenHabitacion: ImagenHabitacion,
        },
        type: QueryTypes.INSERT,
        transaction
      }
    );
    
    const newId = result;
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
    const Estado = data.Estado ?? existing.Estado;

    await sequelize.query(
      `UPDATE cabanas
       SET NombreCabana = :nombre, Descripcion = :descripcion, Ubicacion = :ubicacion, Capacidad = :capacidad, NumeroHabitaciones = :numHabitaciones,
           PrecioNoche = :costo, Estado = :estado, ImagenCabana = :imagenCabana, ImagenHabitacion = :imagenHabitacion
       WHERE IDCabana = :id`,
      {
        replacements: {
          id,
          nombre: Nombre,
          descripcion: data.Descripcion ?? existing.Descripcion,
          ubicacion: data.Ubicacion !== undefined ? data.Ubicacion : existing.Ubicacion,
          capacidad: data.CapacidadMaxima ?? existing.CapacidadMaxima,
          numHabitaciones: data.NumeroHabitaciones ?? existing.NumeroHabitaciones,
          costo: data.Costo ?? existing.Costo,
          estado: Estado,
          imagenCabana: data.ImagenCabana !== undefined ? data.ImagenCabana : existing.ImagenCabana,
          imagenHabitacion: data.ImagenHabitacion !== undefined ? data.ImagenHabitacion : existing.ImagenHabitacion,
        },
        type: QueryTypes.UPDATE,
        transaction
      }
    );

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
    await sequelize.query(
      'DELETE FROM cabanas WHERE IDCabana = :id',
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
