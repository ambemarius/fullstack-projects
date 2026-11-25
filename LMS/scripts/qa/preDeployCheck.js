#!/usr/bin/env node
// KodoSchool pre-deployment QA review.
//
// Runs the checks a QA engineer goes through before a release, and prints a PASS / WARN / FAIL report.
// Exit code 1 when any check fails, so it can gate a deployment pipeline.
//
//   npm run qa                                   all checks against http://localhost:2026
//   npm run qa -- --base https://staging.example  another environment
//   npm run qa -- --skip-tests --skip-db         only the HTTP checks
//   npm run qa -- --json qa-report.json          also write the report as JSON
//
// Optional signed-in checks (a QA account in a test or staging school, never real users):
//   QA_TEACHER_EMAIL, QA_TEACHER_PASSWORD        teacher sign-in and the teacher's main screens
//   QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, QA_SCHOOL_CODE   administrator sign-in and the admin screens
//
// Sections
//   1. Repository     test suite, secrets not tracked by git, migrations numbered in order
//   2. Configuration  required environment variables set and strong enough
//   3. Database       migrations applied, school isolation in place (school_id required, row-level security)
//   4. HTTP           health, public pages, security headers, no inline scripts, errors do not leak internals,
//                     protected APIs refuse anonymous callers, response times
//   5. Signed in      sign-in works and the main screens answer (only with QA credentials)
const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const flag = name => args.includes('--' + name);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const BASE = option('base', process.env.QA_BASE_URL || 'http://localhost:2026').replace(/\/+$/, '');
const SLOW_MS = Number(option('slow-ms', 1500));

const results = [];
let section = '';
const record = (status, name, detail = '') => results.push({ section, status, name, detail });
const pass = (name, detail) => record('PASS', name, detail);
const warn = (name, detail) => record('WARN', name, detail);
const fail = (name, detail) => record('FAIL', name, detail);
async function check(name, fn) {
    try { await fn(); } catch (err) { fail(name, err.message.split('\n')[0]); }
}

async function http(pathname, options = {}) {
    const started = Date.now();
    const res = await fetch(BASE + pathname, { redirect: 'manual', ...options });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json, ms: Date.now() - started };
}

// ---------------------------------------------------------------- 1. repository
async function repository() {
    section = 'Repository';
    if (flag('skip-tests')) warn('Automated test suite', 'skipped (--skip-tests)');
    else await check('Automated test suite', () => {
        const run = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', timeout: 15 * 60 * 1000 });
        const out = (run.stdout || '') + (run.stderr || '');
        const passed = (out.match(/ℹ pass (\d+)/) || [])[1], failed = (out.match(/ℹ fail (\d+)/) || [])[1];
        if (run.status === 0 && failed === '0') pass('Automated test suite', `${passed} tests passed`);
        else fail('Automated test suite', `${failed ?? '?'} failed, ${passed ?? '?'} passed`);
    });

    await check('Secrets are not tracked by git', () => {
        let tracked = '';
        try { tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }); } catch { return warn('Secrets are not tracked by git', 'not a git checkout'); }
        const risky = tracked.split('\n').filter(f => /(^|\/)(\.env(\..*)?|config\/\.env|.*\.pem|.*\.key|.*\.bak|test_accounts\.csv)$/i.test(f) && !/\.(example|sample|template)$/i.test(f));   // templates hold no real secrets
        if (risky.length) fail('Secrets are not tracked by git', risky.join(', '));
        else pass('Secrets are not tracked by git', 'no .env, keys, backups or account lists in git');
    });

    await check('Migrations are numbered in order', () => {
        const files = fs.readdirSync(path.join(ROOT, 'migrations')).filter(f => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
        const numbers = files.map(f => Number(f.slice(0, 3)));
        const gaps = numbers.filter((n, i) => i && n !== numbers[i - 1] + 1);
        const dupes = numbers.filter((n, i) => numbers.indexOf(n) !== i);
        if (dupes.length) fail('Migrations are numbered in order', `duplicate numbers: ${dupes.join(', ')}`);
        else if (gaps.length) warn('Migrations are numbered in order', `gaps before: ${gaps.join(', ')}`);
        else pass('Migrations are numbered in order', `${files.length} files, ${files[0]} … ${files[files.length - 1]}`);
    });
}

