// School data isolation, foundation: the school comes from the signed sign-in (never from a form), every
// query tells SQL Server which school is active, sign-in looks only inside the chosen school, and the
// migration makes school_id required and stamped. Two schools share class names, emails and phone numbers.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app/app');
const { withDatabase, withSchoolContext, sql } = require('../config/database');
const { authConfiguration } = require('../config/auth');
const generateToken = require('../utils/generateToken');
const verifyToken = require('../utils/verifyToken');
const { runWithSchool, runWithoutSchool, optionalSchoolId, currentSchoolId } = require('../utils/tenant');
const { resolveLoginSchool } = require('../utils/loginSchool');
const { tenantContext, confirmSchool } = require('../middlewares/tenantContext');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const SCHOOLS = [
    { id: 1, code: 'LYCEE_BATOURI', name: 'Lycée Batouri', status: 'active' },
    { id: 2, code: 'GBHS_BERTOUA', name: 'GBHS Bertoua', status: 'active' },
    { id: 3, code: 'CLOSED_SCHOOL', name: 'Closed', status: 'suspended' },
];
const schoolRead = schools => async (statement, params) => {
    if (statement.includes('UPPER(code) = @code')) return { recordset: schools.filter(s => s.code === params.code) };
    return { recordset: schools.filter(s => s.status === 'active').slice(0, 2) };
};

test('the tenant context: set for a block of work, required where asked for, never inherited by "no school"', async () => {
    assert.equal(optionalSchoolId(), null);
    assert.throws(() => currentSchoolId(), /No school is set/);
    await runWithSchool(42, async () => {
        await new Promise(r => setTimeout(r, 1));
        assert.equal(currentSchoolId(), 42, 'survives awaits');
        runWithoutSchool(() => assert.equal(optionalSchoolId(), null));
    });
    assert.throws(() => runWithSchool('42', () => {}), /valid school id/);
    assert.throws(() => runWithSchool(0, () => {}), /valid school id/);
});

test('every query tells SQL Server the active school, or NULL, so pooled connections never carry one over', () => {
    assert.equal(sql.Request.prototype.kodoSchoolContext, true, 'the mssql request is wrapped once');
    const sent = runWithSchool(42, () => withSchoolContext('SELECT * FROM students'));
    assert.match(sent, /^EXEC sys\.sp_set_session_context @key = N'school_id', @value = 42;\nSELECT \* FROM students$/);
    assert.match(withSchoolContext('SELECT 1'), /@value = NULL;\nSELECT 1$/, 'no school: reset to NULL');
    assert.equal(withSchoolContext('CREATE VIEW v AS SELECT 1'), 'CREATE VIEW v AS SELECT 1', 'statements that must open a batch are untouched');
    assert.equal(withSchoolContext('-- note\nCREATE OR ALTER PROCEDURE p AS SELECT 1'), '-- note\nCREATE OR ALTER PROCEDURE p AS SELECT 1');
    const tagged = ['SELECT ', ''];
    assert.equal(withSchoolContext(tagged), tagged, 'tagged templates are left alone');
});

test('the sign-in token carries the school as a signed claim; a forged or malformed one is refused', () => {
    const token = generateToken(9, 'teacher', undefined, 2);
    assert.equal(verifyToken(token, 'teacher').sid, 2);
    assert.equal(verifyToken(generateToken(9, 'teacher')).sid, undefined, 'older tokens without a school still verify');
    assert.throws(() => generateToken(9, 'teacher', undefined, -1), /Invalid school/);
    const config = authConfiguration();
    const forged = jwt.sign({ id: 9, accountType: 'teacher', tokenVersion: 2, sid: '2' }, config.secret,
        { algorithm: config.algorithm, issuer: config.issuer, audience: config.audience, subject: '9', expiresIn: '1h' });
    assert.equal(verifyToken(forged), false, 'a non-numeric school claim is rejected');
});

test('each request runs inside its token\'s school; school ids in headers, query strings and bodies are ignored', async t => {
    const app = express();
    app.use(express.json());
    app.use(tenantContext);
    app.all('/where', (req, res) => res.json({ school: optionalSchoolId(), reqSchool: req.schoolId }));
    const base = await serve(t, app);
    const call = (token, extra = {}) => fetch(`${base}/where?school_id=2`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-School-Id': '2', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ school_id: 2, schoolId: 2, ...extra }),
    }).then(r => r.json());
    assert.deepEqual(await call(generateToken(4, 'admin', undefined, 1)), { school: 1, reqSchool: 1 });
    assert.deepEqual(await call(null), { school: null, reqSchool: null });
    assert.deepEqual(await call('not-a-token'), { school: null, reqSchool: null });
});

test('the account decides the school: a token for another school is refused, older tokens take the account\'s school', async () => {
    const run = (claims, account) => new Promise(resolve => {
        const req = {};
        confirmSchool(req, claims, account, err => resolve(err ? { status: err.statusCode } : { school: optionalSchoolId(), reqSchool: req.schoolId }));
    });
    assert.deepEqual(await run({ id: 4, sid: 2 }, { school_id: 1 }), { status: 401 });
    assert.deepEqual(await run({ id: 4, sid: 1 }, { school_id: 1 }), { school: 1, reqSchool: 1 });
    assert.deepEqual(await run({ id: 4 }, { school_id: 2 }), { school: 2, reqSchool: 2 });
});

