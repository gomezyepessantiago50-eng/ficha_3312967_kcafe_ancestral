require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  const [users] = await conn.execute('SELECT IDUsuario, Nombre, Apellido, Correo, IDRol FROM Usuarios');
  console.log("Usuarios:");
  console.table(users);

  const [reservas] = await conn.execute('SELECT IDReserva, id_cliente, documento, cliente_nombre FROM Reservas');
  console.log("Reservas:");
  console.table(reservas);

  await conn.end();
}

check().catch(console.error);