// ---------------------------------------------------------------- 2. configuration
async function configuration() {
    section = 'Configuration';
    try { require(path.join(ROOT, 'config/environment')).loadEnvironment(); } catch { /* reported below */ }
    const env = process.env;
    const secret = env.JWT_SECRET || '';
    if (Buffer.byteLength(secret) >= 32) pass('JWT_SECRET is set and long enough', `${Buffer.byteLength(secret)} bytes`);
    else fail('JWT_SECRET is set and long enough', 'missing or shorter than 32 bytes');
    if (env.DB_STRING || env.LMS_TEST_DB_SERVER) pass('Database connection configured');
    else fail('Database connection configured', 'DB_STRING is not set');
    if (env.NODE_ENV === 'production') pass('NODE_ENV is production');
    else warn('NODE_ENV is production', `NODE_ENV=${env.NODE_ENV || '(not set)'}; fine for staging, not for the live server`);
    if (/^https:\/\//.test(env.PUBLIC_ORIGIN || '')) pass('PUBLIC_ORIGIN uses HTTPS', env.PUBLIC_ORIGIN);
    else warn('PUBLIC_ORIGIN uses HTTPS', 'not set to an https:// address (cookie and same-origin checks rely on it in production)');
}

// ---------------------------------------------------------------- 3. database
async function database() {
    section = 'Database';
    if (flag('skip-db')) return warn('Database checks', 'skipped (--skip-db)');
    let db;
    try {
        db = require(path.join(ROOT, 'config/database'));
        await db.poolConnect;
    } catch (err) {
        return fail('Database reachable', err.message);
    }
    const q = s => db.pool.request().query(s).then(r => r.recordset);
    pass('Database reachable');

    await check('All migrations applied', async () => {
        const files = fs.readdirSync(path.join(ROOT, 'migrations')).filter(f => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
        const applied = (await q('SELECT version FROM schema_migrations')).map(r => r.version);
        const pending = files.filter(f => !applied.includes(f));
        if (pending.length) fail('All migrations applied', `pending: ${pending.join(', ')}`);
        else pass('All migrations applied', `${applied.length} applied`);
    });
    await check('Row-level security is on', async () => {
        const rows = await q(`SELECT p.is_enabled, (SELECT COUNT(DISTINCT target_object_id) FROM sys.security_predicates WHERE object_id = p.object_id) AS tables
            FROM sys.security_policies p WHERE p.name = 'school_isolation'`);
        if (!rows.length) fail('Row-level security is on', 'policy school_isolation missing');
        else if (!rows[0].is_enabled) fail('Row-level security is on', 'policy exists but is disabled');
        else pass('Row-level security is on', `${rows[0].tables} school tables protected`);
    });
    await check('Every school table requires school_id and is protected', async () => {
        const rows = await q(`SELECT t.name,
                CASE WHEN EXISTS (SELECT 1 FROM sys.security_predicates sp WHERE sp.target_object_id = t.object_id) THEN 1 ELSE 0 END AS protected
            FROM sys.tables t WHERE EXISTS (SELECT 1 FROM sys.check_constraints c WHERE c.parent_object_id = t.object_id AND c.name = 'CK_' + t.name + '_school_required')`);
        const open = rows.filter(r => !r.protected).map(r => r.name);
        if (open.length) fail('Every school table requires school_id and is protected', `not under row-level security: ${open.join(', ')}`);
        else pass('Every school table requires school_id and is protected', `${rows.length} tables`);
    });
    await check('No fixed school default left', async () => {
        const rows = await q(`SELECT OBJECT_NAME(dc.parent_object_id) AS t FROM sys.default_constraints dc
            JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
            WHERE c.name = 'school_id' AND dc.definition NOT LIKE '%SESSION_CONTEXT%'`);
        if (rows.length) fail('No fixed school default left', rows.map(r => r.t).join(', '));
        else pass('No fixed school default left', 'new rows take the signed-in school');
    });
    await check('At least one active school and one KodoSchool admin', async () => {
        const [s] = await q("SELECT (SELECT COUNT(*) FROM schools WHERE status = 'active') AS schools, (SELECT COUNT(*) FROM platform_admins WHERE status = 'active') AS admins");
        if (!s.schools) fail('At least one active school and one KodoSchool admin', 'no active school');
        else if (!s.admins) warn('At least one active school and one KodoSchool admin', `${s.schools} schools, but no platform admin to validate sign-ups`);
        else pass('At least one active school and one KodoSchool admin', `${s.schools} schools, ${s.admins} platform admin(s)`);
    });
    try { await db.close(); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- 4. HTTP
const PUBLIC_PAGES = ['/', '/modules', '/pricing', '/signup', '/login', '/platform/login'];
const PROTECTED_APIS = ['/api/v1/students', '/api/v1/teachers', '/api/v1/notifications', '/api/v1/platform/schools', '/api/v1/promotion/preview?classId=1&yearId=1', '/api/v1/schools/mine', '/api/v1/report-cards/settings'];

async function httpChecks() {
    section = 'HTTP';
    let health;
    try { health = await http('/health'); } catch (err) { return fail('Server reachable', `${BASE} did not answer (${err.cause?.code || err.message})`); }
    if (health.status === 200 && health.json?.database === 'ok') pass('Health check', `version ${health.json.version}, database ok, ${health.ms} ms`);
    else fail('Health check', `status ${health.status}, database ${health.json?.database}`);

    for (const page of PUBLIC_PAGES) {
        await check(`Page ${page}`, async () => {
            const r = await http(page);
            const problems = [];
            if (r.status !== 200) problems.push(`status ${r.status}`);
            if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(r.text)) problems.push('inline script (blocked by the CSP)');
            if (!/<title>[^<]+<\/title>/i.test(r.text)) problems.push('no <title>');
            if (!/<meta name="viewport"/i.test(r.text)) problems.push('no viewport meta (phones)');
            if (!/<html lang="/i.test(r.text)) problems.push('no lang attribute');
            if (/undefined|\[object Object\]|NaN<\//.test(r.text.replace(/<script[\s\S]*?<\/script>/gi, ''))) problems.push('"undefined" or "NaN" in the page');
            if (problems.length) fail(`Page ${page}`, problems.join('; '));
            else if (r.ms > SLOW_MS) warn(`Page ${page}`, `slow: ${r.ms} ms`);
            else pass(`Page ${page}`, `${r.ms} ms`);
        });
    }

    await check('Security headers', async () => {
        const r = await http('/');
        const h = name => r.headers.get(name) || '';
        const missing = [];
        const csp = h('content-security-policy');
        if (!csp) missing.push('Content-Security-Policy');
        else {
            if (!/script-src 'self'/.test(csp) || /script-src[^;]*'unsafe-inline'/.test(csp)) missing.push("CSP script-src 'self' without 'unsafe-inline'");
            if (!/frame-ancestors 'none'/.test(csp)) missing.push("CSP frame-ancestors 'none'");
        }
        if (h('x-content-type-options') !== 'nosniff') missing.push('X-Content-Type-Options: nosniff');
        if (h('x-powered-by')) missing.push('X-Powered-By should be removed');
        if (!h('referrer-policy')) missing.push('Referrer-Policy');
        if (BASE.startsWith('https://') && !h('strict-transport-security')) missing.push('Strict-Transport-Security');
        if (missing.length) fail('Security headers', missing.join('; '));
        else pass('Security headers', 'CSP, nosniff, referrer policy, no X-Powered-By');
    });

    for (const api of PROTECTED_APIS) {
        await check(`Anonymous refused: ${api}`, async () => {
            const r = await http(api, { headers: { Accept: 'application/json' } });
            if (r.status === 401 || r.status === 403) pass(`Anonymous refused: ${api.split('?')[0]}`, String(r.status));
            else fail(`Anonymous refused: ${api.split('?')[0]}`, `answered ${r.status} without signing in`);
        });
    }

    await check('Forged token refused', async () => {
        const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiYWNjb3VudFR5cGUiOiJhZG1pbiIsInRva2VuVmVyc2lvbiI6Mn0.invalid-signature';
        const r = await http('/api/v1/students', { headers: { Authorization: 'Bearer ' + forged } });
        if (r.status === 401) pass('Forged token refused', '401');
        else fail('Forged token refused', `answered ${r.status}`);
    });

    await check('Errors do not leak internals', async () => {
        const r = await http('/api/v1/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":' });
        const leaks = /at \w+ \(|node_modules|stack|SQL|mssql|ECONN|C:\\|\/home\//i.test(r.text);
        if (r.status >= 500) fail('Errors do not leak internals', `malformed JSON gave ${r.status}`);
        else if (leaks) fail('Errors do not leak internals', 'response contains a stack trace or internal path');
        else pass('Errors do not leak internals', `malformed request → ${r.status}, clean message`);
    });

    await check('Unknown address gives 404', async () => {
        const r = await http('/this-page-does-not-exist-' + Date.now());
        if (r.status === 404) pass('Unknown address gives 404');
        else warn('Unknown address gives 404', `answered ${r.status}`);
    });

    await check('Sign-in refuses a wrong password', async () => {
        const r = await http('/api/v1/teachers/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'qa-nobody@example.invalid', password: 'not-the-password-1' }) });
        if (r.status === 401 && !r.json?.token) pass('Sign-in refuses a wrong password', '401, no token');
        else if (r.status === 429) warn('Sign-in refuses a wrong password', 'rate-limited (too many recent attempts)');
        else fail('Sign-in refuses a wrong password', `answered ${r.status}`);
    });

    await check('Static assets are served', async () => {
        const assets = ['/css/style.css', '/css/site.css', '/js/app.js', '/js/i18n.js', '/js/notify-bell.js', '/fonts/inter-latin-wght.woff2'];
        const bad = [];
        for (const a of assets) { const r = await fetch(BASE + a); if (r.status !== 200) bad.push(`${a} ${r.status}`); }
        if (bad.length) fail('Static assets are served', bad.join(', '));
        else pass('Static assets are served', `${assets.length} files`);
    });
}

// ---------------------------------------------------------------- 5. signed in
async function signedIn() {
    section = 'Signed in';
    const env = process.env;
    if (!env.QA_TEACHER_EMAIL && !env.QA_ADMIN_EMAIL) return warn('Signed-in checks', 'skipped: set QA_TEACHER_EMAIL/QA_TEACHER_PASSWORD or QA_ADMIN_* to run them');

    async function signIn(kind, body) {
        const r = await http(`/api/v1/${kind}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (r.status !== 200 || !r.json?.token) throw new Error(`sign-in answered ${r.status}: ${r.json?.message || ''}`);
        return r.json.token;
    }
    async function screens(label, token, list) {
        for (const p of list) {
            await check(`${label}: ${p}`, async () => {
                const r = await http(p, { headers: { Authorization: 'Bearer ' + token } });
                if (r.status !== 200) return fail(`${label}: ${p}`, `status ${r.status}: ${r.json?.message || ''}`);
                if (r.ms > SLOW_MS) return warn(`${label}: ${p}`, `slow: ${r.ms} ms`);
                pass(`${label}: ${p}`, `${r.ms} ms`);
            });
        }
    }
    if (env.QA_TEACHER_EMAIL) {
        await check('Teacher sign-in', async () => {
            const token = await signIn('teachers', { email: env.QA_TEACHER_EMAIL, password: env.QA_TEACHER_PASSWORD });
            pass('Teacher sign-in', 'token issued');
            await screens('Teacher', token, ['/api/v1/teachers/profile', '/api/v1/teachers/my-subjects', '/api/v1/teachers/my-students', '/api/v1/attendance/my-lessons', '/api/v1/notifications']);
        });
    }
    if (env.QA_ADMIN_EMAIL) {
        await check('Administrator sign-in', async () => {
            const token = await signIn('admin', { email: env.QA_ADMIN_EMAIL, password: env.QA_ADMIN_PASSWORD, schoolCode: env.QA_SCHOOL_CODE });
            pass('Administrator sign-in', 'token issued');
            await screens('Admin', token, ['/api/v1/admin/profile', '/api/v1/students', '/api/v1/teachers', '/api/v1/classes', '/api/v1/schools/mine', '/api/v1/notifications', '/api/v1/notifications/announcements']);
        });
    }
}

// ---------------------------------------------------------------- report
function report() {
    const icon = { PASS: '✔', WARN: '!', FAIL: '✖' };
    const color = { PASS: '\x1b[32m', WARN: '\x1b[33m', FAIL: '\x1b[31m' };
    const plain = !process.stdout.isTTY;
    console.log(`\nKodoSchool pre-deployment QA review — ${BASE} — ${new Date().toISOString()}\n`);
    let last = '';
    for (const r of results) {
        if (r.section !== last) { console.log(`\n${r.section}`); last = r.section; }
        const mark = plain ? `[${r.status}]` : `${color[r.status]}${icon[r.status]} ${r.status}\x1b[0m`;
        console.log(`  ${mark}  ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    }
    const count = s => results.filter(r => r.status === s).length;
    const verdict = count('FAIL') ? 'NOT READY: fix the failures above before deploying.' : count('WARN') ? 'READY WITH WARNINGS: review the warnings.' : 'READY TO DEPLOY.';
    console.log(`\n${count('PASS')} passed · ${count('WARN')} warnings · ${count('FAIL')} failed\n${verdict}\n`);
    const out = option('json');
    if (out) {
        fs.writeFileSync(out, JSON.stringify({ base: BASE, at: new Date().toISOString(), summary: { pass: count('PASS'), warn: count('WARN'), fail: count('FAIL') }, results }, null, 2));
        console.log(`Report written to ${out}`);
    }
    return count('FAIL') ? 1 : 0;
}

(async () => {
    await repository();
    await configuration();
    await database();
    await httpChecks();
    await signedIn();
    process.exit(report());
})().catch(err => { console.error('QA review crashed:', err); process.exit(2); });
