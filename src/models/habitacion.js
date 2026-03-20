'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Habitacion = sequelize.define(
    'Habitacion',
    {
      IDHabitacion: {
        type:          DataTypes.INTEGER,
        primaryKey:    true,
        autoIncrement: true,
      },
      NombreHabitacion: {
        type:      DataTypes.STRING(30),
        allowNull: false,
      },
      ImagenHabitacion: {
        type:      DataTypes.BLOB,
        allowNull: true,
      },
      Descripcion: {
        type:      DataTypes.STRING(50),
        allowNull: false,
      },
      Costo: {
        type:      DataTypes.FLOAT,
        allowNull: false,
        validate:  { min: 0 },
      },
      Estado: {
        type:         DataTypes.BOOLEAN,
        allowNull:    false,
        defaultValue: true,
      },
    },
    {
      tableName:  'Habitacion',
      timestamps: false,
    }
  );

  return Habitacion;
};