test('the school code at sign-in: known and active only; optional while a single school is active', async () => {
    const read = schoolRead(SCHOOLS);
    assert.deepEqual(await resolveLoginSchool('gbhs-bertoua', read), { id: 2, code: 'GBHS_BERTOUA', name: 'GBHS Bertoua' });
    await assert.rejects(resolveLoginSchool('NOPE', read), e => e.statusCode === 401, 'unknown code answers like a wrong password');
    await assert.rejects(resolveLoginSchool('CLOSED_SCHOOL', read), e => e.statusCode === 401, 'suspended school');
    await assert.rejects(resolveLoginSchool("x'; DROP TABLE schools;--", read), e => e.statusCode === 400);
    await assert.rejects(resolveLoginSchool('', read), e => e.statusCode === 400 && /school code/.test(e.message), 'two active schools need a code');
    assert.equal((await resolveLoginSchool('', schoolRead([SCHOOLS[0]]))).id, 1, 'one school: the code can be left out');
});

test('sign-in looks only inside the chosen school: the same email in two schools signs in to the right one', async t => {
    const hash = await bcrypt.hash('synthetic-password', 4);
    const teachers = [
        { id: 11, name: 'Ada', email: 'same@example.invalid', status: 'active', school_id: 1, password: hash },
        { id: 21, name: 'Ada', email: 'same@example.invalid', status: 'active', school_id: 2, password: hash },
    ];
    const db = syntheticDatabase((statement, params) => {
        if (statement.includes('FROM teachers WHERE email')) {
            assert.match(statement, /school_id = @school/, 'the lookup is filtered by school');
            return { recordset: teachers.filter(r => r.email === params.email && (params.school === null || r.school_id === params.school)) };
        }
        throw new Error('unexpected statement: ' + statement);
    });
    const app = createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
    app.locals.resolveLoginSchool = code => resolveLoginSchool(code, schoolRead(SCHOOLS));
    const base = await serve(t, app);
    const login = schoolCode => fetch(`${base}/api/v1/teachers/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'same@example.invalid', password: 'synthetic-password', schoolCode, school_id: 1 }) });

    const second = await login('GBHS_BERTOUA');
    assert.equal(second.status, 200);
    const claims = verifyToken((await second.json()).token, 'teacher');
    assert.deepEqual([claims.id, claims.sid], [21, 2], 'school 2\'s teacher, despite school_id: 1 in the body');
    const first = verifyToken((await (await login('LYCEE_BATOURI')).json()).token, 'teacher');
    assert.deepEqual([first.id, first.sid], [11, 1]);
    assert.equal((await login('')).status, 400, 'with two schools a code is needed');
    assert.equal((await login('NOPE')).status, 401);
});

test('migration 021 makes school_id required and stamped from the request, and parents unique per school', () => {
    const text = fs.readFileSync(path.join(__dirname, '../migrations/021_school_isolation_foundation.sql'), 'utf8');
    for (const table of ['parent_students', 'subject_score_history', 'staff_duty_classes', 'staff_duty_departments', 'notifications']) {
        assert.match(text, new RegExp(`COL_LENGTH\\('dbo\\.${table}', 'school_id'\\) IS NULL ALTER TABLE dbo\\.${table} ADD school_id INT NULL`), table);
    }
    assert.match(text, /CHECK \(school_id IS NOT NULL\)/);
    assert.match(text, /DEFAULT \(CONVERT\(INT, SESSION_CONTEXT\(N''school_id''\)\)\) FOR school_id/);
    assert.match(text, /THROW 51021/, 'stops instead of guessing when several schools exist');
    assert.match(text, /CREATE UNIQUE INDEX UX_parents_school_phone ON dbo\.parents \(school_id, phone\)/);
    assert.match(text, /DROP CONSTRAINT UQ_parents_phone/);
    assert.equal(/DEFAULT \(?\(?1\)?\)? FOR school_id/.test(text), false, 'no fixed school default');
    assert.equal(/\bDROP TABLE\b|\bDELETE FROM\b|\bTRUNCATE\b/i.test(text), false, 'additive: no data removed');
});

test('the sign-in page asks for the school code and remembers it on the device', () => {
    const view = fs.readFileSync(path.join(__dirname, '../views/login.ejs'), 'utf8');
    const js = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
    assert.match(view, /<input id="schoolCode"/);
    assert.match(js, /schoolCode: schoolInput \? schoolInput\.value\.trim\(\) : ''/);
    assert.match(js, /localStorage\.setItem\('schoolCode'/);
});

test('migration 024 switches on row-level security: filter and block predicates on every required-school table', () => {
    const text = fs.readFileSync(path.join(__dirname, '../migrations/024_row_level_security.sql'), 'utf8');
    assert.match(text, /CREATE FUNCTION security\.fn_school_rows \(@school_id INT\)/);
    assert.match(text, /WITH SCHEMABINDING/);
    assert.match(text, /@school_id = CONVERT\(INT, SESSION_CONTEXT\(N''school_id''\)\)/, 'rows of the request\'s school');
    assert.match(text, /ADD FILTER PREDICATE security\.fn_school_rows\(school_id\)/);
    assert.match(text, /AFTER INSERT/);
    assert.match(text, /AFTER UPDATE/);
    assert.match(text, /CK_' \+ t\.name \+ N'_school_required/, 'the tables migration 021 made require a school');
    assert.match(text, /WITH \(STATE = ON, SCHEMABINDING = ON\)/);
});
