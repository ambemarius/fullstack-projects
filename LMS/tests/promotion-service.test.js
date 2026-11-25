// End-of-year promotion from the bulletin's annual average, with the council's decisions.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPromotionService } = require('../model/Academic/promotionService');

const pv = params => Object.fromEntries(Object.entries(params).map(([k, [, v]]) => [k, v]));
function fakes({ rank = 1, nextYear = { id: 6, name: '2027/2028' }, roster = [1, 2, 3] } = {}) {
    const writes = [];
    let committed = false;
    const query = async (statement, params = {}) => {
        const p = pv(params);
        if (statement.includes('FROM classes WHERE id')) return { recordset: [{ id: 2, name: 'Form1', section: 'Anglophone', stream: 'Bilingual', rank }] };
        if (statement.includes('FROM academic_years WHERE id')) return { recordset: [{ id: 5, name: '2026/2027', fromYear: 2026, toYear: 2027 }] };
        if (statement.includes('fromYear > @from')) return { recordset: nextYear ? [nextYear] : [] };
        if (statement.includes('WHERE section = @section AND rank = @rank')) return { recordset: [{ id: 3, name: 'Form2', stream: 'Normal' }, { id: 4, name: 'Form2', stream: 'Bilingual' }] };
        if (statement.includes('FROM students WHERE currentClassLevel')) return { recordset: roster.map(id => ({ id })) };
        throw new Error('unexpected ' + statement);
    };
    const transaction = async () => ({ query: async (s, params) => writes.push({ s, p: pv(params) }), commit: async () => { committed = true; }, rollback: async () => {} });
    const card = (id, annual, terms, r) => ({ student: { id: String(id), full_name: 'Student ' + id, matricule: 'M' + id, is_repeater: false }, annual_average: annual, term_history: terms.map(avg => ({ avg })), totals: { rank: r } });
    const reportCards = { classCards: async () => ({ cards: [card(1, 12.5, [12, 13, 12.5], 1), card(2, 9.4, [9, 10, 9.2], 2), card(3, null, [11, null, null], null)] }) };
    return { svc: createPromotionService({ query, transaction, reportCards }), writes, committed: () => committed };
}

test('the preview proposes promote at 10/20 or more, repeat below or without an annual average, same stream first', async () => {
    const { svc } = fakes();
    const p = await svc.preview({ classId: 2, yearId: 5 });
    assert.deepEqual(p.students.map(s => [s.id, s.decision]), [[1, 'promote'], [2, 'repeat'], [3, 'repeat']]);
    assert.equal(p.students[2].reason, 'No annual average yet (marks missing)');
    assert.deepEqual(p.nextClasses.map(c => c.id), [4, 3], 'Form 1 Bilingual moves to Form 2 Bilingual by default');
    assert.deepEqual(p.counts, { promote: 1, repeat: 2, graduate: 0 });
    assert.deepEqual(p.nextYear, { id: 6, name: '2027/2028' });
});

test('final-year classes graduate instead of moving up', async () => {
    const { svc } = fakes({ rank: 7 });
    const p = await svc.preview({ classId: 2, yearId: 5 });
    assert.equal(p.class.finalYear, true);
    assert.deepEqual(p.students.map(s => s.decision), ['graduate', 'repeat', 'repeat']);
});

test('applying enrols promoted and repeating students for the next year, in one transaction, with the council\'s overrides', async () => {
    const { svc, writes, committed } = fakes();
    const r = await svc.apply({ id: 7 }, { classId: 2, yearId: 5, nextClassId: 4, decisions: { 1: 'promote', 2: 'promote', 3: 'repeat' } });
    assert.deepEqual([r.promoted, r.repeating, r.graduated, r.nextYear], [2, 1, 0, '2027/2028']);
    assert.equal(committed(), true);
    const promote = writes.filter(w => w.s.includes('SET currentClassLevel = @cls'));
    assert.equal(promote.length, 2);
    assert.deepEqual([promote[0].p.cls, promote[0].p.next], [4, 6], 'moved to the chosen class for the next year');
    assert.match(writes.find(w => w.p.id === 3).s, /SET academicYearId = @next, promoted = 0/);
});

