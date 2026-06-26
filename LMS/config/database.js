const path = require('path');
// Load this folder's .env regardless of where the app is started from
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sql = require('mssql');

// mssql parses the ADO.NET-style DB_STRING itself (server\instance, encrypt, etc.)
const pool = new sql.ConnectionPool(process.env.DB_STRING);
pool.on('error', err => console.error('SQL Server pool error:', err));

const poolConnect = pool.connect()
    .then(connectedPool => {
        console.log('Connected to SQL Server (schooldb)');
        return connectedPool;
    });

module.exports = { sql, pool, poolConnect };
