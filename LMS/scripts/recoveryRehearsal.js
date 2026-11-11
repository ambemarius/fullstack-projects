const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createDatabase, sql } = require('../config/database');
const { databaseConfiguration } = require('../config/environment');
const { loadTestEnvironment, assertSyntheticDatabase } = require('./testEnvironment');

const SOURCE = 'lms_test_codex';
const TARGET = 'lms_test_codex_restore';
const validTarget = value => value === TARGET || /^lms_test_codex_restore_[a-f0-9]{16}$/.test(value);
const literal = value => `N'${String(value).replaceAll("'", "''")}'`;

function restoreScript({ backupPath, files, dataPath, logPath, suffix, target = TARGET, probeCode }) {
    if (!backupPath || !dataPath || !logPath || !/^[a-f0-9]{16}$/.test(suffix) ||
        !validTarget(target) || (probeCode !== undefined && !/^REC_[a-f0-9]{16}$/.test(probeCode)) ||
        files.length !== 2 || !files.some(f => f.Type === 'D') || !files.some(f => f.Type === 'L')) {
        throw new Error('Unsupported recovery file layout');
    }
    const moves = files.map(file => {
        const destination = path.win32.join(file.Type === 'L' ? logPath : dataPath,
            `${target}_${suffix}${file.Type === 'L' ? '.ldf' : '.mdf'}`);
        return `MOVE ${literal(file.LogicalName)} TO ${literal(destination)}`;
    });
    return `-- DBA-only synthetic restore. Existing databases are never overwritten.\n` +
        `USE [master];\nIF DB_ID(${literal(target)}) IS NOT NULL\n` +
        `    THROW 50000, 'Restore target already exists; stop for review', 1;\n` +
        `RESTORE VERIFYONLY FROM DISK=${literal(backupPath)} WITH CHECKSUM;\n` +
        `RESTORE DATABASE [${target}] FROM DISK=${literal(backupPath)}\n` +
        `WITH ${moves.join(',\n     ')}, RECOVERY, CHECKSUM;\n` +
        (probeCode ? `EXEC(${literal(`USE [${target}]; IF NOT EXISTS(SELECT 1 FROM dbo.subjects WHERE code=${literal(probeCode)} AND name=N'Synthetic recovery probe') THROW 50001, 'Recovery probe missing: wrong backup or incomplete restore', 1; SELECT N'Restore recovery probe verified' AS result;`)});\n` : '');
}

async function counts(pool) {
    // Names come from SQL metadata, are quoted, and never become an untrusted request parameter.
    const tables = (await pool.request().query(`
        SELECT s.name AS schema_name,t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
        WHERE t.is_ms_shipped=0 ORDER BY s.name,t.name;
    `)).recordset;
    const result = {};
    for (const table of tables) {
        const quote = value => `[${value.replaceAll(']', ']]')}]`;
        const record = await pool.request().query(`SELECT COUNT_BIG(*) AS count FROM ${quote(table.schema_name)}.${quote(table.name)}`);
        result[`${table.schema_name}.${table.name}`] = String(record.recordset[0].count);
    }
    return result;
}

