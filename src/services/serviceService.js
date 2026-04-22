const sequelize      = require('../database/connection');
const { QueryTypes } = require('sequelize');

const findAllServices = async () => {
  return await sequelize.query(
    `SELECT IDServicio, NombreServicio, Descripcion, Duracion,
            CantidadMaximaPersonas, Costo, Estado
     FROM servicios
     ORDER BY NombreServicio ASC`,
    { type: QueryTypes.SELECT }
  );
};

const findServiceById = async (id) => {
  const [servicio] = await sequelize.query(
    `SELECT IDServicio, NombreServicio, Descripcion, Duracion,
            CantidadMaximaPersonas, Costo, Estado
     FROM servicios WHERE IDServicio = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return servicio || null;
};

const createService = async ({ NombreServicio, Descripcion, Duracion, CantidadMaximaPersonas, Costo, Estado = 1 }) => {
  const [result] = await sequelize.query(
    `INSERT INTO servicios (NombreServicio, Descripcion, Duracion, CantidadMaximaPersonas, Costo, Estado)
     VALUES (:nombre, :descripcion, :duracion, :cantidad, :costo, :estado)`,
    {
      replacements: {
        nombre:      NombreServicio,
        descripcion: Descripcion,
        duracion:    Duracion    || null,
        cantidad:    CantidadMaximaPersonas,
        costo:       Costo,
        estado:      Estado,
      },
      type: QueryTypes.INSERT,
    }
  );
  return findServiceById(result);
};

const updateService = async (id, { NombreServicio, Descripcion, Duracion, CantidadMaximaPersonas, Costo }) => {
  const existing = await findServiceById(id);
  if (!existing) return null;

  await sequelize.query(
    `UPDATE servicios
     SET NombreServicio        = :nombre,
         Descripcion           = :descripcion,
         Duracion              = :duracion,
         CantidadMaximaPersonas= :cantidad,
         Costo                 = :costo
     WHERE IDServicio = :id`,
    {
      replacements: {
        id,
        nombre:      NombreServicio        ?? existing.NombreServicio,
        descripcion: Descripcion           ?? existing.Descripcion,
        duracion:    Duracion              ?? existing.Duracion,
        cantidad:    CantidadMaximaPersonas?? existing.CantidadMaximaPersonas,
        costo:       Costo                 ?? existing.Costo,
      },
      type: QueryTypes.UPDATE,
    }
  );
  return findServiceById(id);
};

const changeServiceStatus = async (id, Estado) => {
  const existing = await findServiceById(id);
  if (!existing) return null;
  await sequelize.query(
    'UPDATE servicios SET Estado = :estado WHERE IDServicio = :id',
    { replacements: { id, estado: Estado }, type: QueryTypes.UPDATE }
  );
  return findServiceById(id);
};

const deleteService = async (id) => {
  const existing = await findServiceById(id);
  if (!existing) return null;
  await sequelize.query(
    'DELETE FROM servicios WHERE IDServicio = :id',
    { replacements: { id }, type: QueryTypes.DELETE }
  );
  return { deleted: true };
};

module.exports = { findAllServices, findServiceById, createService, updateService, changeServiceStatus, deleteService };
