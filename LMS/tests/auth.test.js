const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { authConfiguration } = require('../config/auth');
const generateToken = require('../utils/generateToken');
const verifyToken = require('../utils/verifyToken');
const { createRoleAuth } = require('../middlewares/roleAuth');

test('signing configuration has no built-in fallback', () => {
    assert.throws(() => authConfiguration({}));
    assert.throws(() => authConfiguration({ JWT_SECRET: 'short' }));
    assert.throws(() => generateToken(1));
    assert.throws(() => generateToken(-1, 'admin'));
});

test('all account type pairs stay distinct even with the same legacy ID', () => {
    for (const issuedType of ['admin', 'teacher', 'student']) {
        const token = generateToken(1, issuedType);
        for (const expectedType of ['admin', 'teacher', 'student']) {
            const result = verifyToken(token, expectedType);
            assert.equal(Boolean(result), issuedType === expectedType);
            if (result) assert.equal(result.id, 1);
        }
    }
});

test('legacy, forged, expired and malformed claims are rejected', () => {
    const secret = process.env.JWT_SECRET;
    const claims = { id: 1, accountType: 'admin', tokenVersion: 2 };
    const options = { issuer: 'lms', audience: 'lms-web', subject: '1', expiresIn: '1h' };
    for (const token of [
        jwt.sign({ id: 1 }, secret),
        jwt.sign(claims, 'synthetic-wrong-key', options),
        jwt.sign(claims, secret, { ...options, expiresIn: -1 }),
        jwt.sign(claims, secret, { ...options, issuer: 'other' }),
        jwt.sign(claims, secret, { ...options, audience: 'other' }),
        jwt.sign(claims, secret, { ...options, algorithm: 'HS384' }),
        jwt.sign(claims, secret, { issuer: 'lms', audience: 'lms-web', subject: '1' }),
        jwt.sign({ ...claims, id: '1' }, secret, options),
        jwt.sign(claims, secret, { ...options, subject: '2' }),
        jwt.sign({ ...claims, accountType: 'platform-admin' }, secret, options),
        'invalid',
    ]) assert.equal(verifyToken(token, 'admin'), false);
});

test('wrong-role middleware denies before any account lookup', async () => {
    let lookups = 0;
    const auth = createRoleAuth({ accountType: 'admin', findById: async () => { lookups++; } });
    let error;
    await auth({ headers: { authorization: `Bearer ${generateToken(1, 'student')}` } }, {}, err => { error = err; });
    assert.equal(error.statusCode, 401);
    assert.equal(lookups, 0);
});

test('role middleware reloads status and never attaches credential hashes', async () => {
    for (const [accountType, account, expected] of [
        ['teacher', { id: 1, status: 'suspended' }, 403],
        ['teacher', { id: 1, status: 'withdrawn' }, 403],
        ['student', { id: 1, isWithdrawn: true }, 403],
        ['admin', null, 401],
        ['admin', {id:1,role:'teacher'},403],
        ['admin', {id:1,role:'Admin'},undefined],
        ['teacher', { id: 1, status: 'active', password: 'synthetic-hash' }, undefined],
        ['student', { id: 1, isWithdrawn: false, password: 'synthetic-hash' }, undefined],
    ]) {
        const auth = createRoleAuth({ accountType, findById: async () => account });
        const req = { headers: { authorization: `Bearer ${generateToken(1, accountType)}` } };
        let error;
        await auth(req, {}, err => { error = err; });
        assert.equal(error?.statusCode, expected);
        if (!expected) assert.equal(Object.hasOwn(req.userAuth, 'password'), false);
    }
});
