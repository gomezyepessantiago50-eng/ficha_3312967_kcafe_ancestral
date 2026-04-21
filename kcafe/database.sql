CREATE DATABASE IF NOT EXISTS kcafe_db;
USE kcafe_db;

DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS cabanas;
DROP TABLE IF EXISTS servicios;
DROP TABLE IF EXISTS paquetes;

CREATE TABLE cabanas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  capacidad INT NOT NULL DEFAULT 2,
  precio_noche DECIMAL(10,2) NOT NULL,
  descripcion VARCHAR(500),
  imagen_url VARCHAR(1000),
  Estado ENUM('disponible','ocupada','mantenimiento') DEFAULT 'disponible'
);

CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  documento VARCHAR(20) NOT NULL,
  telefono VARCHAR(20),
  procedencia VARCHAR(100),
  email VARCHAR(100),
  dias INT NOT NULL DEFAULT 1,
  id_cabana INT DEFAULT NULL,
  id_paquete INT DEFAULT NULL,
  estado ENUM('activo','inactivo') DEFAULT 'activo',
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE servicios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255),
  estado ENUM('activo','agotado','no_disponible') DEFAULT 'activo'
);

CREATE TABLE paquetes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  descripcion VARCHAR(255),
  estado ENUM('activo','agotado','no_disponible') DEFAULT 'activo'
);

INSERT INTO cabanas (nombre,capacidad,precio_noche,descripcion,imagen_url,Estado) VALUES
('El Roble',    2, 180000, 'Refugio íntimo con jacuzzi exterior y chimenea de leña.',       'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=900&q=80', 'disponible'),
('La Ceiba',    4, 280000, 'Familiar. Cocina equipada, hamacas y fogón bajo las estrellas.', 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=900&q=80', 'disponible'),
('Luna Llena',  2, 320000, 'Techo de vidrio para ver las estrellas desde la cama.',          'https://images.unsplash.com/photo-1521401830884-6c03c1c87ebb?w=900&q=80', 'ocupada'),
('El Nogal',    6, 450000, 'Grupal. Terraza panorámica 360° y jardín con fogón.',            'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=900&q=80', 'disponible'),
('Nido Alto',   2, 250000, 'Cabaña elevada entre los árboles con vista al valle.',           'https://images.unsplash.com/photo-1506974210756-8e1b8985d348?w=900&q=80', 'mantenimiento');

INSERT INTO clientes (nombre,documento,telefono,procedencia,email,dias,id_cabana,id_paquete,estado) VALUES
('María García',  '52345678','3101234567','Bogotá',  'maria@gmail.com', 3,1,2,'activo'),
('Carlos Pérez',  '10234567','3209876543','Medellín','carlos@gmail.com',2,2,1,'activo');

INSERT INTO servicios (nombre,descripcion,estado) VALUES
('WiFi',          'Conexión ilimitada en toda la finca',             'activo'),
('Piscina',       'Piscina de agua de montaña, 8am–8pm',            'activo'),
('Spa',           'Masajes y tratamientos naturales',                 'agotado'),
('Senderismo',    'Rutas ecológicas con guía experto',               'activo'),
('Yoga',          'Sesiones al amanecer en la naturaleza',           'activo'),
('Fogón',         'Reunión nocturna alrededor del fuego',            'no_disponible');

INSERT INTO paquetes (nombre,precio,descripcion,estado) VALUES
('Escapada',   80000,  'Desayuno incluido + acceso a senderos',              'activo'),
('Romántico', 150000,  'Cena privada, decoración especial y masaje',         'activo'),
('Completo',  280000,  'Todo incluido: comidas, spa y actividades',          'activo'),
('Aventura',  120000,  'Senderismo, fogón nocturno y kit de camping',        'agotado');
