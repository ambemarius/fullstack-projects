// Temporary browser acceptance host. Existing synthetic fixtures only; never starts on port2027.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const express = require('express');
const { loadTestEnvironment, assertSyntheticDatabase } = require('./testEnvironment');
const { createDatabase, sql } = require('../config/database');
const { createPreviewApp } = require('./m1Preview');
const { COOKIE } = require('../middlewares/canonicalSession');
const ACCEPTANCE_COOKIE = '__Host-lms_acceptance_session';
const ORIGIN = 'https://localhost:2028';

function isolatePreviewCookies(app) {
    const wrapper = express();
    wrapper.disable('x-powered-by');
    wrapper.use((req, res, next) => {
        // Cookies are host-wide, not port-wide. Never consume or replace the real-school cookie.
        const matches = (req.headers.cookie || '').split(';').map(value => value.trim())
            .filter(value => value.startsWith(ACCEPTANCE_COOKIE + '='));
        if (matches.length === 1) req.headers.cookie = COOKIE + matches[0].slice(ACCEPTANCE_COOKIE.length);
        else delete req.headers.cookie;
        const setHeader = res.setHeader;
        res.setHeader = function (name, value) {
            if (name.toLowerCase() === 'set-cookie') {
                const rename = cookie => cookie.startsWith(COOKIE + '=') ? ACCEPTANCE_COOKIE + cookie.slice(COOKIE.length) : cookie;
                value = Array.isArray(value) ? value.map(rename) : rename(value);
            }
            return setHeader.call(this, name, value);
        };
        next();
    });
    wrapper.use(app);
    return wrapper;
}

async function existingSamples(db, directory) {
    await assertSyntheticDatabase(db);
    const filename = path.join(directory, 'm1-preview-private.json');
    if (!fs.existsSync(filename)) throw Error('Existing synthetic browser fixtures are required; no seeding performed');
    const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (saved.format !== 'm1-synthetic-preview-v1' || saved.schools?.length !== 2 || saved.accounts?.length !== 6) throw Error('Invalid fixture evidence');
    for (const code of ['M1_DEMO_A', 'M1_DEMO_B']) {
        const school = saved.schools.find(row => row.code === code);
        if (!school || !Number.isSafeInteger(school.id)) throw Error('Invalid synthetic school');
        const rows = (await db.getPool().request().input('id', sql.Int, school.id).input('code', sql.NVarChar(50), code)
            .query("SELECT id FROM dbo.schools WHERE id=@id AND code=@code AND status='active'")).recordset;
        if (rows.length !== 1) throw Error('Synthetic school changed; no reseeding performed');
        for (const role of ['admin', 'teacher', 'student']) {
            if (saved.accounts.filter(account => account.schoolCode === code && account.role === role).length !== 1) throw Error('Invalid sample account roles');
        }
    }
    return saved;
}

async function main() {
    loadTestEnvironment();
    const db = createDatabase();
    try {
        await assertSyntheticDatabase(db);
        const expected = require('./migrate').migrationFiles();
        const installed = (await db.getPool().request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
        if (JSON.stringify(installed.map(row => [row.version, row.checksum])) !== JSON.stringify(expected.map(row => [row.name, row.checksum]))) throw Error('Synthetic schema differs from reviewed migrations');
        const directory = path.join(__dirname, '../backups/runtime'), samples = await existingSamples(db, directory);
        const app = isolatePreviewCookies(createPreviewApp(db, samples, ORIGIN));
        const server = https.createServer({ key: fs.readFileSync(path.join(directory, 'tls/localhost.key')), cert: fs.readFileSync(path.join(directory, 'tls/localhost.crt')) }, app);
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(2028, '127.0.0.1', resolve); });
        console.log('Synthetic acceptance preview ready: ' + ORIGIN + '; existing fixtures, isolated cookie, no real database connection.');
        for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => db.close()));
    } catch (error) { await db.close(); throw error; }
}
if (require.main === module) main().catch(() => { console.error('Acceptance preview refused startup; credentials withheld. No seed or migration performed.'); process.exitCode = 1; });
module.exports = { isolatePreviewCookies, existingSamples, ACCEPTANCE_COOKIE };