async function prepare({ uniqueTarget = false } = {}) {
    loadTestEnvironment();
    const database = createDatabase();
    const directory = path.join(__dirname, '../backups/rehearsals');
    fs.mkdirSync(directory, { recursive: true });
    let probeId;
    let phase = 'verify-source';
    try {
        await assertSyntheticDatabase(database);
        const pool = database.getPool();
        phase = 'resolve-server-paths';
        const server = (await pool.request().query(`
            SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000)) AS backup_path,
                   CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000)) AS data_path,
                   CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(4000)) AS log_path;
        `)).recordset[0];
        const sourceFiles = (await pool.request().query(`
            SELECT name AS LogicalName,CASE WHEN type=1 THEN 'L' ELSE 'D' END AS Type,physical_name
            FROM sys.database_files WHERE type IN (0,1) ORDER BY type;
        `)).recordset;
        server.data_path ||= sourceFiles.find(file => file.Type === 'D') && path.win32.dirname(sourceFiles.find(file => file.Type === 'D').physical_name);
        server.log_path ||= sourceFiles.find(file => file.Type === 'L') && path.win32.dirname(sourceFiles.find(file => file.Type === 'L').physical_name);
        if (process.env.LMS_TEST_BACKUP_DIRECTORY) {
            if (!path.win32.isAbsolute(process.env.LMS_TEST_BACKUP_DIRECTORY)) throw new Error('Backup directory must be absolute');
            server.backup_path = process.env.LMS_TEST_BACKUP_DIRECTORY;
        }
        server.backup_path ||= server.data_path;
        if (!server.backup_path || !server.data_path || !server.log_path) throw new Error('Server backup paths unavailable');
        phase = 'insert-synthetic-probe';
        const suffix = crypto.randomBytes(8).toString('hex');
        const target = uniqueTarget ? `${TARGET}_${suffix}` : TARGET;
        const probeCode = `REC_${suffix}`;
        const record = await pool.request().input('code', sql.NVarChar(20), probeCode).query(`
            INSERT INTO subjects(name,code) OUTPUT INSERTED.id VALUES(N'Synthetic recovery probe',@code);
        `);
        probeId = record.recordset[0].id;
        const expectedCounts = await counts(pool);
        const backupPath = path.win32.join(server.backup_path, `${SOURCE}_${suffix}.bak`);
        const started = Date.now();
        phase = 'backup';
        await pool.request().input('file', sql.NVarChar(4000), backupPath).query(`
            BACKUP DATABASE [lms_test_codex] TO DISK=@file WITH COPY_ONLY,CHECKSUM,COMPRESSION;
        `);
        phase = 'verify-backup';
        let backupVerified = false;
        try {
            await pool.request().input('file', sql.NVarChar(4000), backupPath).query('RESTORE VERIFYONLY FROM DISK=@file WITH CHECKSUM;');
            backupVerified = true;
        } catch (err) {
            const numbers = [err, ...(err.precedingErrors || [])].map(error => error.number);
            if (!numbers.some(number => [262, 297, 3110, 15247].includes(number))) throw err;
        }
        const script = restoreScript({ backupPath, files: sourceFiles, dataPath: server.data_path, logPath: server.log_path, suffix, target, probeCode });
        const manifest = {
            source: SOURCE, target, server: process.env.LMS_TEST_DB_SERVER,
            backupPath, probeCode, expectedCounts, backupAndVerifyMs: Date.now() - started,
            preparedAt: new Date().toISOString(), backupVerified, restoreVerified: false,
        };
        const manifestPath = path.join(directory, `${suffix}.json`);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
        fs.writeFileSync(path.join(directory, `${suffix}_restore.sql`), script, { flag: 'wx' });
        fs.writeFileSync(path.join(directory, 'latest.json'), JSON.stringify({ manifest: path.basename(manifestPath), target }) + '\n');
        const evidence = path.join(__dirname, '../docs/implementation/recovery-evidence');
        fs.mkdirSync(evidence, { recursive: true });
        fs.writeFileSync(path.join(evidence, `${suffix}.json`), JSON.stringify(manifest, null, 2) + '\n');
        console.log(`Synthetic backup created; CHECKSUM verification ${backupVerified ? 'passed' : 'requires DBA'}. DBA restore script: backups/rehearsals/${suffix}_restore.sql`);
        return manifest;
    } catch (err) {
        err.recoveryPhase = phase;
        throw err;
    } finally {
        if (probeId) await database.getPool().request().input('id', sql.Int, probeId)
            .query('DELETE FROM subjects WHERE id=@id AND name=N\'Synthetic recovery probe\'');
        await database.close();
    }
}

function reconstructedCounts(sourceCounts) {
    if (!Object.hasOwn(sourceCounts, 'dbo.subjects')) throw new Error('Missing recovery probe table');
    return { ...sourceCounts, 'dbo.subjects': String(BigInt(sourceCounts['dbo.subjects']) + 1n) };
}

