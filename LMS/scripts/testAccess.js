const { loadTestEnvironment } = require('./testEnvironment');
const { databaseConfiguration } = require('../config/environment');
const { createDatabase } = require('../config/database');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
    loadTestEnvironment();
    const base = databaseConfiguration();
    const latestPath = path.join(__dirname, '../backups/rehearsals/latest.json');
    const target = fs.existsSync(latestPath) ? JSON.parse(fs.readFileSync(latestPath, 'utf8')).target || 'lms_test_codex_restore' : 'lms_test_codex_restore';
    if (!/^lms_test_codex_restore(?:_[a-f0-9]{16})?$/.test(target)) throw new Error('Invalid synthetic restore target');
    // Read-only login diagnostics on the approved test instance; no application database queried.
    const db = createDatabase({ configuration: () => ({ ...base, database: 'master' }) });
    try {
        await db.connect();
        const result = await db.getPool().request().input('target', target).query(`
            SELECT name,state_desc,user_access_desc,HAS_DBACCESS(name) AS accessible FROM sys.databases
            WHERE name IN (N'lms_test_codex',N'lms_test_codex_restore',@target) ORDER BY name;
        `);
        console.log(JSON.stringify({ loginAccepted: true, requestedRestoreTarget: target, syntheticDatabases: result.recordset }));
        if (process.argv.includes('--probe')) {
            for (const name of ['lms_test_codex', 'lms_test_codex_restore', target]) {
                const copy = createDatabase({ configuration: () => ({ ...base, database: name }) });
                try {
                    await copy.connect();
                    const probe = await copy.getPool().request().query(`
                        SELECT DB_NAME() AS database_name,
                            CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AS server_name,
                            (SELECT COUNT(*) FROM dbo.subjects WHERE code=N'REC_240798fdb65f1f46') AS latest_probe_count;
                    `);
                    console.log(JSON.stringify(probe.recordset));
                } catch (err) {
                    console.log(JSON.stringify({ database: name, error: err.code || 'precondition' }));
                } finally {
                    await copy.close();
                }
            }
        }
    } finally {
        await db.close();
    }
}

if (require.main === module) main().catch(err => {
    console.error(`Read-only test access diagnostic failed (${err.code || 'precondition'}); credentials withheld.`);
    process.exitCode = 1;
});

module.exports = { main };
