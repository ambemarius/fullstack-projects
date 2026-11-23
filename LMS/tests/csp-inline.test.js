const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../app/app');
const { serve } = require('./helpers/http');

// Pages served by the main app; the staged preview/practice screens run on other servers with their own policy.
const STAGED = /^(practice-|m1-|canonical-|school-practice|attendance\.ejs$|finance-(bulk|charge|collections|receipt|statement)\.ejs$|inventory-error)|^partials[\\/](finance-|canonical-)|^js[\\/](m1-|canonical-|attendance\.js$)/;

function files(dir, ext, base = dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return files(full, ext, base);
        return e.name.endsWith(ext) ? [path.relative(base, full)] : [];
    });
}

test('served pages and scripts contain no inline scripts or event-handler attributes (CSP forbids them)', () => {
    const offenders = [];
    for (const rel of files(path.join(__dirname, '../views'), '.ejs')) {
        if (STAGED.test(rel)) continue;
        const text = fs.readFileSync(path.join(__dirname, '../views', rel), 'utf8');
        if (/\son(click|submit|change|input|load|keyup|keydown)=/i.test(text)) offenders.push('views/' + rel + ' (event attribute)');
        if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(text)) offenders.push('views/' + rel + ' (inline <script>)');
    }
    for (const rel of files(path.join(__dirname, '../public/js'), '.js', path.join(__dirname, '../public'))) {
        if (STAGED.test(rel)) continue;
        const text = fs.readFileSync(path.join(__dirname, '../public', rel), 'utf8');
        if (/\son(click|submit|change)="/i.test(text)) offenders.push('public/' + rel + ' (builds an event attribute)');
    }
    assert.deepEqual(offenders, []);
});

test('the content security policy blocks inline scripts', async t => {
    const base = await serve(t, createApp({ logging: false }));
    const csp = (await fetch(base + '/login')).headers.get('content-security-policy');
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /script-src-attr 'none'/);
    assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
});
