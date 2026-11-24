// Public KodoSchool site: home, modules and pricing pages, built to work under the app's CSP.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const pages = { landing: 'site-home', modules: 'site-modules', pricing: 'site-pricing' };
const render = name => ejs.renderFile(path.join(__dirname, `../views/${name}.ejs`), {});

test('site pages: no inline scripts or handlers, fonts and scripts served by the app', async () => {
    for (const [view, js] of Object.entries(pages)) {
        const html = await render(view);
        assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, `${view}: no inline scripts (the CSP forbids them)`);
        assert.equal(/\son[a-z]+="/i.test(html), false, `${view}: no inline event handlers`);
        assert.equal(html.includes('fonts.googleapis.com'), false, `${view}: fonts are self-hosted`);
        assert.ok(html.includes(`<script src="/js/${js}.js"></script>`), `${view}: loads its script`);
        assert.ok(fs.existsSync(path.join(__dirname, `../public/js/${js}.js`)), `${js}.js exists`);
        assert.equal(/href="(index|modules|pricing)\.html/.test(html), false, `${view}: links use the app routes`);
        assert.equal(html.includes('login?role='), false, `${view}: sign-in links use ?as=`);
    }
    for (const view of Object.keys(pages)) {
        const html = await render(view);
        assert.ok(html.includes('href="/css/site.css'), `${view}: shared stylesheet`);
        assert.ok(html.includes('class="skip-link" href="#main"') && html.includes('<main id="main"'), `${view}: skip link to the main content`);
        assert.ok(html.includes('aria-controls="navLinks" aria-expanded="false"'), `${view}: phone menu button is labelled`);
        assert.equal(/class="[^"]*\breveal\b/.test(html), false, `${view}: no content hidden until scrolled`);
    }
    assert.match(await render('pricing'), /<a href="\/pricing" aria-current="page">Pricing<\/a>/);
    const css = fs.readFileSync(path.join(__dirname, '../public/css/site-fonts.css'), 'utf8');
    for (const m of css.matchAll(/url\(([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(__dirname, '../public', m[1])), m[1]);
});

test('home page: sections, sign-in links per account type and the photos it uses', async () => {
    const html = await render('landing');
    for (const id of ['everyone', 'roles', 'how', 'term', 'help']) assert.match(html, new RegExp(`id="${id}"`));
    for (const role of ['admin', 'teacher', 'parent', 'student', 'auxiliary']) assert.ok(html.includes(`/login?as=${role}`), role);
    const js = fs.readFileSync(path.join(__dirname, '../public/js/site-home.js'), 'utf8');
    for (const m of js.matchAll(/photo: "([^"]+)"/g)) assert.ok(fs.existsSync(path.join(__dirname, '../public', m[1])), m[1]);
});

test('the public site routes and the ?as= sign-in preselect', () => {
    const router = fs.readFileSync(path.join(__dirname, '../routes/webRouter.js'), 'utf8');
    for (const [route, view] of [['/', 'landing'], ['/modules', 'modules'], ['/pricing', 'pricing']]) {
        assert.ok(router.includes(`webRouter.get('${route}', (req, res) => res.render('${view}'))`), route);
    }
    const auth = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
    assert.match(auth, /new URLSearchParams\(window\.location\.search\)\.get\('as'\)/);
    assert.match(auth, /if \(askedRole && IDENT_CONFIG\[askedRole\]\)/, 'only known account types are accepted');
});
