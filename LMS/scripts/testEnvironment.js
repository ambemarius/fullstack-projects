const fs = require('node:fs');
const path = require('node:path');
const { databaseConfiguration } = require('../config/environment');

function loadTestEnvironment() {
    const values = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../config/.env.test.local')));
    values.NODE_ENV = 'test';
    databaseConfiguration(values);
    Object.assign(process.env, values);
}

async function assertSyntheticDatabase(database) {
    await database.connect();
    const result = await database.getPool().request().query(`
        SELECT DB_NAME() AS database_name,
            (SELECT CAST(value AS nvarchar(128)) FROM sys.extended_properties
             WHERE class=0 AND name=N'LMS_SYNTHETIC_ONLY') AS marker;
    `);
    if (result.recordset[0]?.database_name !== process.env.LMS_TEST_DB_NAME ||
        result.recordset[0]?.marker !== 'codex-approved') {
        throw new Error('Database identity or synthetic-only marker mismatch');
    }
}

module.exports = { loadTestEnvironment, assertSyntheticDatabase };
