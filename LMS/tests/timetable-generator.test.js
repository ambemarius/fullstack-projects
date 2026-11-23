const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { createTimetableGenerator, parseOptions } = require('../model/Academic/timetableGenerator');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const admin = { id: 7 };
const SLOTS = [{ id: 1, start_time: '07:30', end_time: '08:30' }, { id: 2, start_time: '08:30', end_time: '09:30' }];
// 2 classes x 2 periods x 5 days = 20 class slots. Maths teacher 1 shared by both classes (6 periods, fits);
// Class 2 English has no teacher (cannot be placed).
const ROWS = [
    { class_id: 1, section: 'Anglophone', class_name: 'Form1', subject_id: 10, subject: 'Maths', periods_week: 3, teacher_id: 1, teacher: 'Maths T' },
    { class_id: 1, section: 'Anglophone', class_name: 'Form1', subject_id: 11, subject: 'English', periods_week: 2, teacher_id: 2, teacher: 'English T' },
    { class_id: 2, section: 'Anglophone', class_name: 'Form2', subject_id: 10, subject: 'Maths', periods_week: 3, teacher_id: 1, teacher: 'Maths T' },
    { class_id: 2, section: 'Anglophone', class_name: 'Form2', subject_id: 11, subject: 'English', periods_week: 2, teacher_id: null, teacher: null },
];

function fakeDb({ existing = { lessons: 3, maxId: 9, checksum: 42 }, studySubject = null, rows = ROWS } = {}) {
    const log = { statements: [], committed: 0, rolledBack: 0, inserted: 0 };
    const answer = (statement, params) => {
        log.statements.push({ statement, params });
        const r = (recordset = [], affected = 0) => ({ recordset, rowsAffected: [affected] });
        if (statement.includes('FROM academic_years WHERE id')) return r(params.year === 5 ? [{ id: 5, name: '2026/2027' }] : []);
        if (statement.includes('FROM time_slots')) return r(SLOTS);
        if (statement.includes('FROM class_subjects cs')) return r(rows);
        if (statement.includes('CHECKSUM_AGG')) return r([existing]);
        if (statement.startsWith('SELECT * FROM timetables')) return r([{ id: 9, class_id: 1 }]);
        if (statement.includes('SELECT id, timetable_id FROM attendance_registers')) return r([{ id: 2, timetable_id: 9 }]);
        if (statement.includes('SELECT id FROM subjects WHERE code')) return r(studySubject ? [{ id: studySubject }] : []);
        if (statement.includes('INSERT INTO subjects')) return r([{ id: 26 }], 1);
        if (statement.includes('UPDATE attendance_registers')) return r([], 1);
        if (statement.startsWith('DELETE FROM timetables')) return r([], existing.lessons);
        if (statement.startsWith('INSERT INTO timetables')) {
            const n = Object.keys(params).filter(k => /^c\d+$/.test(k)).length;
            log.inserted += n;
            return r([], n);
        }
        if (statement.includes('AS teacherClashes')) return r([{ total: log.inserted, teacherClashes: 0, classClashes: 0 }]);
        throw new Error('unexpected statement: ' + statement.slice(0, 80));
    };
    const request = () => { const params = {}; return { input(n, _t, v) { params[n] = v; return this; }, query: async s => answer(s.trim(), params) }; };
    const read = async (statement, params = {}) => answer(statement.trim(), Object.fromEntries(Object.entries(params).map(([k, [, v]]) => [k, v])));
    const beginTransaction = async () => ({ begin: async () => {}, commit: async () => { log.committed++; }, rollback: async () => { log.rolledBack++; }, request });
    const backups = [];
    const saveBackup = (name, data) => { backups.push({ name, data, beforeDelete: !log.statements.some(s => s.statement.startsWith('DELETE')) }); return '/tmp/' + name; };
    return { log, backups, generator: createTimetableGenerator({ read, beginTransaction, saveBackup, clock: () => new Date('2026-11-23T10:00:00Z') }) };
}

test('options are validated before touching the database', () => {
    assert.throws(() => parseOptions({ yearId: 'x', term: 'First' }), { statusCode: 422 });
    assert.throws(() => parseOptions({ yearId: 5, term: 'Fourth' }), { statusCode: 422 });
    assert.deepEqual(parseOptions({ yearId: '5', term: 'Second', study: 'true' }), { yearId: 5, term: 'Second', study: true });
});

test('preview builds every class grid, reports what cannot be placed, and writes nothing', async () => {
    const { log, generator } = fakeDb();
    const p = await generator.preview({ yearId: 5, term: 'First', study: true });
    assert.equal(log.statements.some(s => /^(INSERT|UPDATE|DELETE)/.test(s.statement)), false, 'preview is read-only');
    assert.equal(p.academicYear.name, '2026/2027');
    assert.equal(p.existingLessons, 3);
    assert.match(p.fingerprint, /^[0-9a-f]{32}$/);
    assert.equal(p.validation.valid, true);
    assert.equal(p.validation.totalPlaced, 8, 'all assigned periods placed');
    assert.equal(p.validation.totalRequired, 10);
    assert.deepEqual(p.shortfall.map(s => [s.className, s.subject, s.teachers.length]), [['Form2', 'English', 0]]);
    assert.equal(p.classes.length, 2);
    assert.equal(p.classes[0].grid.length, 5);
    assert.equal(p.classes[0].grid[0].length, 2);
    assert.equal(p.validation.emptySlots, 0, 'study periods fill the rest');
    await assert.rejects(generator.preview({ yearId: 99, term: 'First' }), { statusCode: 404 });
});

