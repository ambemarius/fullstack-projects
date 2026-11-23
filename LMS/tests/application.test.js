const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, ROUTES } = require('../app/app');
const { startServer } = require('../server');
const { serve } = require('./helpers/http');

test('application creation/imports require no database credentials or connection', async t => {
    const app = createApp({ logging: false });
    assert.equal(ROUTES.length, 23);
    const base = await serve(t, app);
    const landing = await fetch(base);
    assert.equal(landing.status, 200);
    assert.match(await landing.text(), /<!doctype html>/i);
    assert.equal((await fetch(`${base}/api/v1/students`)).status, 401);
});

test('app factory permits isolated route injection', async t => {
    const app = createApp({ logging: false, routes: [['/synthetic', (_req, res) => res.json({ source: 'fixture' })]] });
    const base = await serve(t, app);
    assert.deepEqual(await (await fetch(`${base}/synthetic`)).json(), { source: 'fixture' });
    assert.equal((await fetch(`${base}/unknown`)).status, 404);
});

test('startup connects before listening and closes without schema writes', async () => {
    const calls = [];
    const runtime = await startServer({
        port: 0, host: '127.0.0.1',
        database: { async connect() { calls.push('connect'); }, async close() { calls.push('close'); } },
        createApplication: () => { calls.push('app'); return (_req, res) => res.end('synthetic'); },
    });
    assert.deepEqual(calls, ['connect', 'app']);
    await runtime.close();
    assert.deepEqual(calls, ['connect', 'app', 'close']);
});

test('startup failure never creates application and cleans up', async () => {
    let closes = 0;
    await assert.rejects(startServer({
        database: { async connect() { throw new Error('synthetic unavailable'); }, async close() { closes++; } },
        createApplication: () => { throw new Error('must not be called'); },
    }), /synthetic unavailable/);
    assert.equal(closes, 1);
});

test('a port conflict leaves the existing listener running', async t => {
    const base = await serve(t, (_req, res) => res.end('existing-listener'));
    let closes = 0;
    await assert.rejects(startServer({
        port: Number(new URL(base).port), host: '127.0.0.1',
        database: { async connect() {}, async close() { closes++; } },
        createApplication: () => (_req, res) => res.end('replacement'),
    }), { code: 'EADDRINUSE' });
    assert.equal(closes, 1);
    assert.equal(await (await fetch(base)).text(), 'existing-listener');
});

test('startup rejects missing signing configuration before connecting', async () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    let connects = 0;
    try {
        await assert.rejects(startServer({
            database: { async connect() { connects++; }, async close() {} },
        }), /JWT_SECRET/);
        assert.equal(connects, 0);
    } finally {
        process.env.JWT_SECRET = original;
    }
});
