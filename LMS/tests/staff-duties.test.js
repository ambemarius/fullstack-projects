const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const express = require('express');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const verifyToken = require('../utils/verifyToken');
const { requireStaff } = require('../middlewares/staffAccess');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const fixtureApp = db => createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
const json = (method, body, token) => ({
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
});
const auxRow = { id: 5, name: 'Synthetic Bursar', email: 'bursar@example.invalid', role: 'Bursar', status: 'active', school_id: 1, canSignIn: true };

test('auxiliary staff sign in only when active and holding a password; the hash never leaves', async t => {
    const hash = await bcrypt.hash('synthetic-staff-password', 4);
    let row = { ...auxRow, password: hash };
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM auxiliary_staff WHERE email')) return { recordset: [row] };
        if (statement.includes('FROM staff_duties')) return { recordset: [{ duty: 'bursar' }] };
        throw new Error('unexpected statement: ' + statement);
    });
    const base = await serve(t, fixtureApp(db));
    const body = { email: 'bursar@example.invalid', password: 'synthetic-staff-password' };

    const ok = await fetch(`${base}/api/v1/auxiliary/login`, json('POST', body));
    assert.equal(ok.status, 200);
    const payload = await ok.json();
    assert.equal(verifyToken(payload.token, 'auxiliary').id, 5);
    assert.equal(verifyToken(payload.token, 'auxiliary').sid, 1, "the token carries the account's school, found without a school code");
    assert.equal(Object.hasOwn(payload.data, 'password'), false);
    assert.deepEqual(payload.data.duties, ['bursar']);

    assert.equal((await fetch(`${base}/api/v1/auxiliary/login`, json('POST', { ...body, password: 'wrong-password-123' }))).status, 401);
    row = { ...auxRow, password: null };
    assert.equal((await fetch(`${base}/api/v1/auxiliary/login`, json('POST', body))).status, 401);
    row = { ...auxRow, password: hash, status: 'pending' };
    assert.equal((await fetch(`${base}/api/v1/auxiliary/login`, json('POST', body))).status, 403);
});

test('auxiliary staff list never selects the password column', () => {
    const source = fs.readFileSync(path.join(__dirname, '../model/staff/auxiliary.js'), 'utf8');
    assert.equal(/SELECT \*/.test(source), false);
    assert.equal(/OUTPUT INSERTED\.\*/.test(source), false);
    assert.equal((source.match(/, password FROM auxiliary_staff/g) || []).length, 1, 'only the sign-in query reads the hash');
});

test('only administrators set auxiliary passwords, and short passwords are refused before SQL', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM Admins')) return { recordset: [{ id: 1, role: 'admin', name: 'Admin' }] };
        if (statement.includes('FROM auxiliary_staff WHERE id')) return { recordset: [auxRow] };
        if (statement.includes('UPDATE auxiliary_staff SET password')) return { recordset: [auxRow] };
        throw new Error('unexpected statement: ' + statement);
    });
    const base = await serve(t, fixtureApp(db));
    const admin = generateToken(1, 'admin');
    assert.equal((await fetch(`${base}/api/v1/auxiliary/5/password`, json('PUT', { password: 'long-enough-password' }, generateToken(5, 'teacher')))).status, 401);
    const before = db.calls.length;
    assert.equal((await fetch(`${base}/api/v1/auxiliary/5/password`, json('PUT', { password: 'short' }, admin))).status, 422);
    assert.equal(db.calls.slice(before).some(c => c.statement.includes('auxiliary_staff')), false);
    const set = await fetch(`${base}/api/v1/auxiliary/5/password`, json('PUT', { password: 'long-enough-password' }, admin));
    assert.equal(set.status, 200);
    const update = db.calls.find(c => c.statement.includes('UPDATE auxiliary_staff SET password'));
    assert.notEqual(update.parameters.password, 'long-enough-password');
    assert.match(update.parameters.password, /^\$2[aby]\$12\$/);
});

