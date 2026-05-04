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
        type:      DataTypes.TEXT('long'),
        allowNull: true,
      },
      IDCabana: {
        type:      DataTypes.INTEGER,
        allowNull: false,
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
