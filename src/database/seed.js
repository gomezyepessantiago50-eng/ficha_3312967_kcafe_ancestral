const { sequelize, connectDB } = require('./connection');
const { QueryTypes } = require('sequelize');
require('../models'); // Import models so they are registered before sync

const seedData = async () => {
  await connectDB();
  console.log('--- Iniciando Seeding de Módulos ---');
  
  try {
    // Desactivar temporalmente revisión de llaves foráneas
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    // Crear tabla roles y llenarla
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS roles (
        IDRol INT AUTO_INCREMENT PRIMARY KEY,
        NombreRol VARCHAR(50) NOT NULL
      )
    `);
    await sequelize.query("INSERT IGNORE INTO roles (IDRol, NombreRol) VALUES (1, 'Administrador'), (2, 'Cliente')");

    // Limpiar tablas para evitar duplicados
    console.log('Limpiando tablas existentes...');
    await sequelize.query('TRUNCATE TABLE usuarios');
    await sequelize.query('TRUNCATE TABLE cabanas');
    await sequelize.query('TRUNCATE TABLE servicios');
    await sequelize.query('TRUNCATE TABLE paquetes');

    // 0. Usuarios (Admin)
    console.log('Insertando Administrador...');
    // Hasheamos "admin123" (Nota: bcrypt hash manual para admin123, normalmente se genera con bcryptjs pero para el seeder se puede usar uno pre-generado o importamos bcrypt)
    const bcrypt = require('bcryptjs');
    const adminHash = await bcrypt.hash('admin123', 12);
    await sequelize.query(
      `INSERT INTO usuarios (IDUsuario, NombreUsuario, Apellido, Email, Contrasena, IDRol, Estado) VALUES
       (1, 'Administrador', 'Principal', 'admin@kafeancestral.com', '${adminHash}', 1, 1)`,
      { type: QueryTypes.INSERT }
    );

    // 1. Cabañas
    console.log('Insertando Cabañas...');
    await sequelize.query(
      `INSERT INTO cabanas (IDCabana, NombreCabana, Descripcion, Capacidad, NumeroHabitaciones, PrecioNoche, Estado) VALUES
       (1, 'El Roble', 'Cabaña romántica de estilo rústico, ideal para parejas. Cuenta con 1 habitación espaciosa (cama queen), chimenea de leña, baño privado con agua caliente, minibar y un balcón con vista directa al bosque nativo. Conexión WiFi satelital incluida.', 2, 1, 280000, 1),
       (2, 'La Ceiba', 'Cabaña familiar amplia y luminosa. Ofrece 2 habitaciones (una cama doble y dos sencillas), cocina equipada, zona de estar, 2 baños completos y un jardín privado exclusivo con hamacas y zona de barbacoa. Excelente señal WiFi.', 4, 2, 420000, 1),
       (3, 'Ancestral', 'La joya de la corona. Una suite de lujo con decoración artesanal indígena, 3 habitaciones king-size, jacuzzi privado climatizado, sala de entretenimiento con Smart TV, terraza panorámica de 360° y servicio de mayordomo. WiFi de alta velocidad.', 6, 3, 650000, 1)`,
      { type: QueryTypes.INSERT }
    );

    // 2. Servicios
    console.log('Insertando Servicios...');
    await sequelize.query(
      `INSERT INTO servicios (IDServicio, NombreServicio, Descripcion, CantidadMaximaPersonas, Costo, Estado, Imagen) VALUES
       (1, 'Spa y Relajación', 'Masaje relajante con aceites esenciales de café (60 min) más sesión en el turco de hierbas aromáticas.', 2, 150000, 1, 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&h=400&fit=crop'),
       (2, 'Noche de Fogata', 'Fogata privada bajo las estrellas. Incluye leña, acomodación con mantas térmicas, botella de vino caliente y malvaviscos.', 6, 75000, 1, 'https://images.unsplash.com/photo-1526495124232-a04e1849168a?w=600&h=400&fit=crop'),
       (3, 'Transporte Privado', 'Servicio de recogida y regreso en camioneta 4x4 cómoda y segura desde el aeropuerto o terminal más cercano.', 4, 100000, 1, 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&h=400&fit=crop'),
       (4, 'Sesión Fotográfica', 'Sesión profesional de 2 horas en los cafetales y senderos, incluye 20 fotografías editadas en alta resolución.', 10, 180000, 1, 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&h=400&fit=crop'),
       (5, 'Tour Cafetero', 'Tour guiado de 3 horas por los cultivos de café, degustación de métodos de filtrado y proceso interactivo desde la semilla hasta la taza.', 10, 90000, 1, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop'),
       (6, 'Desayuno Campesino', 'Desayuno típico de la región con arepa de maíz capio, huevos al gusto, queso fresco, chocolate caliente o café de la casa.', 10, 35000, 1, 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&h=400&fit=crop'),
       (7, 'Senderismo Guiado', 'Caminata ecológica por senderos locales con guía experto, avistamiento de aves y visita a cascadas naturales.', 12, 50000, 1, 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=600&h=400&fit=crop')`,
      { type: QueryTypes.INSERT }
    );

    // 3. Paquetes
    console.log('Insertando Paquetes...');
    await sequelize.query(
      `INSERT INTO paquetes (IDPaquete, NombrePaquete, Descripcion, Precio, Estado, IDServicio, ServiciosIncluidos) VALUES
       (1, 'Viaje Familiar', '¡Ahorra un 35%! Incluye Sesión Fotográfica y Senderismo Guiado. (Valor individual de estos servicios: $230.000).', 150000, 1, NULL, '[4,7]'),
       (2, 'Experiencia Cafetera', '¡Ahorra un 57%! Incluye Tour Cafetero de 3h, Desayuno Campesino y Transporte Privado. (Valor individual de estos servicios: $225.000).', 95000, 1, NULL, '[3,5,6]'),
       (3, 'Paquete Premium', '¡Ahorra más del 50%! La experiencia definitiva. Incluye Masaje de Spa para dos, Noche de Fogata privada, Senderismo Guiado y Sesión Fotográfica. (Valor individual: $455.000).', 220000, 1, 1, '[1,2,4,7]')`,
      { type: QueryTypes.INSERT }
    );

    // Reactivar revisión de llaves foráneas
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('--- Seeding Terminado Correctamente ---');
  } catch (error) {
    // Reactivar revisión de llaves foráneas en caso de fallo
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.error('Error durante el seeding:', error.message);
  } finally {
    await sequelize.close();
  }
};

seedData();
