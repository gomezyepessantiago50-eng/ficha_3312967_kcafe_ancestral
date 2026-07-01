const { sequelize }      = require('../database/connection');
const { QueryTypes } = require('sequelize');

const findAllCabanas = async () => {
  return await sequelize.query(
    `SELECT IDCabana, NombreCabana AS Nombre, Descripcion, Capacidad AS CapacidadMaxima, NumeroHabitaciones, PrecioNoche AS Costo, Estado, ImagenCabana, ImagenHabitacion, Ubicacion
     FROM cabanas
     ORDER BY NombreCabana ASC`,
    { type: QueryTypes.SELECT }
  );
};

const findCabanaById = async (id) => {
  const [cabana] = await sequelize.query(
    `SELECT IDCabana, NombreCabana AS Nombre, Descripcion, Capacidad AS CapacidadMaxima, NumeroHabitaciones, PrecioNoche AS Costo, Estado, ImagenCabana, ImagenHabitacion, Ubicacion
     FROM cabanas WHERE IDCabana = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return cabana || null;
};

const createCabana = async ({ Nombre, Descripcion, CapacidadMaxima, NumeroHabitaciones, Costo, Estado = 1, ImagenCabana = null, ImagenHabitacion = null, Ubicacion = null }) => {
  const transaction = await sequelize.transaction();
  try {
    const [result] = await sequelize.query(
      `INSERT INTO cabanas (NombreCabana, Descripcion, Capacidad, NumeroHabitaciones, PrecioNoche, Estado, ImagenCabana, ImagenHabitacion, Ubicacion)
       VALUES (:nombre, :descripcion, :capacidad, :numHabitaciones, :costo, :estado, :imagenCabana, :imagenHabitacion, :ubicacion)`,
      {
        replacements: {
          nombre: Nombre,
          descripcion: Descripcion,
          capacidad: CapacidadMaxima,
          numHabitaciones: NumeroHabitaciones || 1,
          costo: Costo,
          estado: Estado,
          imagenCabana: ImagenCabana,
          imagenHabitacion: ImagenHabitacion,
          ubicacion: Ubicacion,
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
       SET NombreCabana = :nombre, Descripcion = :descripcion, Capacidad = :capacidad, NumeroHabitaciones = :numHabitaciones,
           PrecioNoche = :costo, Estado = :estado, ImagenCabana = :imagenCabana, ImagenHabitacion = :imagenHabitacion, Ubicacion = :ubicacion
       WHERE IDCabana = :id`,
      {
        replacements: {
          id,
          nombre: Nombre,
          descripcion: data.Descripcion ?? existing.Descripcion,
          capacidad: data.CapacidadMaxima ?? existing.CapacidadMaxima,
          numHabitaciones: data.NumeroHabitaciones ?? existing.NumeroHabitaciones,
          costo: data.Costo ?? existing.Costo,
          estado: Estado,
          imagenCabana: data.ImagenCabana !== undefined ? data.ImagenCabana : existing.ImagenCabana,
          imagenHabitacion: data.ImagenHabitacion !== undefined ? data.ImagenHabitacion : existing.ImagenHabitacion,
          ubicacion: data.Ubicacion !== undefined ? data.Ubicacion : existing.Ubicacion,
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
