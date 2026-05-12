const { sequelize }      = require('../database/connection');
const { QueryTypes } = require('sequelize');

const findAllPackages = async () => {
  return await sequelize.query(
    `SELECT p.IDPaquete, p.NombrePaquete, p.Descripcion, p.Precio, p.Estado,
            p.IDServicio, p.ServiciosIncluidos,
            s.NombreServicio
     FROM paquetes p
     LEFT JOIN servicios  s ON p.IDServicio   = s.IDServicio
     ORDER BY p.NombrePaquete ASC`,
    { type: QueryTypes.SELECT }
  );
};

const findPackageById = async (id) => {
  const [paquete] = await sequelize.query(
    `SELECT p.IDPaquete, p.NombrePaquete, p.Descripcion, p.Precio, p.Estado,
            p.IDServicio, p.ServiciosIncluidos,
            s.NombreServicio
     FROM paquetes p
     LEFT JOIN servicios  s ON p.IDServicio   = s.IDServicio
     WHERE p.IDPaquete = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return paquete || null;
};

const createPackage = async ({ NombrePaquete, Descripcion, IDServicio, ServiciosIncluidos, Precio, Estado = 1 }) => {
  const srvs = Array.isArray(ServiciosIncluidos) ? JSON.stringify(ServiciosIncluidos) : null;
  const [result] = await sequelize.query(
    `INSERT INTO paquetes (NombrePaquete, Descripcion, IDServicio, ServiciosIncluidos, Precio, Estado)
     VALUES (:nombre, :descripcion, :servicio, :serviciosIncluidos, :precio, :estado)`,
    {
      replacements: {
        nombre:      NombrePaquete,
        descripcion: Descripcion,
        servicio:    IDServicio   || null,
        serviciosIncluidos: srvs,
        precio:      Precio,
        estado:      Estado,
      },
      type: QueryTypes.INSERT,
    }
  );
  return findPackageById(result);
};

const updatePackage = async (id, { NombrePaquete, Descripcion, IDServicio, ServiciosIncluidos, Precio, Estado }) => {
  const existing = await findPackageById(id);
  if (!existing) return null;

  const srvs = ServiciosIncluidos !== undefined 
      ? (Array.isArray(ServiciosIncluidos) ? JSON.stringify(ServiciosIncluidos) : null) 
      : existing.ServiciosIncluidos;

  await sequelize.query(
    `UPDATE paquetes
     SET NombrePaquete = :nombre,
         Descripcion   = :descripcion,
         IDServicio    = :servicio,
         ServiciosIncluidos = :serviciosIncluidos,
         Precio        = :precio,
         Estado        = :estado
     WHERE IDPaquete = :id`,
    {
      replacements: {
        id,
        nombre:      NombrePaquete ?? existing.NombrePaquete,
        descripcion: Descripcion   ?? existing.Descripcion,
        servicio:    IDServicio    ?? existing.IDServicio,
        serviciosIncluidos: srvs,
        precio:      Precio        ?? existing.Precio,
        estado:      Estado        ?? existing.Estado,
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
