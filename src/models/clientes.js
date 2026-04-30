'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Clientes = sequelize.define(
    'Clientes',
    {
      NroDocumento: {
        type:       DataTypes.STRING(50),
        primaryKey: true,
        allowNull:  false,
      },
      Nombre: {
        type:      DataTypes.STRING(50),
        allowNull: true,
      },
      Apellido: {
        type:      DataTypes.STRING(50),
        allowNull: true,
      },
      Direccion: {
        type:      DataTypes.STRING(50),
        allowNull: true,
      },
      Email: {
        type:      DataTypes.STRING(50),
        allowNull: true,
        validate:  { isEmail: true },
      },
      Telefono: {
        type:      DataTypes.STRING(50),
        allowNull: true,
      },
      TipoDocumento: {
        type:      DataTypes.INTEGER,
        allowNull: true,
        field:     'Tipo de Documento',
      },
      Estado: {
        type:         DataTypes.BOOLEAN,
        allowNull:    true,
        defaultValue: true,
      },
      IDRol: {
        type:      DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName:  'Clientes',
      timestamps: false,
    }
  );

  return Clientes;
};