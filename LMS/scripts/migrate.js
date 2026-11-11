const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { sql } = require('../config/database');

function migrationFiles(directory = path.join(__dirname, '../migrations')) {
    return fs.readdirSync(directory).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort().map(name => {
        const text = fs.readFileSync(path.join(directory, name), 'utf8');
        return { name, text, checksum: crypto.createHash('sha256').update(text).digest('hex') };
    });
}

async function migrate(database, files = migrationFiles(), driver = sql) {
    await database.connect();
    const pool = database.getPool();
    const transaction = new driver.Transaction(pool);
    await transaction.begin();
    try {
        const request = () => new driver.Request(transaction);
        const lock = await request().query(`
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource=N'lms-schema-migrations',
                @LockMode=N'Exclusive', @LockOwner=N'Transaction', @LockTimeout=10000;
            SELECT @result AS result;
        `);
        if (lock.recordset[0].result < 0) throw new Error('Migration lock unavailable');
        const state = await request().query(`
            SELECT name FROM sys.tables WHERE is_ms_shipped=0;
        `);
        const hasLedger = state.recordset.some(row => row.name === 'schema_migrations');
        if (!hasLedger && state.recordset.length) {
            throw new Error('Existing unversioned database requires a reviewed legacy migration plan');
        }
        if (!hasLedger) await request().query(`
            CREATE TABLE schema_migrations (
                version NVARCHAR(128) NOT NULL PRIMARY KEY,
                checksum CHAR(64) NOT NULL,
                applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            );
        `);
        const applied = (await request().query('SELECT version, checksum FROM schema_migrations ORDER BY version')).recordset;
        for (let i = 0; i < applied.length; i++) {
            if (!files[i] || files[i].name !== applied[i].version || files[i].checksum !== applied[i].checksum) {
                throw new Error('Migration history or checksum mismatch');
            }
        }
        const completed = [];
        for (const file of files.slice(applied.length)) {
            await request().query(file.text);
            await request().input('version', sql.NVarChar(128), file.name)
                .input('checksum', sql.Char(64), file.checksum)
                .query('INSERT INTO schema_migrations(version, checksum) VALUES (@version, @checksum)');
            completed.push(file.name);
        }
        await transaction.commit();
        return completed;
    } catch (err) {
        await transaction.rollback().catch(() => {});
        throw err;
    }
}

if (require.main === module) {
    // A CLI must be given an explicit environment; never default to the existing school DB.
    if (!process.argv.includes('--approved-synthetic-only')) {
        console.error('Only explicitly approved synthetic migration runs are enabled.');
        process.exitCode = 1;
    } else {
        require('./testEnvironment').loadTestEnvironment();
        const database = require('../config/database');
        const adapter = { connect: database.connect, getPool: () => database.pool };
        require('./testEnvironment').assertSyntheticDatabase(adapter)
            .then(() => migrate(adapter)).then(result => console.log(`Applied ${result.length} migration(s).`))
            .catch(() => { console.error('Migration stopped; review the target and migration history.'); process.exitCode = 1; })
            .finally(database.close);
    }
}

module.exports = { migrate, migrationFiles };
