require('dotenv').config();
const mysql = require('mysql2/promise');

async function clean() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [users] = await conn.execute('SELECT IDUsuario, NombreUsuario, Email FROM Usuarios');
    
    const keepUsers = [];
    const deleteUsers = [];
    
    for (const u of users) {
      const email = u.Email || '';
      const nombre = u.NombreUsuario || '';
      const isTest = 
        email.includes('test') || 
        email.includes('prueba') || 
        nombre.toLowerCase() === 'hola' || 
        nombre.toLowerCase() === 'testname' ||
        email === 'afafa@gmail.com' ||
        email === 'dgdgdf@gmail.com' ||
        email === 'sfs@gmail.com' ||
        email === 'tajdh@gmail.com' ||
        email === 'afsdgs@gmail.com' ||
        email === 'sdgs@gmail.com' ||
        email === 'holamundo@gmail.com';
      
      if (isTest || (u.IDUsuario >= 5 && u.IDUsuario <= 12)) {
        deleteUsers.push(u.IDUsuario);
      } else {
        keepUsers.push(u.IDUsuario);
      }
    }
    
    console.log("Keeping users:", keepUsers);
    console.log("Deleting users:", deleteUsers);

    if (deleteUsers.length > 0) {
      // First delete associated resets or dependencies if any, but we'll try straight delete
      try {
        await conn.query('DELETE FROM Usuarios WHERE IDUsuario IN (?)', [deleteUsers]);
        console.log(`Deleted ${deleteUsers.length} test users.`);
      } catch(e) {
        console.error("Could not delete users, maybe foreign keys constraints:", e.message);
      }
    }

    const [reservations] = await conn.execute('SELECT IdReserva, UsuarioIdusuario, NroDocumentoCliente FROM reserva');
    const deleteReservas = [];
    
    for (const r of reservations) {
      if (r.NroDocumentoCliente === 'demo123' || (r.UsuarioIdusuario && deleteUsers.includes(r.UsuarioIdusuario))) {
        deleteReservas.push(r.IdReserva);
      } else if (!keepUsers.includes(r.UsuarioIdusuario) && r.UsuarioIdusuario !== null) {
        // user was deleted or doesn't exist
        deleteReservas.push(r.IdReserva);
      } else if (r.UsuarioIdusuario === null && r.NroDocumentoCliente === 'demo123') {
        deleteReservas.push(r.IdReserva);
      }
      
      // Also if there's no doc and no user, probably test
      if (!r.UsuarioIdusuario && !r.NroDocumentoCliente) {
         deleteReservas.push(r.IdReserva);
      }
    }
    
    console.log("Deleting reservations:", deleteReservas);
    if (deleteReservas.length > 0) {
      try {
        await conn.query('DELETE FROM reserva WHERE IdReserva IN (?)', [deleteReservas]);
        console.log(`Deleted ${deleteReservas.length} test reservations.`);
      } catch(e) {
         console.error("Could not delete reservations:", e.message);
      }
    }
    
  } catch(e) {
    console.error(e);
  }

  await conn.end();
}

clean().catch(console.error);
