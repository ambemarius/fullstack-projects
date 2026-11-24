// School sign-up from the public site and its validation by KodoSchool staff.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { createApp } = require('../app/app');
const generateToken = require('../utils/generateToken');
const { createSchoolSignupService, codeFromName } = require('../model/platform/schoolSignupService');
const { serve } = require('./helpers/http');

const valid = {
    schoolName: 'Lycée Bilingue de Bertoua', educationSystem: 'Bilingual', address: 'P.O. Box 12, Bertoua', regionId: 3, divisionId: 30,
    adminName: 'Marie Ngo', adminFunction: 'Principal', adminPhone: '6 77 12 34 56', adminEmail: 'Principal@Example.invalid',
    password: 'synthetic9pass', acceptTerms: true,
};

// A fake database that answers the sign-up service's statements.
function fakeDb({ codes = [], pending = [], duplicate = null } = {}) {
    const inserts = [];
    const query = async (statement, params = {}) => {
        const p = Object.fromEntries(Object.entries(params).map(([k, [, v]]) => [k, v]));
        if (statement.includes('SELECT region_id FROM divisions')) return { recordset: p.d === 30 ? [{ region_id: 3 }] : p.d === 31 ? [{ region_id: 4 }] : [] };
        if (statement.includes('admin_email = @email AND school_name')) return { recordset: duplicate ? [{ reference: duplicate }] : [] };
        if (statement.includes('UPPER(code) LIKE @like')) return { recordset: [...codes, ...pending].filter(c => c.startsWith(p.like.slice(0, -1))).map(code => ({ code })) };
        if (statement.includes('INSERT INTO school_signup_requests')) { inserts.push(p); return { recordset: [] }; }
        throw new Error('unexpected: ' + statement);
    };
    return { query, inserts };
}
const service = (db, extra = {}) => createSchoolSignupService({ query: db.query, hash: async p => 'hash:' + p, ...extra });

test('school codes come from the name: accents and small words dropped, kept unique', async () => {
    assert.equal(codeFromName('Lycée Bilingue de Bertoua'), 'LYCEE_BILINGUE_BERTOUA');
    assert.equal(codeFromName("Collège d'Enseignement Secondaire"), 'COLLEGE_ENSEIGNEMENT_SECONDAIRE');
    assert.equal(codeFromName('G.B.H.S. Mfou'), 'G_B_H_S_MFOU');
    const db = fakeDb({ codes: ['LYCEE_BILINGUE_BERTOUA'], pending: ['LYCEE_BILINGUE_BERTOUA_2'] });
    const sent = await service(db).submit(valid);
    assert.equal(sent.schoolCode, 'LYCEE_BILINGUE_BERTOUA_3', 'taken by a school and by a pending request');
});

test('a valid sign-up is stored as pending with a hashed password and tidy contact details', async () => {
    const db = fakeDb();
    const sent = await service(db).submit(valid, { ip: '10.0.0.5' });
    assert.match(sent.reference, /^KS-[0-9A-F]{8}$/);
    assert.deepEqual([sent.status, sent.adminEmail, sent.schoolName], ['pending', 'principal@example.invalid', 'Lycée Bilingue de Bertoua']);
    const row = db.inserts[0];
    assert.equal(row.aphone, '+237677123456');
    assert.equal(row.hash, 'hash:synthetic9pass', 'only the hash is stored');
    assert.equal(Object.values(row).includes('synthetic9pass'), false);
    assert.equal(row.ip, '10.0.0.5');
    const other = await service(fakeDb()).submit({ ...valid, adminFunction: 'Other', adminFunctionOther: 'Academic director' });
    assert.equal(other.status, 'pending');
});

test('sign-ups are refused with the field to fix', async () => {
    const reject = async (change, field, extra) => assert.rejects(service(fakeDb(extra)).submit({ ...valid, ...change }), e => e.statusCode === 422 && e.field === field, field);
    await reject({ schoolName: 'A' }, 'schoolName');
    await reject({ educationSystem: 'Other' }, 'educationSystem');
    await reject({ address: '' }, 'address');
    await reject({ regionId: 'x' }, 'regionId');
    await reject({ divisionId: 31 }, 'divisionId'); // a division of another region
    await reject({ adminPhone: '12345' }, 'adminPhone');
    await reject({ adminEmail: 'not-an-email' }, 'adminEmail');
    await reject({ adminFunction: 'Dictator' }, 'adminFunction');
    await reject({ password: 'short1' }, 'password');
    await reject({ password: 'lettersonly' }, 'password');
    await reject({ acceptTerms: false }, 'acceptTerms');
    await assert.rejects(service(fakeDb()).submit({ ...valid, website: 'http://spam.invalid' }), e => e.statusCode === 422, 'honeypot');
    await assert.rejects(service(fakeDb({ duplicate: 'KS-ABCDEF12' })).submit(valid), e => e.statusCode === 409 && /KS-ABCDEF12/.test(e.message));
});

