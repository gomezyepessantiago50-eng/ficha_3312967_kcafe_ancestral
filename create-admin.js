// Script para crear cuenta de administrador
'use strict';

const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configurar conexión a la BD
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
  }
);

// Definir modelo de Usuario
const Usuario = sequelize.define('Usuario', {
  IDUsuario: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  NombreUsuario: {
    type: Sequelize.STRING(255),
    allowNull: false,
  },
  Apellido: {
    type: Sequelize.STRING(255),
    allowNull: true,
  },
  Email: {
    type: Sequelize.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  Contrasena: {
    type: Sequelize.STRING(255),
    allowNull: false,
  },
  TipoDocumento: {
    type: Sequelize.STRING(50),
    allowNull: true,
  },
  NumeroDocumento: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  Telefono: {
    type: Sequelize.STRING(50),
    allowNull: true,
  },
  Pais: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  Direccion: {
    type: Sequelize.STRING(255),
    allowNull: true,
  },
  IDRol: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'Roles', key: 'IDRol' },
  },
  ResetToken: {
    type: Sequelize.STRING(255),
    allowNull: true,
  },
  ResetTokenExpira: {
    type: Sequelize.DATE,
    allowNull: true,
  },
}, {
  tableName: 'Usuarios',
  timestamps: false,
});

// Función para crear el admin
const crearAdmin = async () => {
  try {
    // Conectar a la BD
    await sequelize.authenticate();
    console.log('✓ Conexión a MySQL establecida\n');

    // Generar contraseña hasheada
    const password = 'Admin123!';
    const hash = await bcrypt.hash(password, 12);

    // Verificar si ya existe
    const existe = await Usuario.findOne({
      where: { Email: 'admin@kcafeancestral.com' }
    });

    if (existe) {
      console.log('❌ El usuario administrador ya existe\n');
      console.log('Datos existentes:');
      console.log('Email:', existe.Email);
      console.log('Nombre:', existe.NombreUsuario);
      console.log('Rol ID:', existe.IDRol);
    } else {
      // Crear el usuario admin
      const admin = await Usuario.create({
        NombreUsuario: 'Administrador',
        Apellido: 'Sistema',
        Email: 'admin@kcafeancestral.com',
        Contrasena: hash,
        Telefono: '+57 300 000 0000',
        TipoDocumento: 'CC',
        NumeroDocumento: 1000000000,
        Pais: 'Colombia',
        Direccion: 'Sistema',
        IDRol: 1, // 1 = Admin
      });

      console.log('✓ Cuenta de administrador creada exitosamente\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 Email:        admin@kcafeancestral.com');
      console.log('🔐 Contraseña:   Admin123!');
      console.log('👤 Nombre:       Administrador');
      console.log('🎯 Rol:          Admin (ID: 1)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('✅ Puedes iniciar sesión en el apartado de admin');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

// Ejecutar
crearAdmin();
