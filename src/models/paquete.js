'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Paquete = sequelize.define(
    'Paquete',
    {
      IDPaquete: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      NombrePaquete: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      Descripcion: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      IDServicio: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ServiciosIncluidos: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      Precio: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      Estado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'paquetes',
      timestamps: false,
    }
  );

  return Paquete;
};
