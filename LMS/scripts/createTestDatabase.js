// Explicitly authorised, synthetic-only database provisioning. No existing school DB is queried.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sql = require('mssql');
const dotenv = require('dotenv');

const TEST_DATABASE = 'lms_test_codex';
const TEST_LOGIN = 'lms_test_codex_user';

async function main() {
    if (!process.argv.includes('--approved-synthetic-only')) {
        throw new Error('Explicit --approved-synthetic-only acknowledgement is required');
    }
    if (fs.existsSync(path.join(__dirname, '../config/.env.test.local'))) {
        throw new Error('Local test configuration already exists; provisioning stopped');
    }
    const local = dotenv.parse(fs.readFileSync(path.join(__dirname, '../config/.env')));
    const config = sql.ConnectionPool.parseConnectionString(local.DB_STRING);
    const admin = new sql.ConnectionPool({ ...config, database: 'master' });
    let testPool;
    let phase = 'connect-master';
    try {
        await admin.connect();
        phase = 'check-existing-test-resources';
        const existing = await admin.request().input('name', sql.NVarChar(128), TEST_DATABASE)
            .query('SELECT name FROM sys.databases WHERE name = @name');
        if (existing.recordset.length) {
            throw new Error('The test database already exists; provisioning stopped without changing it');
        }
        const login = await admin.request().input('name', sql.NVarChar(128), TEST_LOGIN)
            .query('SELECT name FROM sys.server_principals WHERE name = @name');
        if (login.recordset.length) throw new Error('Test login already exists; provisioning stopped');
        const password = crypto.randomBytes(36).toString('base64url') + '!aA1';
        // Identifiers are fixed constants and the generated password alphabet contains no SQL quotes.
        phase = 'create-dedicated-test-login';
        await admin.request().query(`CREATE LOGIN [${TEST_LOGIN}] WITH PASSWORD = '${password}', CHECK_POLICY = ON;`);
        phase = 'create-disposable-database';
        await admin.request().query(`CREATE DATABASE [${TEST_DATABASE}];`);
        phase = 'configure-disposable-database';
        testPool = await new sql.ConnectionPool({ ...config, database: TEST_DATABASE }).connect();
        await testPool.request().query(`
            EXEC sys.sp_addextendedproperty @name=N'LMS_SYNTHETIC_ONLY', @value=N'codex-approved';
            CREATE USER [${TEST_LOGIN}] FOR LOGIN [${TEST_LOGIN}];
            ALTER ROLE db_owner ADD MEMBER [${TEST_LOGIN}];
        `);
        const server = config.options?.instanceName ? `${config.server}\\${config.options.instanceName}` : config.server;
        const values = {
            NODE_ENV: 'test', LMS_TEST_DB_ACK: 'synthetic-only',
            LMS_TEST_DB_SERVER: server, LMS_TEST_DB_ALLOWED_SERVER: server,
            LMS_TEST_DB_NAME: TEST_DATABASE, LMS_TEST_DB_ALLOWED_NAME: TEST_DATABASE,
            LMS_TEST_DB_USER: TEST_LOGIN, LMS_TEST_DB_PASSWORD: password,
            LMS_TEST_DB_TRUST_CERTIFICATE: String(Boolean(config.options?.trustServerCertificate)),
        };
        fs.writeFileSync(path.join(__dirname, '../config/.env.test.local'),
            Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx' });
        console.log('Disposable lms_test_codex and restricted test login created. Credentials saved locally and withheld.');
    } catch (err) {
        err.provisioningPhase = phase;
        throw err;
    } finally {
        if (testPool) await testPool.close();
        await admin.close();
    }
}

if (require.main === module) main().catch(err => {
    // Driver messages can contain the CREATE LOGIN statement; never print them.
    console.error(`Synthetic database provisioning stopped: phase=${err.provisioningPhase || 'preflight'}, code=${err.code || 'precondition'}, sqlNumber=${Number.isInteger(err.number) ? err.number : 'n/a'}. No credentials displayed.`);
    process.exitCode = 1;
});

module.exports = { main };