async function verify({ reconstruct = false, removeRestoredSourceProbe = false } = {}) {
    loadTestEnvironment();
    const directory = path.join(__dirname, '../backups/rehearsals');
    const latest = JSON.parse(fs.readFileSync(path.join(directory, 'latest.json'), 'utf8'));
    if (!/^[a-f0-9]{16}\.json$/.test(latest.manifest)) throw new Error('Invalid manifest path');
    const manifestPath = path.join(directory, latest.manifest);
    let manifest;
    if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    else if (fs.existsSync(path.join(__dirname, '../docs/implementation/recovery-evidence', latest.manifest))) {
        manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/implementation/recovery-evidence', latest.manifest), 'utf8'));
    }
    else if (!reconstruct) throw new Error('Missing manifest; explicit reconstruction required');
    const target = manifest?.target || latest.target || TARGET;
    if (!validTarget(target) || (manifest && (manifest.source !== SOURCE || manifest.server !== process.env.LMS_TEST_DB_SERVER))) {
        throw new Error('Recovery manifest target mismatch');
    }
    const base = databaseConfiguration();
    const source = createDatabase();
    const restored = createDatabase({ configuration: () => ({ ...base, database: target }) });
    try {
        await assertSyntheticDatabase(source);
        await restored.connect();
        const identity = (await restored.getPool().request().query(`
            SELECT DB_NAME() AS database_name,(SELECT CAST(value AS nvarchar(128)) FROM sys.extended_properties
            WHERE class=0 AND name=N'LMS_SYNTHETIC_ONLY') AS marker;
        `)).recordset[0];
        if (identity.database_name !== target || identity.marker !== 'codex-approved') throw new Error('Restored identity invalid');
        if (!manifest) {
            const suffix = latest.manifest.slice(0, -5);
            const script = fs.readFileSync(path.join(directory, `${suffix}_restore.sql`), 'utf8');
            if (!script.includes(`RESTORE DATABASE [${target}]`) || !script.includes(`${SOURCE}_${suffix}.bak`)) {
                throw new Error('Restore packet does not match reconstruction');
            }
            manifest = {
                source: SOURCE, target, server: process.env.LMS_TEST_DB_SERVER,
                probeCode: `REC_${suffix}`, expectedCounts: reconstructedCounts(await counts(source.getPool())),
                reconstructed: true, reconstructionBasis: 'Current unchanged synthetic source plus the recorded backup probe; original count manifest missing',
                reconstructedAt: new Date().toISOString(),
            };
        }
        const history = async database => (await database.getPool().request()
            .query('SELECT version,checksum FROM schema_migrations ORDER BY version')).recordset;
        if (JSON.stringify(await history(source)) !== JSON.stringify(await history(restored))) throw new Error('Restored migration history differs');
        const actual = await counts(restored.getPool());
        if (JSON.stringify(actual) !== JSON.stringify(manifest.expectedCounts)) {
            const err = new Error('Restored row counts differ');
            err.countDifferences = [...new Set([...Object.keys(actual), ...Object.keys(manifest.expectedCounts)])]
                .filter(table => actual[table] !== manifest.expectedCounts[table])
                .map(table => ({ table, expected: manifest.expectedCounts[table], actual: actual[table] }));
            throw err;
        }
        let sourceProbeNeedsCleanup = false;
        for (const [db, expected] of [[source, 0], [restored, 1]]) {
            const result = await db.getPool().request().input('code', sql.NVarChar(20), manifest.probeCode)
                .query('SELECT COUNT(*) AS count FROM subjects WHERE code=@code');
            if (result.recordset[0].count !== expected) {
                if (db === source && removeRestoredSourceProbe && !manifest.reconstructed && result.recordset[0].count === 1 &&
                    JSON.stringify(await counts(source.getPool())) === JSON.stringify(manifest.expectedCounts)) {
                    sourceProbeNeedsCleanup = true;
                } else throw new Error('Point-in-time recovery probe differs');
            }
        }
        await restored.getPool().request().query('DBCC CHECKDB WITH NO_INFOMSGS;');
        const constraints = await restored.getPool().request().query('DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;');
        if (constraints.recordsets.some(rows => rows.length)) throw new Error('Restored constraint violations');
        if (sourceProbeNeedsCleanup) {
            // The operator restored this same synthetic backup over the source. Only remove
            // its exact disposable marker after the separate copy passes every restore check.
            const removed = await source.getPool().request().input('code', sql.NVarChar(20), manifest.probeCode)
                .query(`DELETE FROM dbo.subjects WHERE code=@code AND name=N'Synthetic recovery probe';`);
            if (removed.rowsAffected[0] !== 1) throw new Error('Point-in-time recovery probe differs');
            manifest.sourceProbeCleanup = { reason: 'Operator restored backup over synthetic source', removed: 1, at: new Date().toISOString() };
        }
        manifest.restoreVerified = true;
        manifest.verifiedAt = new Date().toISOString();
        manifest.verifiedCounts = actual;
        manifest.integrityCheck = 'DBCC CHECKDB completed';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
        const evidence = path.join(__dirname, '../docs/implementation/recovery-evidence');
        fs.mkdirSync(evidence, { recursive: true });
        fs.writeFileSync(path.join(evidence, latest.manifest), JSON.stringify(manifest, null, 2) + '\n');
        console.log('Restore verified: database identity, all table counts, recovery probe and DBCC CHECKDB passed.');
        return manifest;
    } finally {
        await restored.close();
        await source.close();
    }
}

if (require.main === module) {
    const action = process.argv[2];
    const operation = action === 'prepare' ? () => prepare({ uniqueTarget: process.argv.includes('--unique-target') }) : action === 'verify' ? () => verify({ reconstruct: process.argv.includes('--reconstruct-manifest'), removeRestoredSourceProbe: process.argv.includes('--remove-restored-source-probe') }) : null;
    if (!operation) { console.error('Choose prepare or verify for the synthetic rehearsal'); process.exitCode = 1; }
    else operation().catch(err => {
        const safe = ['Restored row counts differ', 'Point-in-time recovery probe differs', 'Restored migration history differs',
            'Restored identity invalid', 'Restored constraint violations', 'Missing recovery probe table',
            'Recovery manifest target mismatch', 'Missing manifest; explicit reconstruction required'];
        const reason = safe.includes(err.message) ? err.message : 'Connection, permission or recovery precondition failed';
        console.error(`Recovery rehearsal stopped: phase=${err.recoveryPhase || action}, code=${err.code || 'precondition'}, number=${err.number || 'n/a'}, reason=${reason}. Credentials withheld.`);
        if (process.argv.includes('--diagnostics') && err.countDifferences) console.error(JSON.stringify({ syntheticCountDifferences: err.countDifferences }));
        process.exitCode = 1;
    });
}

module.exports = { prepare, verify, restoreScript, reconstructedCounts };
