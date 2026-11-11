const test = require('node:test');
const assert = require('node:assert/strict');
const { createLegacyAllocationReads } = require('../model/identity/legacyAllocationReads');

test('staged allocation reads reject malformed references and denied authority before SQL', async () => {
    const service = createLegacyAllocationReads({ authorize: async () => {
        throw Object.assign(Error('Denied'), { statusCode: 401 });
    } }, { connect() { throw Error('Unexpected SQL'); } });
    for (const options of [{ yearId: '1' }, { yearId: 0 }, { classId: -1 }, { classId: 2147483648 }]) {
        await assert.rejects(service.list({}, options), error => error.statusCode === 422);
    }
    await assert.rejects(service.list({}), error => error.statusCode === 401);
});

test('staged allocation reads reauthorize each statement and bind authority separately from targets', async () => {
    const statements = [];
    let checks = 0;
    const actor = { schoolId: 7, accountId: 8, membershipId: 9, legacyId: 10,
        securityVersion: 2, expiresAt: new Date() };
    const database = { async connect() {}, getPool: () => ({ request() {
        const parameters = {};
        return { input(name, _type, value) { parameters[name] = value; return this; },
            async query(sql) {
                statements.push({ sql, parameters });
                return { recordset: statements.length === 1 ? [{ id: 11 }] : statements.length === 2 ? [{ id: 12 }] : [] };
            } };
    } }) };
    const service = createLegacyAllocationReads({ async authorize(_context, roles) {
        assert.deepEqual(roles, ['admin']); checks++; return actor;
    } }, database);
    assert.deepEqual(await service.list({}, { yearId: 11, classId: 12 }), []);
    assert.equal(checks, 3);
    for (const statement of statements) {
        assert.equal(statement.parameters.school, 7);
        assert.equal(statement.parameters.account, 8);
        assert.match(statement.sql, /@credential_version/);
        assert.match(statement.sql, /@jwt_expires/);
    }
    assert.match(statements[2].sql, /s.school_id=sa.school_id/);
    assert.match(statements[2].sql, /c.school_id=sa.school_id/);
    assert.match(statements[2].sql, /ay.school_id=sa.school_id/);
});
