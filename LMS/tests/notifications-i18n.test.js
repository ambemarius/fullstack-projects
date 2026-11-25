// Notification bell (announcements, reminders, personal updates) and the English / French switch.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ejs = require('ejs');
const { createApp } = require('../app/app');
const generateToken = require('../utils/generateToken');
const { createNotificationFeed, schoolClock } = require('../model/notifications/notificationFeed');
const { serve } = require('./helpers/http');

const pv = params => Object.fromEntries(Object.entries(params).map(([k, [, v]]) => [k, v]));

test('the school clock follows Cameroon time and the term by month', () => {
    assert.deepEqual(schoolClock(new Date('2026-11-24T07:30:00Z')), { date: '2026-11-24', day: 'Tuesday', time: '08:30', term: 'First' });
    assert.equal(schoolClock(new Date('2027-02-10T10:00:00Z')).term, 'Second');
    assert.equal(schoolClock(new Date('2027-05-10T10:00:00Z')).term, 'Third');
});

test('a teacher gets announcements, the lesson now and next, registers not taken, and lab updates', async () => {
    const seen = [];
    const query = async (statement, params) => {
        const p = pv(params); seen.push({ statement, p });
        if (statement.includes('FROM school_announcements')) return { recordset: [{ id: 3, title: 'Seq. 3 marks due Friday', body: 'Enter all sheets.', created_at: new Date('2026-11-23T09:00:00Z') }] };
        if (statement.includes('FROM timetables t JOIN subjects')) return { recordset: [
            { start_time: '07:30', end_time: '08:20', subject: 'Mathematics', class_name: 'Form 3', stream: 'A', room: '', taken: 0 },
            { start_time: '08:20', end_time: '09:10', subject: 'Mathematics', class_name: 'Form 4', stream: 'Normal', room: 'B2', taken: 1 },
            { start_time: '10:00', end_time: '10:50', subject: 'Physics', class_name: 'Form 5', stream: 'Normal', room: '', taken: 0 },
        ] };
        if (statement.includes('FROM lab_requests')) return { recordset: [{ id: 9, status: 'issued', return_by: '2026-11-20', name: 'Microscope' }] };
        throw new Error('unexpected ' + statement);
    };
    const feed = createNotificationFeed({ query, clock: () => new Date('2026-11-24T07:30:00Z') }); // 08:30 in Douala
    const { items } = await feed.feed({ type: 'teacher', id: 4, schoolId: 1 });
    const titles = items.map(i => i.title);
    assert.ok(titles.includes('Now: Mathematics, Form 4'));
    assert.ok(titles.includes('Next lesson at 10:00: Physics, Form 5'));
    assert.ok(titles.includes('Register not taken yet'), 'the 07:30 lesson has no register');
    assert.ok(titles.includes('Return overdue: Microscope'));
    assert.ok(titles.includes('Seq. 3 marks due Friday'));
    assert.equal(items[0].level, 'warn', 'warnings first');
    const ann = seen.find(s => s.statement.includes('FROM school_announcements'));
    assert.deepEqual([ann.p.a0, ann.p.a1, ann.p.a2], ['everyone', 'staff', 'teachers'], 'teachers see staff and teacher notices only');
    assert.equal(ann.p.school, 1);
});

test('a parent gets each child\'s new marks and absences, and fees still owed', async () => {
    const query = async (statement, params) => {
        if (statement.includes('FROM school_announcements')) return { recordset: [] };
        if (statement.includes('FROM parent_students')) return { recordset: [{ id: 5, name: 'Ada Ngo' }, { id: 6, name: 'Ben Ngo' }] };
        if (statement.includes('FROM subject_scores')) return { recordset: [{ student_id: 5, subject: 'Physics', term: 'Second', sequence: 1, score: 15, max_score: 20, updated_at: new Date('2026-11-22T10:00:00Z') }] };
        if (statement.includes('FROM attendance_marks')) return { recordset: [{ student_id: 6, lesson_date: '2026-11-21', start_time: '08:00', subject: 'French', status: 'absent' }] };
        if (statement.includes('FROM finance_charges')) return { recordset: [{ student_id: 5, owing: 15000 }, { student_id: 6, owing: 0 }] };
        throw new Error('unexpected ' + statement);
    };
    const { items } = await createNotificationFeed({ query, clock: () => new Date('2026-11-24T10:00:00Z') }).feed({ type: 'parent', id: 2, schoolId: 1 });
    const by = Object.fromEntries(items.map(i => [i.kind, i]));
    assert.equal(by.mark.title, 'Ada Ngo: New mark');
    assert.equal(by.mark.detail, 'Latest: Physics, Seq. 3: 15/20');
    assert.equal(by.absence.title, 'Ben Ngo: 1 absence this week');
    assert.equal(by.fees.title, 'Ada Ngo: Fees outstanding');
    assert.equal(items.filter(i => i.kind === 'fees').length, 1, 'nothing owed for the second child');
});