test('approval is paused while reads are not separated by school', async () => {
    let touched = false;
    const svc = createSchoolSignupService({ query: async () => ({ recordset: [] }), transaction: async () => { touched = true; }, isolationReady: async () => false });
    await assert.rejects(svc.approve({ id: 7 }, 4), e => e.statusCode === 409 && /row-level security/.test(e.message));
    assert.equal(touched, false);
});

test('approval creates the school and its super administrator in one transaction', async () => {
    const statements = [];
    let committed = false;
    const request = { id: 4, status: 'pending', proposed_code: 'GBHS_BERTOUA', school_name: 'GBHS Bertoua', education_system: 'Anglophone',
        admin_name: 'Marie Ngo', admin_email: 'marie@example.invalid', admin_password_hash: 'hash:x' };
    const tx = {
        async query(statement, params = {}) {
            statements.push({ statement, params: Object.fromEntries(Object.entries(params).map(([k, [, v]]) => [k, v])) });
            if (statement.includes('FROM school_signup_requests WITH (UPDLOCK')) return { recordset: [request] };
            if (statement.includes('FROM schools WITH')) return { recordset: [] };
            if (statement.includes('INSERT INTO schools')) return { recordset: [{ id: 9 }] };
            return { recordset: [] };
        },
        commit: async () => { committed = true; }, rollback: async () => {},
    };
    const svc = createSchoolSignupService({ query: async () => ({ recordset: [] }), transaction: async () => tx, isolationReady: async () => true });
    assert.deepEqual(await svc.approve({ id: 7 }, 4), { id: 4, status: 'approved', schoolId: 9, schoolCode: 'GBHS_BERTOUA', adminEmail: 'marie@example.invalid' });
    assert.equal(committed, true);
    const admin = statements.find(s => s.statement.includes('INSERT INTO Admins'));
    assert.deepEqual([admin.params.school, admin.params.email, admin.params.hash], [9, 'marie@example.invalid', 'hash:x'], 'the new admin belongs to the new school');
    assert.match(statements.find(s => s.statement.includes("SET status = 'approved'")).statement, /activated_school_id = @school/);

    request.status = 'approved';
    await assert.rejects(svc.approve({ id: 7 }, 4), e => e.statusCode === 409, 'cannot approve twice');
});

test('the form endpoints are public; reviewing is not part of the public sign-up API', async t => {
    const fake = {
        regions: async () => [{ id: 3, name: 'East' }],
        divisions: async () => [{ id: 30, name: 'Lom-et-Djérem' }],
        submit: async body => ({ reference: 'KS-00000001', schoolCode: 'X', schoolName: body.schoolName, adminEmail: 'a@b.cm', status: 'pending' }),
    };
    const app = createApp({ logging: false });
    app.locals.schoolSignupService = fake;
    const base = await serve(t, app);
    assert.equal((await fetch(base + '/api/v1/school-signup/regions')).status, 200);
    assert.equal((await fetch(base + '/api/v1/school-signup/divisions?regionId=3')).status, 200);
    const sent = await fetch(base + '/api/v1/school-signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
    assert.equal(sent.status, 201);
    const admin = generateToken(7, 'admin', undefined, 1);
    assert.notEqual((await fetch(base + '/api/v1/school-signup/requests', { headers: { Authorization: 'Bearer ' + admin } })).status, 200, 'no review endpoint here');
});

test('the sign-up page: three steps, the fields asked for, linked from the home page; no inline scripts', async () => {
    const html = await ejs.renderFile(path.join(__dirname, '../views/school-signup.ejs'), {});
    for (const id of ['schoolName', 'address', 'regionId', 'divisionId', 'adminName', 'adminFunction', 'adminPhone', 'adminEmail', 'password', 'acceptTerms']) {
        assert.ok(html.includes(`id="${id}"`), id);
    }
    assert.equal((html.match(/<li data-step="\d"/g) || []).length, 3);
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false);
    assert.ok(html.includes('<script src="/js/school-signup.js"></script>'));
    const landing = await ejs.renderFile(path.join(__dirname, '../views/landing.ejs'), {});
    assert.ok(landing.includes('<a href="/signup" class="btn btn-gold">Register your school'));
    const review = await ejs.renderFile(path.join(__dirname, '../views/platform-console.ejs'), {});
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(review), false);
    const router = fs.readFileSync(path.join(__dirname, '../routes/webRouter.js'), 'utf8');
    assert.ok(router.includes("webRouter.get('/signup', (req, res) => res.render('school-signup'));"));
});