test('apply refuses without a next year, a missing decision, a stranger, or a class that is not one level up', async () => {
    await assert.rejects(fakes({ nextYear: null }).svc.apply({ id: 7 }, { classId: 2, yearId: 5, nextClassId: 4, decisions: { 1: 'promote', 2: 'repeat', 3: 'repeat' } }), e => e.statusCode === 409 && /next academic year/.test(e.message));
    await assert.rejects(fakes().svc.apply({ id: 7 }, { classId: 2, yearId: 5, nextClassId: 4, decisions: { 1: 'promote', 2: 'repeat' } }), e => e.statusCode === 422 && /every student/.test(e.message));
    await assert.rejects(fakes().svc.apply({ id: 7 }, { classId: 2, yearId: 5, nextClassId: 4, decisions: { 1: 'promote', 2: 'repeat', 3: 'repeat', 99: 'repeat' } }), e => e.statusCode === 409);
    await assert.rejects(fakes().svc.apply({ id: 7 }, { classId: 2, yearId: 5, nextClassId: 21, decisions: { 1: 'promote', 2: 'repeat', 3: 'repeat' } }), e => e.statusCode === 422 && /one level up/.test(e.message));
    await assert.rejects(fakes().svc.apply({ id: 7 }, { classId: 2, yearId: 5, decisions: { 1: 'graduate', 2: 'repeat', 3: 'repeat' } }), e => e.statusCode === 422 && /final-year/.test(e.message));
});

test('timetable and promotion pages keep the admin side menu; promotion explains itself', () => {
    for (const [view, active] of [['timetable', 'timetable'], ['promotion', 'promotion']]) {
        const html = fs.readFileSync(path.join(__dirname, `../views/${view}.ejs`), 'utf8');
        assert.ok(html.includes(`include('partials/admin-sidebar', { active: '${active}' })`), view);
        assert.match(html, /<script src="\/js\/admin-shell\.js"><\/script>/, view);
    }
    const admin = fs.readFileSync(path.join(__dirname, '../views/admin-layout.ejs'), 'utf8');
    assert.match(admin, /include\('partials\/admin-sidebar', \{ inDashboard: true \}\)/);
    const promo = fs.readFileSync(path.join(__dirname, '../views/promotion.ejs'), 'utf8');
    assert.match(promo, /How promotion works/);
    const js = fs.readFileSync(path.join(__dirname, '../public/js/promotion.js'), 'utf8');
    assert.match(js, /api\('\/promotion\/apply'/);
    assert.equal(js.includes('/students/promote/'), false, 'the old all-students promotion is no longer used by the page');
});

test('library and laboratory show the admin menu to administrators only; staff keep their own menu', async () => {
    const ejs = require('ejs');
    const locals = isAdmin => ({ area: 'library', paths: { library: '/library', laboratory: '/laboratory', requests: '/lab-requests' }, home: isAdmin ? '/admin-dashboard' : '/staff-dashboard',
        pageTitle: 'Catalogue', actorName: 'X', roleLabel: isAdmin ? 'Administrator' : 'Librarian', isAdmin, uuid: () => 'u' });
    const admin = await ejs.renderFile(path.join(__dirname, '../views/inventory/shell.ejs'), locals(true));
    assert.match(admin, /href="\/admin-dashboard#registration"/);
    assert.match(admin, /href="\/library" aria-current="page"/);
    const librarian = await ejs.renderFile(path.join(__dirname, '../views/inventory/shell.ejs'), locals(false));
    assert.equal(librarian.includes('/admin-dashboard#registration'), false, 'no admin menu for the librarian');
    assert.equal(librarian.includes('Lycée Batouri'), false, 'the school name comes from the sign-in');
});

test('attendance opens inside the admin layout for administrators and in the staff layout otherwise', async t => {
    const { createApp } = require('../app/app');
    const generateToken = require('../utils/generateToken');
    const { serve } = require('./helpers/http');
    const base = await serve(t, createApp({ logging: false }));
    const page = token => fetch(base + '/attendance', { headers: token ? { Cookie: 'lms_token=' + token } : {} }).then(r => r.text());
    const admin = await page(generateToken(7, 'admin', undefined, 1));
    assert.match(admin, /<aside class="sidebar" id="sidebar">/);
    assert.match(admin, /href="\/attendance" aria-current="page"/);
    const staff = await page(generateToken(4, 'teacher', undefined, 1));
    assert.equal(staff.includes('<aside class="sidebar"'), false, 'the discipline master keeps the staff layout');
    assert.match(staff, /<header class="topbar">/);
});

test('the finance workspace keeps its own menu and adds the admin menu for administrators only', async () => {
    const ejs = require('ejs');
    const render = isAdmin => ejs.renderFile(path.join(__dirname, '../views/finance/nav.ejs'), { home: '/', base: '/finance', active: 'charges', isAdmin });
    const admin = await render(true);
    assert.match(admin, /href="\/finance\/pay"/, 'finance pages stay');
    assert.match(admin, /href="\/admin-dashboard#registration"/);
    assert.match(admin, /href="\/finance" aria-current="page"/);
    const bursar = await render(false);
    assert.match(bursar, /href="\/finance\/pay"/);
    assert.equal(bursar.includes('/admin-dashboard#'), false, 'no admin menu for the bursar');
});