test('granting a duty validates input and records the granting administrator', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM Admins')) return { recordset: [{ id: 1, role: 'admin', name: 'Admin' }] };
        if (statement.includes('SELECT id FROM teachers')) return { recordset: [{ id: 9 }] };
        if (statement.includes('INSERT INTO staff_duties')) return { recordset: [{ id: 3 }] };
        throw new Error('unexpected statement: ' + statement);
    });
    const base = await serve(t, fixtureApp(db));
    const admin = generateToken(1, 'admin');
    for (const body of [{ staffType: 'admin', staffId: 1, duty: 'bursar' }, { staffType: 'teacher', staffId: 9, duty: 'headmaster' }, { staffType: 'teacher', staffId: 'x', duty: 'bursar' }]) {
        assert.equal((await fetch(`${base}/api/v1/staff-duties`, json('POST', body, admin))).status, 422);
    }
    const granted = await fetch(`${base}/api/v1/staff-duties`, json('POST', { staffType: 'teacher', staffId: 9, duty: 'discipline_master' }, admin));
    assert.equal(granted.status, 201);
    const insert = db.calls.find(c => c.statement.includes('INSERT INTO staff_duties'));
    assert.deepEqual([insert.parameters.type, insert.parameters.id, insert.parameters.duty, insert.parameters.admin], ['teacher', 9, 'discipline_master', 1]);
});

test('requireStaff admits by duty, refuses pupils, parents and inactive staff, and exposes one actor', async t => {
    const accounts = {
        Admins: { id: 1, role: 'admin', name: 'Admin', school_id: 1 },
        teachers: { id: 2, status: 'active', name: 'Teacher', school_id: 1 },
        auxiliary_staff: { ...auxRow },
    };
    let duties = { teacher: [], auxiliary: ['bursar'] };
    const db = syntheticDatabase((statement, params) => {
        for (const table of Object.keys(accounts)) if (statement.includes(`FROM ${table} WHERE id`)) return { recordset: [accounts[table]] };
        if (statement.includes('FROM staff_duties')) return { recordset: (duties[params.type] || []).map(duty => ({ duty })) };
        throw new Error('unexpected statement: ' + statement);
    });
    const app = express();
    app.use((_req, _res, next) => withDatabase(db, next));
    app.get('/finance', requireStaff({ duties: ['bursar'] }), (req, res) => res.json(req.actor));
    app.get('/lab', requireStaff({ duties: ['lab_attendant'], allowTeacher: true }), (req, res) => res.json(req.actor));
    app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ message: err.message }));
    const base = await serve(t, app);
    const get = (url, token) => fetch(base + url, { headers: { Authorization: `Bearer ${token}` } });

    const bursar = await get('/finance', generateToken(5, 'auxiliary'));
    assert.equal(bursar.status, 200);
    assert.deepEqual(await bursar.json(), { schoolId: 1, type: 'auxiliary', id: 5, name: 'Synthetic Bursar', duties: ['bursar'], disciplineClasses: null });
    assert.equal((await get('/finance', generateToken(1, 'admin'))).status, 200);
    assert.equal((await get('/finance', generateToken(2, 'teacher'))).status, 403);
    assert.equal((await get('/lab', generateToken(2, 'teacher'))).status, 200);
    duties = { teacher: ['bursar'], auxiliary: [] };
    assert.equal((await get('/finance', generateToken(2, 'teacher'))).status, 200);
    assert.equal((await get('/finance', generateToken(5, 'auxiliary'))).status, 403);
    for (const type of ['student', 'parent']) assert.equal((await get('/finance', generateToken(3, type))).status, 403);
    duties = { teacher: [], auxiliary: ['bursar'] };
    accounts.auxiliary_staff = { ...auxRow, status: 'suspended' };
    assert.equal((await get('/finance', generateToken(5, 'auxiliary'))).status, 403);
    accounts.auxiliary_staff = { ...auxRow, canSignIn: false };
    assert.equal((await get('/finance', generateToken(5, 'auxiliary'))).status, 403);
    assert.equal((await fetch(base + '/finance')).status, 401);
});

test('migration 011 adds duties and defaults school ownership only for a single active school', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/011_staff_duties_single_school.sql'), 'utf8');
    assert.match(sql, /CREATE TABLE dbo\.staff_duties/);
    assert.match(sql, /UX_staff_duties_active[\s\S]*WHERE revoked_at IS NULL/);
    assert.match(sql, /status = ''active''\) <> 1 RETURN/);
    assert.ok(sql.indexOf("''students''") < sql.indexOf("''subject_scores''"), 'parents are backfilled before children');
    assert.equal(/\bDROP\b|\bDELETE\b/i.test(sql), false);
});
