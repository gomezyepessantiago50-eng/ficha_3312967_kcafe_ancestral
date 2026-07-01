'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Rol = sequelize.define('Rol', {
  IDRol: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  NombreRol: {
    type: DataTypes.STRING(50),
    allowNull: false,
  }
}, {
  tableName: 'roles',
  timestamps: false,
});

module.exports = Rol;
