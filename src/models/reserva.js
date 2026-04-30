'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Reserva = sequelize.define(
    'Reserva',
    {
      IdReserva: {
        type:          DataTypes.INTEGER,
        primaryKey:    true,
        autoIncrement: true,
      },
      NroDocumento: {
        type:      DataTypes.STRING(50),
        allowNull: false,
      },
      IDHabitacion: {
        type:      DataTypes.INTEGER,
        allowNull: true,
      },
      FechaInicio: {
        type:      DataTypes.DATE,
        allowNull: false,
      },
      FechaFinalizacion: {
        type:      DataTypes.DATE,
        allowNull: false,
      },
      MontoTotal: {
        type:      DataTypes.FLOAT,
        allowNull: true,
      },
      Estado: {
        type:      DataTypes.STRING(50),
        allowNull: true,
      },
      IDEstadoReserva: {
        type:      DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName:  'Reserva',
      timestamps: false,
    }
  );

  Reserva.associate = (db) => {
    if (db.Clientes) {
      Reserva.belongsTo(db.Clientes, {
        foreignKey: 'NroDocumento',
        as: 'cliente',
      });
    }
    if (db.EstadosReserva) {
      Reserva.belongsTo(db.EstadosReserva, {
        foreignKey: 'IDEstadoReserva',
        as: 'estadoReserva',
      });
    }
  };

  return Reserva;
};
