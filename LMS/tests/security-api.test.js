const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const verifyToken = require('../utils/verifyToken');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

function fixtureApp(db) {
    return createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
}

test('anonymous and student admin provisioning are rejected without touching SQL', async t => {
    const db = syntheticDatabase(() => { throw new Error('must not query'); });
    const base = await serve(t, fixtureApp(db));
    for (const token of [null, generateToken(1, 'student'), generateToken(1, 'teacher')]) {
        const response = await fetch(`${base}/api/v1/admin/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ name: 'Synthetic administrator', email: 'test@example.invalid', password: 'synthetic-only', role: 'admin' }),
        });
        assert.equal(response.status, 401);
    }
    assert.equal(db.calls.length, 0);
});

test('admin student listing projects safe columns', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM Admins')) return { recordset: [{ id: 1, role: 'admin', password: 'synthetic-hash' }] };
        assert.match(statement, /FROM students s/);
        assert.doesNotMatch(statement, /SELECT\s+s\.\*/i);
        assert.doesNotMatch(statement, /\bpassword\b/i);
        return { recordset: [{ id: 42, matricule: 'SYNTHETIC-42', firstName: 'Synthetic', lastName: 'Student' }] };
    });
    const base = await serve(t, fixtureApp(db));
    const response = await fetch(`${base}/api/v1/students`, { headers: { Authorization: `Bearer ${generateToken(1, 'admin')}` } });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.results, 1);
    assert.equal(Object.hasOwn(payload.data[0], 'password'), false);
});

test('authenticated administrator can provision an admin but not platform privileges', async t => {
    const db = syntheticDatabase((statement, params) => {
        if (statement.includes('INSERT INTO Admins')) {
            assert.equal(params.role, 'admin');
            return { recordset: [{ id: 17, name: 'Synthetic administrator', email: 'new@example.invalid', role: 'admin' }] };
        }
        return { recordset: params.email ? [] : [{ id: 1, role: 'admin' }] };
    });
    const base = await serve(t, fixtureApp(db));
    const body = { name: 'Synthetic administrator', email: 'new@example.invalid', password: 'synthetic-only-password' };
    for (const [role, status] of [['admin', 201], ['platform-admin', 400]]) {
        const response = await fetch(`${base}/api/v1/admin/register`, {
            method: 'POST', headers: { Authorization: `Bearer ${generateToken(1, 'admin')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, role }),
        });
        assert.equal(response.status, status);
        assert.doesNotMatch(await response.text(), /password|synthetic-only-password/);
    }
});

test('all three login endpoints issue role-bound tokens without returning hashes', async t => {
    const hash = await bcrypt.hash('synthetic-login-password', 4);
    const db = syntheticDatabase(statement => {
        const role = statement.includes('FROM Admins') ? 'admin' : statement.includes('FROM teachers') ? 'teacher' : 'student';
        return { recordset: [{ id: 1, role, status: 'active', isWithdrawn: false, password: hash }] };
    });
    const base = await serve(t, fixtureApp(db));
    for (const [group, role, identity] of [
        ['admin', 'admin', { email: 'admin@example.invalid', schoolCode: 'SCHOOL_A' }],
        ['teachers', 'teacher', { email: 'teacher@example.invalid' }],
        ['students', 'student', { matricule: 'SYNTHETIC-1' }],
    ]) {
        const response = await fetch(`${base}/api/v1/${group}/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...identity, password: 'synthetic-login-password' }),
        });
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(Object.hasOwn(payload.data, 'password'), false);
        assert.equal(verifyToken(payload.token, role).id, 1);
    }
});

test('withdrawn student cannot log in', async t => {
    const hash = await bcrypt.hash('synthetic-login-password', 4);
    const db = syntheticDatabase(() => ({ recordset: [{ id: 1, isWithdrawn: true, password: hash }] }));
    const base = await serve(t, fixtureApp(db));
    const response = await fetch(`${base}/api/v1/students/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: 'SYNTHETIC-1', password: 'synthetic-login-password' }),
    });
    assert.equal(response.status, 403);
    assert.equal(Object.hasOwn(await response.json(), 'token'), false);
});
test('a non-administrator legacy Admins row cannot receive an administrator token',async t=>{
    const hash=await bcrypt.hash('synthetic-login-password',4);
    const db=syntheticDatabase(statement=>statement.includes('UPPER(code) = @code')?{recordset:[{id:1,code:'SCHOOL_A',status:'active'}]}:{recordset:[{id:1,role:'teacher',school_id:1,password:hash}]});
    const base=await serve(t,fixtureApp(db));
    const response=await fetch(base+'/api/v1/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'synthetic@example.invalid',password:'synthetic-login-password',schoolCode:'SCHOOL_A'})});
    assert.equal(response.status,401);assert.equal(Object.hasOwn(await response.json(),'token'),false);
});

test('unexpected failures and malformed JSON do not disclose internals', async t => {
    const db = syntheticDatabase(() => { throw new Error('synthetic-private-driver-details'); });
    const base = await serve(t, fixtureApp(db));
    const response = await fetch(`${base}/api/v1/students`, { headers: { Authorization: `Bearer ${generateToken(1, 'admin')}` } });
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload.message, 'An unexpected error occurred');
    assert.equal(Object.hasOwn(payload, 'stack'), false);
    assert.ok(payload.requestId);
    const malformed = await fetch(`${base}/api/v1/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":"synthetic-private-value"',
    });
    assert.equal(malformed.status, 400);
    assert.doesNotMatch(await malformed.text(), /synthetic-private-value|stack/);
});
