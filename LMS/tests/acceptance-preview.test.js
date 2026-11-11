const test = require('node:test'), assert = require('node:assert/strict'), express = require('express');
const { serve } = require('./helpers/http');
const { isolatePreviewCookies, ACCEPTANCE_COOKIE } = require('../scripts/m1AcceptancePreview');
const { COOKIE, readSessionToken } = require('../middlewares/canonicalSession');
test('synthetic acceptance cookie isolation never consumes or overwrites the real-school cookie', async t => {
    const inner = express();
    inner.get('/', (req, res) => { res.cookie(COOKIE, 'synthetic-fixture', { secure: true, httpOnly: true, sameSite: 'strict', path: '/' }); res.json({ token: readSessionToken(req) }); });
    const base = await serve(t, isolatePreviewCookies(inner));
    const ignored = await fetch(base, { headers: { Cookie: COOKIE + '=real-fixture' } });
    assert.equal((await ignored.json()).token, null);
    const cookie = ignored.headers.get('set-cookie');
    assert.ok(cookie.startsWith(ACCEPTANCE_COOKIE + '='));
    for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(flag));
    const accepted = await fetch(base, { headers: { Cookie: COOKIE + '=real-fixture; ' + ACCEPTANCE_COOKIE + '=synthetic-fixture' } });
    assert.equal((await accepted.json()).token, 'synthetic-fixture');
    const duplicate = await fetch(base, { headers: { Cookie: ACCEPTANCE_COOKIE + '=one; ' + ACCEPTANCE_COOKIE + '=two' } });
    assert.equal((await duplicate.json()).token, null);
});
