// KodoSchool platform console: KodoSchool's own administrators sign in separately, belong to no school,
// see each school's counts and activity dates, validate sign-ups and suspend schools; school accounts cannot.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const ejs = require('ejs');
const { createApp } = require('../app/app');
const generateToken = require('../utils/generateToken');
const verifyToken = require('../utils/verifyToken');
const { optionalSchoolId } = require('../utils/tenant');
const { createPlatformConsoleService } = require('../model/platform/platformConsoleService');
const { serve } = require('./helpers/http');

async function consoleApp(t, { admin = { id: 1, name: 'KodoSchool Ops', email: 'ops@kodoschool.invalid', status: 'active' } } = {}) {
    const hash = await bcrypt.hash('synthetic-console-pass1', 4);
    const logged = [], seen = {};
    const app = createApp({ logging: false });
    app.locals.platformAdminModel = {
        findForLogin: async email => (email === admin.email ? { ...admin, password: hash } : null),
        verifyPassword: (p, h) => bcrypt.compare(p, h),
        touchLogin: async () => {}, passwordHash: async () => hash, setPassword: async () => { seen.password = true; },
    };
    app.locals.platformConsoleService = {
        log: async (actorId, action, extra) => logged.push({ actorId, action, ...extra }),
        schools: async () => { seen.school = optionalSchoolId(); return { schools: [{ id: 1, name: 'Lycée Batouri', students: 257 }], totals: { schools: 1 } }; },
        setStatus: async (actor, id, status, reason) => ({ id: Number(id), status, reason }),
        audit: async () => [],
    };
    app.locals.schoolSignupService = {
        list: async () => ({ status: 'pending', requests: [], counts: {}, isolationReady: false }),
        approve: async () => ({ status: 'approved', schoolId: 9, schoolCode: 'NEW_SCHOOL' }),
        reject: async () => ({ status: 'rejected' }),
    };
    const PlatformAdmin = require('../model/platform/platformAdmin');
    t.mock.method(PlatformAdmin, 'findById', async id => (id === admin.id ? { id, name: admin.name, email: admin.email, status: admin.status } : null));
    const base = await serve(t, app);
    return { base, logged, seen };
}
const json = (method, body, token) => ({ method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body && JSON.stringify(body) });

test('a KodoSchool admin signs in with a platform token that carries no school, and the sign-in is logged', async t => {
    const { base, logged } = await consoleApp(t);
    const bad = await fetch(base + '/api/v1/platform/login', json('POST', { email: 'ops@kodoschool.invalid', password: 'wrong' }));
    assert.equal(bad.status, 401);
    const res = await fetch(base + '/api/v1/platform/login', json('POST', { email: 'ops@kodoschool.invalid', password: 'synthetic-console-pass1' }));
    assert.equal(res.status, 200);
    const body = await res.json();
    const claims = verifyToken(body.data.token, 'platform');
    assert.deepEqual([claims.id, claims.accountType, claims.sid], [1, 'platform', undefined], 'belongs to no school');
    assert.equal(Object.hasOwn(body.data.admin, 'password'), false);
    assert.equal(res.headers.get('set-cookie'), null, 'no cookie: a school sign-in in the same browser is left alone');
    assert.deepEqual(logged.map(l => l.action), ['signed_in']);
});

test('only platform accounts reach the console; school administrators and teachers do not', async t => {
    const { base, seen } = await consoleApp(t);
    const get = (p, token) => fetch(base + p, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    assert.equal((await get('/api/v1/platform/schools')).status, 401);
    assert.equal((await get('/api/v1/platform/schools', generateToken(7, 'admin', undefined, 1))).status, 401, 'a school administrator');
    assert.equal((await get('/api/v1/platform/signups', generateToken(3, 'teacher', undefined, 1))).status, 401, 'a teacher');
    const platform = generateToken(1, 'platform');
    const ok = await get('/api/v1/platform/schools', platform);
    assert.equal(ok.status, 200);
    assert.equal(seen.school, null, 'console requests run with no school set');
    assert.equal((await get('/api/v1/platform/signups', platform)).status, 200);
    assert.equal((await get('/api/v1/platform/me', generateToken(2, 'platform'))).status, 401, 'an unknown platform account');
});

test('approving, rejecting and suspending are logged with who did it', async t => {
    const { base, logged } = await consoleApp(t);
    const token = generateToken(1, 'platform');
    assert.equal((await fetch(base + '/api/v1/platform/signups/4/approve', json('POST', null, token))).status, 200);
    assert.equal((await fetch(base + '/api/v1/platform/signups/5/reject', json('POST', { note: 'Not a school' }, token))).status, 200);
    const s = await fetch(base + '/api/v1/platform/schools/2/status', json('PUT', { status: 'suspended', reason: 'Unpaid' }, token));
    assert.equal(s.status, 200);
    assert.deepEqual(logged.map(l => [l.actorId, l.action]), [[1, 'signup_approved'], [1, 'signup_rejected']]);
    const p = await fetch(base + '/api/v1/platform/password', json('PUT', { current: 'synthetic-console-pass1', next: 'short1' }, token));
    assert.equal(p.status, 422, 'console passwords need at least 12 characters');
});

test('the console service: counts and dates only, suspend needs a reason, and is logged', async () => {
    const calls = [];
    const query = async (statement, params = {}) => {
        calls.push({ statement, params });
        if (statement.includes('FROM schools s ORDER BY')) return { recordset: [{ id: 1, status: 'active', students: 257, teachers: 30 }, { id: 2, status: 'suspended', students: 10, teachers: 2 }] };
        if (statement.includes("school_signup_requests WHERE status = 'pending'")) return { recordset: [{ n: 3 }] };
        if (statement.includes('SELECT id, name, status FROM schools')) return { recordset: [{ id: 2, name: 'X', status: 'active' }] };
        return { recordset: [] };
    };
    const svc = createPlatformConsoleService({ query });
    const { totals } = await svc.schools();
    assert.deepEqual(totals, { schools: 2, active: 1, students: 267, teachers: 32, pendingSignups: 3 });
    const overview = calls[0].statement;
    assert.equal(/firstName|lastName|score\b|amount/.test(overview), false, 'no names, marks or amounts');
    await assert.rejects(svc.setStatus({ id: 1 }, 2, 'suspended', ''), e => e.statusCode === 422);
    assert.deepEqual(await svc.setStatus({ id: 1 }, 2, 'suspended', 'Unpaid licence'), { id: 2, status: 'suspended' });
    assert.ok(calls.some(c => c.statement.includes('INSERT INTO platform_audit_log') && c.params.action[1] === 'school_suspended'));
});

test('console pages render without inline scripts; migration 023 adds the platform tables only', async () => {
    for (const view of ['platform-login', 'platform-console']) {
        const html = await ejs.renderFile(path.join(__dirname, `../views/${view}.ejs`), {});
        assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, view);
        assert.ok(html.includes('<meta name="robots" content="noindex">'), view);
    }
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/023_platform_admins.sql'), 'utf8');
    assert.match(sql, /CREATE TABLE dbo\.platform_admins/);
    assert.match(sql, /CREATE TABLE dbo\.platform_audit_log/);
    assert.equal(/\bschool_id\b/.test(sql), false, 'platform accounts belong to no school');
});
