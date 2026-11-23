const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const verifyToken = require('../utils/verifyToken');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const fixtureApp = db => createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
const json = (method, body, token) => ({
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
});
const parentRow = { id: 7, firstName: 'Synthetic', lastName: 'Guardian', phone: '+237650000001', status: 'active', password: 'synthetic-hash' };

test('registration validates before any SQL and normalises the phone', async t => {
    const db = syntheticDatabase((statement, params) => {
        if (statement.includes('FROM parents WHERE phone')) return { recordset: [] };
        assert.match(statement, /INSERT INTO parents/);
        assert.equal(params.phone, '+237650000001');
        return { recordset: [{ id: 7, firstName: 'Synthetic', lastName: 'Guardian', phone: params.phone, status: 'active' }] };
    });
    const base = await serve(t, fixtureApp(db));
    for (const body of [
        { firstName: 'A', lastName: 'B', phone: '650000001', password: 'short' },
        { firstName: 'A', lastName: 'B', phone: '12345', password: 'long-enough-password' },
    ]) {
        assert.equal((await fetch(`${base}/api/v1/parents/register`, json('POST', body))).status, 400);
    }
    assert.equal(db.calls.length, 0);
    const created = await fetch(`${base}/api/v1/parents/register`, json('POST', { firstName: 'A', lastName: 'B', phone: '6 50 00 00 01', password: 'long-enough-password' }));
    assert.equal(created.status, 201);
    assert.equal(Object.hasOwn((await created.json()).data, 'password'), false);
});

test('parent login issues a parent-bound token and refuses inactive accounts', async t => {
    const hash = await bcrypt.hash('synthetic-login-password', 4);
    let status = 'active';
    const db = syntheticDatabase(() => ({ recordset: [{ ...parentRow, status, password: hash }] }));
    const base = await serve(t, fixtureApp(db));
    const ok = await fetch(`${base}/api/v1/parents/login`, json('POST', { phone: '+237650000001', password: 'synthetic-login-password' }));
    assert.equal(ok.status, 200);
    const payload = await ok.json();
    assert.equal(verifyToken(payload.token, 'parent').id, 7);
    assert.equal(Object.hasOwn(payload.data, 'password'), false);
    status = 'suspended';
    assert.equal((await fetch(`${base}/api/v1/parents/login`, json('POST', { phone: '+237650000001', password: 'synthetic-login-password' }))).status, 403);
});

test('self-link succeeds only when the pupil record carries the guardian phone', async t => {
    let registeredPhone = '+237650000002';
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM parents WHERE id')) return { recordset: [parentRow] };
        if (statement.includes('FROM students WHERE matricule')) return { recordset: [{ id: 42, isWithdrawn: false, parentPhone: registeredPhone, parentPhone2: null }] };
        if (statement.includes('INSERT INTO parent_students')) return { recordset: [] };
        throw new Error('unexpected statement: ' + statement);
    });
    const base = await serve(t, fixtureApp(db));
    const token = generateToken(7, 'parent');
    const denied = await fetch(`${base}/api/v1/parents/children/link`, json('POST', { matricule: 'SYN-42' }, token));
    assert.equal(denied.status, 403);
    assert.match((await denied.json()).message, /guardian phone does not match/);
    assert.equal(db.calls.some(c => c.statement.includes('INSERT INTO parent_students')), false);

    registeredPhone = '650000001';
    const linked = await fetch(`${base}/api/v1/parents/children/link`, json('POST', { matricule: 'SYN-42', relationship: 'mother' }, token));
    assert.equal(linked.status, 200);
    const insert = db.calls.find(c => c.statement.includes('INSERT INTO parent_students'));
    assert.deepEqual([insert.parameters.parentId, insert.parameters.studentId, insert.parameters.relationship, insert.parameters.linkedByAdminId], [7, 42, 'mother', null]);
});

test('administrator can link any pupil to a guardian; other roles cannot', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM Admins')) return { recordset: [{ id: 1, role: 'admin', password: 'synthetic-hash' }] };
        if (statement.includes('FROM parents WHERE id')) return { recordset: [parentRow] };
        if (statement.includes('FROM students s')) return { recordset: [{ id: 42 }] };
        if (statement.includes('INSERT INTO parent_students')) return { recordset: [] };
        throw new Error('unexpected statement: ' + statement);
    });
    const base = await serve(t, fixtureApp(db));
    for (const token of [generateToken(7, 'parent'), generateToken(1, 'teacher')]) {
        assert.equal((await fetch(`${base}/api/v1/parents/admin/link`, json('POST', { parentId: 7, studentId: 42 }, token))).status, 401);
    }
    const response = await fetch(`${base}/api/v1/parents/admin/link`, json('POST', { parentId: 7, studentId: 42 }, generateToken(1, 'admin')));
    assert.equal(response.status, 200);
    const insert = db.calls.find(c => c.statement.includes('INSERT INTO parent_students'));
    assert.equal(insert.parameters.linkedByAdminId, 1);
});

test('child report is refused for an unlinked pupil', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM parents WHERE id')) return { recordset: [parentRow] };
        if (statement.includes('FROM parent_students WHERE parent_id')) return { recordset: [] };
        throw new Error('unexpected statement: ' + statement);
    });
    const base = await serve(t, fixtureApp(db));
    const response = await fetch(`${base}/api/v1/parents/children/42/report`, { headers: { Authorization: `Bearer ${generateToken(7, 'parent')}` } });
    assert.equal(response.status, 403);
    assert.equal(db.calls.some(c => c.statement.includes('FROM subject_scores')), false);
});
