const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('invalid_db', 'invalid_user', 'invalid_pass', {
  host: '10.255.255.1', // Unreachable IP to simulate hanging
  port: 3306,
  dialect: 'mysql',
  logging: false,
  dialectOptions: {
    connectTimeout: 5000,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 5000,
    idle: 5000,
  },
});

async function test() {
  console.log('Starting query...');
  try {
    await sequelize.query('SELECT 1');
    console.log('Query succeeded?');
  } catch (e) {
    console.error('Query failed!', e.message);
  }
  console.log('Done.');
}
test();
