'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Cabana = sequelize.define(
    'Cabana',
    {
      IDCabana: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      NombreCabana: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      Descripcion: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      Capacidad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      NumeroHabitaciones: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: { min: 1 },
      },
      PrecioNoche: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: { min: 0 },
      },
      Estado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      ImagenCabana: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      ImagenHabitacion: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: 'cabanas',
      timestamps: false,
    }
  );

  return Cabana;
};
