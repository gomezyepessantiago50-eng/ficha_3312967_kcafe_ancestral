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
      Nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      Descripcion: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      CapacidadMaxima: {
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
      Costo: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: { min: 0 },
      },
      Estado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'Cabanas',
      timestamps: false,
    }
  );

  return Cabana;
};
