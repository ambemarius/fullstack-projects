const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseConfiguration } = require('../config/environment');
const { createDatabase, withDatabase, pool, poolConnect } = require('../config/database');

const approved = {
    NODE_ENV: 'test', LMS_TEST_DB_ACK: 'synthetic-only',
    LMS_TEST_DB_SERVER: 'synthetic.invalid', LMS_TEST_DB_ALLOWED_SERVER: 'synthetic.invalid',
    LMS_TEST_DB_NAME: 'lms_test_synthetic', LMS_TEST_DB_ALLOWED_NAME: 'lms_test_synthetic',
    LMS_TEST_DB_USER: 'synthetic-test-user', LMS_TEST_DB_PASSWORD: 'fixture-not-a-real-credential',
};

test('test configuration cannot fall back to DB_STRING or an unapproved target', () => {
    for (const changes of [
        { LMS_TEST_DB_ACK: '' }, { LMS_TEST_DB_ALLOWED_SERVER: '' },
        { LMS_TEST_DB_SERVER: 'other.invalid' }, { LMS_TEST_DB_NAME: 'schooldb' },
        { LMS_TEST_DB_ALLOWED_NAME: '' }, { LMS_TEST_DB_USER: '' }, { LMS_TEST_DB_PASSWORD: '' },
    ]) assert.throws(() => databaseConfiguration({ ...approved, ...changes, DB_STRING: 'never-used' }));
    assert.throws(() => databaseConfiguration({ NODE_ENV: 'test', DB_STRING: 'never-used' }));
    assert.throws(() => databaseConfiguration({ NODE_ENV: 'development' }));
    assert.equal(databaseConfiguration(approved).database, 'lms_test_synthetic');
});

test('test-runner context blocks production fallback without NODE_ENV=test', () => {
    assert.throws(() => databaseConfiguration({ NODE_TEST_CONTEXT: 'child-v8', DB_STRING: 'never-used' }));
});

test('invalid configuration is rejected before pool construction', async () => {
    let constructions = 0;
    const db = createDatabase({
        driver: { ConnectionPool: class { constructor() { constructions++; } } },
        configuration: () => databaseConfiguration({ NODE_ENV: 'test' }),
    });
    await assert.rejects(db.connect());
    assert.equal(constructions, 0);
});

test('pool connects lazily once, retries after failure and closes explicitly', async () => {
    let constructed = 0, connects = 0, closes = 0;
    const db = createDatabase({
        configuration: () => ({ server: 'fake' }),
        driver: { ConnectionPool: class {
            constructor() { constructed++; }
            on() {}
            async connect() { connects++; if (connects === 1) throw new Error('synthetic failure'); return this; }
            async close() { closes++; }
        } },
    });
    assert.equal(constructed, 0);
    await assert.rejects(db.connect(), /synthetic failure/);
    await Promise.all([db.connect(), db.connect()]);
    assert.equal(constructed, 1);
    assert.equal(connects, 2);
    await db.close();
    assert.equal(closes, 1);
});

test('model-compatible overrides stay isolated across async operations', async () => {
    function fake(name) {
        return { connect: async () => name, getPool: () => ({ request: () => name }) };
    }
    const values = await Promise.all(['A', 'B'].map(name => withDatabase(fake(name), async () => {
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(await poolConnect, name);
        return pool.request();
    })));
    assert.deepEqual(values, ['A', 'B']);
});
