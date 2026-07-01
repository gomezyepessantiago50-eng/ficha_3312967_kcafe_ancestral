const { sequelize } = require('../src/database/connection'); 
async function update() { 
  await sequelize.query(`UPDATE Usuarios SET NumeroDocumento = NULL, Telefono = NULL WHERE Email = 'infokcafeancestral@gmail.com'`); 
  console.log('Updated DB'); 
  process.exit(0); 
} 
update();
