const { sequelize }      = require('../database/connection');
const { QueryTypes } = require('sequelize');

const findAllPackages = async () => {
  return await sequelize.query(
    `SELECT p.IDPaquete, p.NombrePaquete, p.Descripcion, p.Precio, p.Estado,
            p.IDHabitacion, p.IDServicio,
            h.NombreHabitacion,
            s.NombreServicio
     FROM paquetes p
     LEFT JOIN habitacion h ON p.IDHabitacion = h.IDHabitacion
     LEFT JOIN servicios  s ON p.IDServicio   = s.IDServicio
     ORDER BY p.NombrePaquete ASC`,
    { type: QueryTypes.SELECT }
  );
};

const findPackageById = async (id) => {
  const [paquete] = await sequelize.query(
    `SELECT p.IDPaquete, p.NombrePaquete, p.Descripcion, p.Precio, p.Estado,
            p.IDHabitacion, p.IDServicio,
            h.NombreHabitacion,
            s.NombreServicio
     FROM paquetes p
     LEFT JOIN habitacion h ON p.IDHabitacion = h.IDHabitacion
     LEFT JOIN servicios  s ON p.IDServicio   = s.IDServicio
     WHERE p.IDPaquete = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return paquete || null;
};

const createPackage = async ({ NombrePaquete, Descripcion, IDHabitacion, IDServicio, Precio, Estado = 1 }) => {
  const [result] = await sequelize.query(
    `INSERT INTO paquetes (NombrePaquete, Descripcion, IDHabitacion, IDServicio, Precio, Estado)
     VALUES (:nombre, :descripcion, :habitacion, :servicio, :precio, :estado)`,
    {
      replacements: {
        nombre:      NombrePaquete,
        descripcion: Descripcion,
        habitacion:  IDHabitacion || null,
        servicio:    IDServicio   || null,
        precio:      Precio,
        estado:      Estado,
      },
      type: QueryTypes.INSERT,
    }
  );
  return findPackageById(result);
};

const updatePackage = async (id, { NombrePaquete, Descripcion, IDHabitacion, IDServicio, Precio }) => {
  const existing = await findPackageById(id);
  if (!existing) return null;

  await sequelize.query(
    `UPDATE paquetes
     SET NombrePaquete = :nombre,
         Descripcion   = :descripcion,
         IDHabitacion  = :habitacion,
         IDServicio    = :servicio,
         Precio        = :precio
     WHERE IDPaquete = :id`,
    {
      replacements: {
        id,
        nombre:      NombrePaquete ?? existing.NombrePaquete,
        descripcion: Descripcion   ?? existing.Descripcion,
        habitacion:  IDHabitacion  ?? existing.IDHabitacion,
        servicio:    IDServicio    ?? existing.IDServicio,
        precio:      Precio        ?? existing.Precio,
      },
      type: QueryTypes.UPDATE,
    }
  );
  return findPackageById(id);
};

const changePackageStatus = async (id, Estado) => {
  const existing = await findPackageById(id);
  if (!existing) return null;
  await sequelize.query(
    'UPDATE paquetes SET Estado = :estado WHERE IDPaquete = :id',
    { replacements: { id, estado: Estado }, type: QueryTypes.UPDATE }
  );
  return findPackageById(id);
};

const deletePackage = async (id) => {
  const existing = await findPackageById(id);
  if (!existing) return null;
  await sequelize.query(
    'DELETE FROM paquetes WHERE IDPaquete = :id',
    { replacements: { id }, type: QueryTypes.DELETE }
  );
  return { deleted: true };
};

module.exports = { findAllPackages, findPackageById, createPackage, updatePackage, changePackageStatus, deletePackage };