test('apply refuses a stale or missing preview and changes nothing', async () => {
    const { log, backups, generator } = fakeDb();
    await assert.rejects(generator.apply(admin, { yearId: 5, term: 'First', study: true }), { statusCode: 422 });
    await assert.rejects(generator.apply(admin, { yearId: 5, term: 'First', study: true, fingerprint: '0'.repeat(32) }), { statusCode: 409, message: /changed since the preview/ });
    assert.equal(log.committed, 0);
    assert.equal(log.rolledBack, 1);
    assert.equal(backups.length, 0);
    assert.equal(log.statements.some(s => /^(INSERT|UPDATE|DELETE)/.test(s.statement)), false);
});

test('apply backs up first, keeps registers, replaces the term and verifies before committing', async () => {
    const { log, backups, generator } = fakeDb();
    const { fingerprint } = await generator.preview({ yearId: 5, term: 'First', study: true });
    const result = await generator.apply(admin, { yearId: 5, term: 'First', study: true, fingerprint });

    assert.equal(log.committed, 1);
    assert.equal(backups.length, 1);
    assert.equal(backups[0].beforeDelete, true, 'backup written before any delete');
    assert.deepEqual(backups[0].data.attendance_register_links, [{ id: 2, timetable_id: 9 }]);
    assert.match(backups[0].name, /^timetable_5_First_2026-11-23T10-00-00-000Z\.json$/);

    const order = log.statements.map(s => s.statement.split(/\s+/).slice(0, 3).join(' '));
    const at = prefix => order.findIndex(o => o.startsWith(prefix));
    assert.ok(at('UPDATE attendance_registers') < at('DELETE FROM timetables'), 'registers detached before rows are deleted');
    assert.ok(at('DELETE FROM timetables') < at('INSERT INTO timetables'));
    assert.ok(at('INSERT INTO subjects') >= 0, 'Study Period subject created when missing');
    assert.equal(log.statements.some(s => s.statement.includes('DELETE FROM attendance')), false, 'registers are never deleted');

    const inserts = log.statements.filter(s => s.statement.startsWith('INSERT INTO timetables'));
    assert.equal(result.inserted, 20, '8 lessons + 12 supervised study periods fill all 20 class slots');
    assert.equal(result.studyPeriods, 12);
    assert.equal(inserts[0].params.admin, 7);
    assert.equal(inserts[0].params.term, 'First');
    assert.ok(Object.entries(inserts[0].params).filter(([k]) => /^s\d+$/.test(k)).some(([, v]) => v === 26), 'study rows use the Study Period subject');
    assert.deepEqual([result.removed, result.detachedRegisters], [3, 1]);
});

test('apply reuses an existing Study Period subject and rolls back if verification fails', async () => {
    const { log, generator } = fakeDb({ studySubject: 31 });
    const { fingerprint } = await generator.preview({ yearId: 5, term: 'First', study: true });
    await generator.apply(admin, { yearId: 5, term: 'First', study: true, fingerprint });
    assert.equal(log.statements.some(s => s.statement.includes('INSERT INTO subjects')), false);

    const broken = fakeDb();
    const original = broken.generator;
    const fp = (await original.preview({ yearId: 5, term: 'First', study: false })).fingerprint;
    // Make the in-transaction verification report a clash.
    const realPush = broken.log.statements.push.bind(broken.log.statements);
    broken.log.statements.push = entry => { if (entry.statement.includes('AS teacherClashes')) broken.log.inserted = -1; return realPush(entry); };
    await assert.rejects(original.apply(admin, { yearId: 5, term: 'First', study: false, fingerprint: fp }), { statusCode: 500, message: /Nothing was changed/ });
    assert.equal(broken.log.committed, 0);
    assert.equal(broken.log.rolledBack, 1);
});

test('generate endpoints are administrator-only and pass the request to the generator', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM Admins WHERE id')) return { recordset: [{ id: 1, role: 'admin', name: 'A', school_id: 1 }] };
        if (statement.includes('FROM teachers WHERE id')) return { recordset: [{ id: 3, status: 'active', name: 'T', school_id: 1 }] };
        throw new Error('unexpected statement: ' + statement);
    });
    const app = createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
    const calls = [];
    app.locals.timetableGenerator = {
        preview: async opts => { calls.push(['preview', opts]); return { fingerprint: 'f'.repeat(32) }; },
        apply: async (actor, opts) => { calls.push(['apply', actor, opts]); return { inserted: 840, term: 'First', academicYear: { name: '2026/2027' } }; },
    };
    const base = await serve(t, app);
    const post = (url, body, token) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

    assert.equal((await post('/api/v1/timetables/generate/school/preview', {})).status, 401);
    assert.equal((await post('/api/v1/timetables/generate/school', {}, generateToken(3, 'teacher'))).status, 401, 'teachers cannot generate');
    assert.equal(calls.length, 0);

    const prev = await post('/api/v1/timetables/generate/school/preview', { academic_year_id: 5, term: 'First', study: true }, generateToken(1, 'admin'));
    assert.equal(prev.status, 200);
    assert.deepEqual(calls[0], ['preview', { yearId: 5, term: 'First', study: true }]);

    const applied = await post('/api/v1/timetables/generate/school', { academic_year_id: 5, term: 'First', study: true, fingerprint: 'f'.repeat(32) }, generateToken(1, 'admin'));
    assert.equal(applied.status, 201);
    assert.deepEqual(calls[1], ['apply', { id: 1 }, { yearId: 5, term: 'First', study: true, fingerprint: 'f'.repeat(32) }]);
    assert.match((await applied.json()).message, /840 lessons for 2026\/2027, First term/);
});
