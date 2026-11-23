const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app/app');
const { createStagedFeaturesGate } = require('../middlewares/stagedFeaturesGate');
const { serve } = require('./helpers/http');

const PARENT_PATHS = [
    ['POST', '/api/v1/parents/register'], ['POST', '/api/v1/parents/login'],
    ['POST', '/api/v1/parents/children/link'], ['GET', '/api/v1/parents/children/1/report'],
];

test('analytics stays hidden while its flag is off and parent routes reach handlers when their flag is on', async t => {
    const base = await serve(t, createApp({ logging: false, routes: [['/', (_req, res) => res.status(599).end()]] }));
    for (const [method, path] of [['GET', '/api/v1/admin/analytics'], ['HEAD', '/API/v1/admin/analytics/']]) {
        const response = await fetch(base + path, { method, headers: { Accept: 'text/html' } });
        assert.equal(response.status, 404, method + ' ' + path);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    for (const [method, path] of [...PARENT_PATHS, ['GET', '/parent-dashboard']]) {
        assert.equal((await fetch(base + path, { method })).status, 599, method + ' ' + path);
    }
    assert.equal((await fetch(base + '/api/v1/admin/stats')).status, 599, 'Existing routes remain available');
});

test('parent routes return 404 without touching handlers when parents.enabled is off', async () => {
    const gate = createStagedFeaturesGate(() => false);
    for (const [method, path] of [...PARENT_PATHS, ['GET', '/api/v1/admin/analytics']]) {
        let status, headers = {}, reachedNext = false;
        const res = { status(code) { status = code; return this; }, set(k, v) { headers[k] = v; return this; }, json() { return this; } };
        gate({ method, path }, res, () => { reachedNext = true; });
        assert.equal(status, 404, method + ' ' + path);
        assert.equal(headers['Cache-Control'], 'no-store');
        assert.equal(reachedNext, false);
    }
    let pageStatus, sent;
    const page = { status(code) { pageStatus = code; return this; }, set() { return this; }, send(body) { sent = body; return this; } };
    gate({ method: 'GET', path: '/parent-dashboard', get: () => '', accepts: () => 'json' }, page, () => assert.fail('must not continue'));
    assert.equal(pageStatus, 404);
    assert.match(sent, /not available/);
});
