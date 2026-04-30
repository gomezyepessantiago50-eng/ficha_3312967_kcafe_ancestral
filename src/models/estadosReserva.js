'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EstadosReserva = sequelize.define(
    'EstadosReserva',
    {
      IdEstadoReserva: {
        type:          DataTypes.INTEGER,
        primaryKey:    true,
        autoIncrement: true,
      },
      NombreEstadoReserva: {
        type:      DataTypes.STRING(50),
        allowNull: false,
      },
    },
    {
      tableName:  'Estados_Reserva',
      timestamps: false,
    }
  );

  EstadosReserva.associate = (db) => {
    if (db.Reserva) {
      EstadosReserva.hasMany(db.Reserva, {
        foreignKey: 'IDEstadoReserva',
        as: 'reservas',
      });
    }
  };

  return EstadosReserva;
};
