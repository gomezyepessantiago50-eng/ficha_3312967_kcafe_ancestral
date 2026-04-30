const db = require("../database/connection");
const { QueryTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Obtener fotos de una habitación
const getFotosByHabitacion = async (idHabitacion) => {
  const rows = await db.query(
    "SELECT IDFoto, NombreArchivo, Orden FROM habitacion_fotos WHERE IDHabitacion = :id ORDER BY Orden ASC",
    { replacements: { id: idHabitacion }, type: QueryTypes.SELECT }
  );
  return rows;
};

// Agregar foto
const addFoto = async (idHabitacion, nombreArchivo, orden = 0) => {
  await db.query(
    "INSERT INTO habitacion_fotos (IDHabitacion, NombreArchivo, Orden) VALUES (:id, :nombre, :orden)",
    { replacements: { id: idHabitacion, nombre: nombreArchivo, orden }, type: QueryTypes.INSERT }
  );
  return { idHabitacion, nombreArchivo, orden };
};

// Eliminar foto
const deleteFoto = async (idFoto) => {
  const rows = await db.query(
    "SELECT NombreArchivo FROM habitacion_fotos WHERE IDFoto = :id",
    { replacements: { id: idFoto }, type: QueryTypes.SELECT }
  );
  if (!rows[0]) return null;

  // Eliminar archivo físico
  const filePath = path.join(__dirname, '../../public/uploads', rows[0].NombreArchivo);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.query(
    "DELETE FROM habitacion_fotos WHERE IDFoto = :id",
    { replacements: { id: idFoto }, type: QueryTypes.DELETE }
  );
  return { deleted: true };
};

module.exports = { getFotosByHabitacion, addFoto, deleteFoto };