test('the bell API needs a school account; announcements are for administrators and validated', async t => {
    const app = createApp({ logging: false });
    const calls = [];
    app.locals.notificationFeed = { feed: async actor => (calls.push(actor), { items: [{ id: 'x', title: 'Hi' }] }) };
    app.locals.announcementQuery = async (statement, params) => { calls.push({ statement, p: pv(params) }); return { recordset: [{ id: 7 }] }; };
    const Teacher = require('../model/staff/teacher');
    const Admin = require('../model/staff/admin');
    t.mock.method(Teacher, 'findById', async id => ({ id, status: 'active', school_id: 1 }));
    t.mock.method(Admin, 'findById', async id => ({ id, role: 'Admin', school_id: 1 }));
    const base = await serve(t, app);
    const call = (method, p, token, body) => fetch(base + '/api/v1/notifications' + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body && JSON.stringify(body) });
    const teacher = generateToken(4, 'teacher', undefined, 1), admin = generateToken(7, 'admin', undefined, 1);

    assert.equal((await call('GET', '', null)).status, 401);
    const mine = await call('GET', '', teacher);
    assert.equal(mine.status, 200);
    assert.deepEqual(calls[0], { type: 'teacher', id: 4, schoolId: 1 }, 'the school comes from the sign-in');
    assert.equal((await call('POST', '/announcements', teacher, { title: 'x' })).status, 401, 'teachers cannot post');
    assert.equal((await call('POST', '/announcements', admin, { title: 'Hi', audience: 'everyone', startsOn: '2026-11-24', endsOn: '2026-11-20' })).status, 422);
    const ok = await call('POST', '/announcements', admin, { title: 'Exams start Monday', audience: 'students', startsOn: '2026-11-24', endsOn: '2026-11-30', school_id: 2 });
    assert.equal(ok.status, 201);
    const insert = calls.find(c => c.statement && c.statement.includes('INSERT INTO school_announcements'));
    assert.equal(insert.p.school, 1, 'school_id in the body is ignored');
    assert.equal(insert.p.audience, 'students');
});

test('the French dictionaries load, cover the menus and translate text with numbers', () => {
    const ctx = { window: {} };
    vm.createContext(ctx);
    for (const f of ['i18n-fr-site.js', 'i18n-fr-app.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', f), 'utf8'), ctx);
    const fr = ctx.window.KODO_FR;
    for (const [en, expected] of [['Home', 'Accueil'], ['How it works', 'Comment ça marche'], ['Pricing', 'Tarifs'], ['Sign in', 'Se connecter'], ['Sign out', 'Se déconnecter'],
        ['Class master', 'Professeur principal'], ['Laboratory requests', 'Demandes au laboratoire'], ['Notifications', 'Notifications'], ['Account type', 'Type de compte']]) {
        assert.equal(fr[en], expected, en);
    }
    const translate = s => { for (const [re, to] of ctx.window.KODO_FR_PATTERNS) if (re.test(s)) return s.replace(re, to); return s; };
    assert.equal(translate('Next lesson at 10:00: Physics, Form 5'), 'Prochain cours à 10:00 : Physics, Form 5');
    assert.equal(translate('3 registers not taken yet'), '3 appels pas encore faits');
    assert.equal(translate('Welcome back, Ada!'), 'Bon retour, Ada !');
});

test('every signed-in page and the public site load the language switch; the bell is on the signed-in pages', async () => {
    for (const view of ['teacher-dashboard', 'student-dashboard', 'parent-dashboard', 'admin-layout']) {
        const html = fs.readFileSync(path.join(__dirname, `../views/${view}.ejs`), 'utf8');
        assert.match(html, /<script src="\/js\/i18n\.js"><\/script>/, view);
        assert.match(html, /<script src="\/js\/notify-bell\.js"><\/script>/, view);
    }
    const footer = fs.readFileSync(path.join(__dirname, '../views/partials/footer.ejs'), 'utf8');
    assert.match(footer, /notify-bell\.js/);
    const landing = await ejs.renderFile(path.join(__dirname, '../views/landing.ejs'), {});
    assert.match(landing, /<script src="\/js\/i18n\.js"><\/script>/);
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(landing), false, 'no inline scripts');
    const admin = fs.readFileSync(path.join(__dirname, '../views/admin-layout.ejs'), 'utf8');
    assert.match(admin, /<form id="annForm"/);
    const sqlText = fs.readFileSync(path.join(__dirname, '../migrations/025_school_announcements.sql'), 'utf8');
    assert.match(sqlText, /CK_school_announcements_school_required CHECK \(school_id IS NOT NULL\)/);
    assert.match(sqlText, /ALTER SECURITY POLICY security\.school_isolation/);
});
