'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Servicio = sequelize.define(
    'Servicio',
    {
      IDServicio: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      NombreServicio: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      Descripcion: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      Duracion: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      CantidadMaximaPersonas: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 10,
      },
      Costo: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      Estado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      Imagen: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
      },
      CobroPorPersona: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'servicios',
      timestamps: false,
    }
  );

  return Servicio;
};
