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
      /* _CAIDAS_V1 (14-oct-2026): sin quien escuche el evento 'error' del pool, un fallo de
         conexion puede tumbar TODA la instancia (todas las peticiones fallan a la vez).
         Ahora se registra y, si el pool quedo desconectado, la siguiente peticion reconecta. */
      if (pool && !pool._rlErr) {
        pool._rlErr = true;
        const p0 = pool;
        p0.on('error', (e) => {
          console.error('SQL pool error:', e && e.message, 'code:', e && e.code);
          if (pool === p0 && !p0.connected) pool = null;
        });
      }
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
