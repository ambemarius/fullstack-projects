const { loadTestEnvironment } = require('./testEnvironment');
const { createDatabase } = require('../config/database');

async function main() {
    loadTestEnvironment();
    const database = createDatabase();
    try {
        await database.connect();
        const pool = database.getPool();
        const state = (await pool.request().query(`
            SELECT DB_NAME() AS database_name,
                (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0) AS table_count,
                (SELECT CAST(value AS nvarchar(128)) FROM sys.extended_properties
                 WHERE class=0 AND name=N'LMS_SYNTHETIC_ONLY') AS marker;
        `)).recordset[0];
        if (state.database_name !== 'lms_test_codex') throw new Error('Wrong database');
        if (!state.marker && state.table_count === 0) {
            await pool.request().query(`
                IF DB_NAME() <> N'lms_test_codex' OR EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0)
                    THROW 50000, 'Synthetic target must be empty', 1;
                EXEC sys.sp_addextendedproperty @name=N'LMS_SYNTHETIC_ONLY', @value=N'codex-approved';
            `);
        } else if (state.marker !== 'codex-approved') {
            throw new Error('Existing schema lacks the approved synthetic marker');
        }
        console.log('Approved synthetic database identity verified. No school database accessed.');
    } finally {
        await database.close();
    }
}

if (require.main === module) main().catch(err => {
    const number = err.number ?? err.originalError?.info?.number ?? err.originalError?.number;
    const reason = /cannot open database/i.test(err.message) ? 'test database unavailable or login not mapped'
        : /login failed/i.test(err.message) ? 'SQL login authentication rejected'
        : err.code === 'ETIMEOUT' ? 'connection timed out' : 'identity or connection precondition failed';
    console.error(`Test database verification stopped: code=${err.code || 'precondition'}, sqlNumber=${Number.isInteger(number) ? number : 'n/a'}, reason=${reason}. Credentials withheld.`);
    process.exitCode = 1;
});

module.exports = { main };
