let sql;
try {
  sql = require('mssql');
} catch (err) {
  console.error('FATAL: No se pudo cargar el modulo mssql:', err.message);
  throw new Error('Modulo mssql no instalado. Ejecutar npm install. Detalle: ' + err.message);
}

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 60000,
    requestTimeout: 60000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool = null;
let connecting = null;

async function getPool() {
  if (pool && pool.connected) return pool;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      console.log('Conectando a SQL Server:', config.server);
      pool = await sql.connect(config);
      console.log('SQL pool conectado');
      return pool;
    } catch (e) {
      console.error('SQL connection error:', e.message, 'code:', e.code);
      pool = null;
      throw e;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

module.exports = { sql, getPool };
