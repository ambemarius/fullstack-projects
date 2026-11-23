const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { createReportCardService } = require('../model/Academic/reportCardService');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const admin = { id: 7 };
const r = (recordset = [], affected = 0) => ({ recordset, rowsAffected: [affected] });

// Class 1 (Form1, Anglophone) with two students, Maths (coef from class_subjects) and English (falls back to subjects.coefficient).
function fakeRead({ groups = [], members = [], records = [], settings = null } = {}) {
    const log = [];
    const read = async (statement, params = {}) => {
        const p = Object.fromEntries(Object.entries(params).map(([k, [, v]]) => [k, v]));
        log.push({ statement, p });
        if (statement.includes('FROM classes WHERE id')) return r(p.class === 1 ? [{ id: 1, name: 'Form1', stream: 'Bilingual', section: 'Anglophone', school_id: 1 }] : []);
        if (statement.includes('FROM academic_years WHERE id')) return r([{ id: 5, name: '2026/2027' }]);
        if (statement.includes('FROM schools WHERE id')) return r([{ id: 1, name: 'LYCEE BATOURI' }]);
        if (statement.includes('FROM report_card_settings')) return r(settings ? [settings] : []);
        if (statement.includes('FROM report_card_terms')) return r([{ term: 'Second', reopening_date: '2027-01-04' }]);
        if (statement.includes('FROM students WHERE currentClassLevel')) return r([
            { id: 95, matricule: 'STU-01', firstName: 'Kima', middleName: null, lastName: 'Nkeng', dateOfBirth: '2010-03-02', address: 'Batouri', parentName: 'P' },
            { id: 96, matricule: 'STU-02', firstName: 'Nkechi', middleName: null, lastName: 'Taku', dateOfBirth: null, address: null, parentName: 'Mrs Taku' },
        ]);
        if (statement.includes('FROM report_card_student_terms')) return r(records);
        if (statement.includes('FROM class_subjects cs') && statement.includes('report_card_group_subjects gs')) return r([
            { id: 10, subject_id: 8, name: 'Mathematics', coefficient: 4, group_id: members.includes(8) ? 3 : null, display_order: 0, teacher_name: 'Mathematics Teacher' },
            { id: 11, subject_id: 9, name: 'English Language', coefficient: 1, group_id: null, display_order: 0, teacher_name: null },
        ]);
        if (statement.includes('FROM report_card_groups')) return r(groups);
        if (statement.includes('FROM subject_scores')) return r([
            { student_id: 95, class_subject_id: 10, term: 'First', sequence: 1, score: 25, max_score: 50 },   // 10/20
            { student_id: 95, class_subject_id: 10, term: 'Second', sequence: 1, score: 40, max_score: 50 },  // 16/20, global seq 3
            { student_id: 95, class_subject_id: 10, term: 'Second', sequence: 2, score: 30, max_score: 50 },  // 12/20, global seq 4
            { student_id: 95, class_subject_id: 11, term: 'Second', sequence: 1, score: 7, max_score: 20 },
            { student_id: 96, class_subject_id: 10, term: 'Second', sequence: 1, score: 10, max_score: 50 },  // 4/20
            { student_id: 96, class_subject_id: 10, term: 'Second', sequence: 3, score: 50, max_score: 50 },  // ignored: no sequence 3
        ]);
        if (statement.includes('FROM finance_charges')) return r([{ student_id: 95, owing: 25000 }]);
        throw new Error('unexpected statement: ' + statement.slice(0, 90));
    };
    return { log, read };
}
const absences = async () => new Map([[95, 3]]);
const image = () => null;

test('builds bulletins from the LMS marks: /50 marks become /20, term sequences become 3 and 4, coefficients fall back', async () => {
    const { read } = fakeRead({ records: [{ student_id: 96, is_repeater: true, council_attendance: 1, warnings: 2, suspensions: 0, council_remark: 'MUST WORK HARDER' }] });
    const service = createReportCardService({ read, absences, image });
    const data = await service.classCards({ classId: 1, term: 'Second', yearId: 5 });
    assert.equal(data.className, 'Form1 Bilingual');
    assert.equal(data.cards.length, 2);
    const [kima, nkechi] = data.cards;

    assert.deepEqual(kima.seq_labels, ['Seq. 3', 'Seq. 4']);
    assert.equal(kima.school.name_en, 'LYCEE BATOURI', 'falls back to the school name');
    assert.equal(kima.school.country_en, 'REPUBLIC OF CAMEROON');
    assert.equal(kima.classroom.section, 'ANGLOPHONE');
    assert.equal(kima.term.reopening_date, '2027-01-04');
    assert.equal(kima.groups.length, 1);
    assert.equal(kima.groups[0].name, 'SUBJECTS', 'one default band when none are configured');
    const maths = kima.groups[0].rows.find(x => x.name === 'MATHEMATICS');
    assert.deepEqual(maths.seq, [16, 12]);
    assert.deepEqual([maths.avg, maths.coef, maths.total, maths.rank, maths.teacher], [14, 4, 56, 1, 'Mathematics Teacher']);
    const english = kima.groups[0].rows.find(x => x.name === 'ENGLISH LANGUAGE');
    assert.deepEqual([english.avg, english.coef, english.remark], [7, 1, 'WEAK']);
    assert.equal(kima.totals.average, Number(((14 * 4 + 7) / 5).toFixed(2)));
    assert.deepEqual(kima.term_history.map(h => h.avg), [10, 12.6, null], 'first term from its own marks');
    assert.equal(kima.annual_average, null);
    assert.deepEqual([kima.discipline.absences, kima.owing, kima.student.parent_address], [3, 25000, 'Batouri']);

    assert.deepEqual(nkechi.groups[0].rows.map(x => x.name), ['MATHEMATICS'], 'English not taken: left off the card');
    assert.deepEqual([nkechi.totals.average, nkechi.totals.rank, nkechi.status], [4, 2, 'Failed/Échoué']);
    assert.deepEqual([nkechi.student.is_repeater, nkechi.discipline.warnings, nkechi.council_remark, nkechi.owing], [true, 2, 'MUST WORK HARDER', 0]);
    assert.equal(nkechi.student.parent_address, 'Mrs Taku');

    const one = await service.classCards({ classId: 1, term: 'Second', yearId: 5, studentId: 96 });
    assert.deepEqual(one.cards.map(c => [c.student.id, c.totals.rank]), [['96', 2]], 'a single card keeps its class rank');
});

test('configured bands group subjects; unassigned subjects print in OTHER SUBJECTS', async () => {
    const { read } = fakeRead({ groups: [{ id: 3, name: 'SCIENCES', display_order: 1, min_rows: 3 }], members: [8] });
    const card = (await createReportCardService({ read, absences, image }).classCards({ classId: 1, term: 'Second', yearId: 5 })).cards[0];
    assert.deepEqual(card.groups.map(g => [g.name, g.rows.map(x => x.name), g.padding]), [['SCIENCES', ['MATHEMATICS'], 2], ['OTHER SUBJECTS', ['ENGLISH LANGUAGE'], 0]]);
    assert.deepEqual(card.groups.map(g => g.average.label), ['Average 1', 'Average 2']);
});

test('inputs are validated before anything is read', async () => {
    const service = createReportCardService({ read: async () => { throw new Error('should not read'); }, absences, image });
    await assert.rejects(service.classCards({ classId: 'x', term: 'First', yearId: 5 }), { statusCode: 422 });
    await assert.rejects(service.classCards({ classId: 1, term: 'Fourth', yearId: 5 }), { statusCode: 422 });
    await assert.rejects(service.saveReopening(admin, 1, { yearId: 5, term: 'First', reopeningDate: '2027-02-30' }), { statusCode: 422 });
    const { read } = fakeRead();
    await assert.rejects(createReportCardService({ read, absences, image }).classCards({ classId: 2, term: 'First', yearId: 5 }), { statusCode: 404 });
});

function fakeTx(answer = () => r()) {
    const log = { statements: [], committed: 0, rolledBack: 0 };
    const beginTransaction = async () => ({
        begin: async () => {}, commit: async () => { log.committed++; }, rollback: async () => { log.rolledBack++; },
        request() { const p = {}; return { input(n, _t, v) { p[n] = v; return this; }, query: async s => { log.statements.push({ s, p }); return answer(s, p); } }; },
    });
    return { log, beginTransaction };
}

test('subject bands are validated and replaced in one transaction', async () => {
    const { log, beginTransaction } = fakeTx(s => {
        if (s.includes('SELECT id FROM subjects WHERE id IN')) return r([{ id: 8 }, { id: 9 }]);
        if (s.includes('INSERT INTO report_card_groups')) return r([{ id: 40 + log.statements.length }]);
        return r();
    });
    const { read } = fakeRead();
    const groupsRead = async (statement, params) => (statement.includes('FROM report_card_groups') || statement.includes('FROM report_card_group_subjects') || statement.includes('SELECT DISTINCT s.id') ? r([]) : read(statement, params));
    const service = createReportCardService({ read: groupsRead, beginTransaction, absences, image });

    await assert.rejects(service.saveGroups(admin, 1, [{ name: 'A', min_rows: 0, subjects: [8] }, { name: 'B', min_rows: 0, subjects: [8] }]), /only be in one band/);
    await assert.rejects(service.saveGroups(admin, 1, [{ name: 'A', subjects: [] }, { name: 'a', subjects: [] }]), /different name/);
    await assert.rejects(service.saveGroups(admin, 1, [{ name: '', subjects: [] }]), /needs a name/);
    await assert.rejects(service.saveGroups(admin, 1, [{ name: 'A', min_rows: 30, subjects: [] }]), { statusCode: 422 });
    assert.equal(log.statements.length, 0, 'nothing written for invalid bands');

    await service.saveGroups(admin, 1, [{ name: 'general education', min_rows: 2, subjects: [9, 8] }]);
    const order = log.statements.map(x => x.s.trim().split(/\s+/).slice(0, 3).join(' '));
    assert.equal(order.indexOf('DELETE FROM report_card_group_subjects') < order.indexOf('INSERT INTO report_card_groups'), true);
    const group = log.statements.find(x => x.s.includes('INSERT INTO report_card_groups'));
    assert.deepEqual([group.p.name, group.p.min, group.p.order], ['GENERAL EDUCATION', 2, 1]);
    assert.deepEqual(log.statements.filter(x => x.s.includes('INSERT INTO report_card_group_subjects')).map(x => [x.p.subject, x.p.order]), [[9, 0], [8, 1]]);
    assert.equal(log.committed, 1);
});

test('discipline records only accept students of the class and valid counts', async () => {
    const { log, beginTransaction } = fakeTx();
    const { read } = fakeRead();
    const service = createReportCardService({ read, beginTransaction, absences, image });
    await assert.rejects(service.saveRecords(admin, { classId: 1, term: 'First', yearId: 5, records: [{ studentId: 999 }] }), /not in this class/);
    await assert.rejects(service.saveRecords(admin, { classId: 1, term: 'First', yearId: 5, records: [{ studentId: 95, warnings: -1 }] }), { statusCode: 422 });
    assert.equal(log.statements.length, 0);
    const result = await service.saveRecords(admin, { classId: 1, term: 'First', yearId: 5, records: [{ studentId: 95, is_repeater: true, warnings: 1, council_remark: '  Good conduct ' }] });
    const merge = log.statements.find(x => x.s.includes('MERGE report_card_student_terms'));
    assert.deepEqual([merge.p.student, merge.p.rep, merge.p.warnings, merge.p.remark, merge.p.actor, merge.p.school], [95, true, 1, 'Good conduct', 7, 1]);
    assert.equal(result.students.length, 2);
    assert.equal(result.students[0].absences, 3);
});

test('report card endpoints are administrator-only; the print page renders escaped A4 cards with a barcode', async t => {
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM Admins WHERE id')) return { recordset: [{ id: 1, role: 'admin', name: 'A', school_id: 1 }] };
        if (statement.includes('FROM teachers WHERE id')) return { recordset: [{ id: 3, status: 'active', name: 'T', school_id: 1 }] };
        throw new Error('unexpected statement: ' + statement);
    });
    const { read } = fakeRead({ settings: { name_en: 'GOV HIGH SCHOOL <B>', name_fr: 'LYCÉE', watermark_text: 'LB', footer_text: 'Footer' } });
    const app = createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
    app.locals.reportCardService = createReportCardService({ read, absences, image });
    app.locals.reportCardSchoolId = 1;
    const base = await serve(t, app);
    const get = (url, token) => fetch(base + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

    assert.equal((await get('/report-cards/print?classId=1&term=Second&yearId=5')).status, 401);
    assert.equal((await get('/report-cards/print?classId=1&term=Second&yearId=5', generateToken(3, 'teacher'))).status, 401);
    assert.equal((await get('/api/v1/report-cards/settings', generateToken(3, 'teacher'))).status, 401);

    const page = await get('/report-cards/print?classId=1&term=Second&yearId=5', generateToken(1, 'admin'));
    assert.equal(page.status, 200);
    assert.match(page.headers.get('cache-control'), /no-store/);
    const html = await page.text();
    assert.equal((html.match(/class="page"/g) || []).length, 2, 'one page per student');
    assert.match(html, /GOV HIGH SCHOOL &lt;B&gt; \| LYCÉE/, 'heading is escaped');
    assert.match(html, /SECOND TERM<br>Deuxième Trimestre/);
    assert.match(html, /KIMA NKENG/);
    assert.match(html, /<svg [^>]*aria-label="STU-01"/, 'matricule barcode');
    assert.match(html, /25 000 FCFA/);
    assert.match(html, /04\.01\.2027/, 'reopening date dd.mm.yyyy');
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, 'no inline scripts (CSP)');

    const json = await get('/api/v1/report-cards/bulletins/1/Second/5?studentId=95', generateToken(1, 'admin'));
    assert.equal(json.status, 200);
    const body = await json.json();
    assert.deepEqual(body.data.cards.map(c => c.student.matricule), ['STU-01']);

    const bad = await get('/report-cards/print?classId=1&term=Fourth&yearId=5', generateToken(1, 'admin'));
    assert.equal(bad.status, 422);
});

test('migration 017 converts marks to /20 and enforces 0-20 in the database', () => {
    const text = fs.readFileSync(path.join(__dirname, '../migrations/017_marks_out_of_20.sql'), 'utf8');
    assert.match(text, /SET score = ROUND\(score \* 20\.0 \/ max_score, 2\), max_score = 20/);
    assert.match(text, /CONSTRAINT CK_ss_score_out_of_20 CHECK \(max_score = 20 AND score >= 0 AND score <= 20\)/);
    assert.match(text, /DEFAULT 20 FOR max_score/);
    assert.equal(/^\s*(DROP\s+TABLE|DELETE|TRUNCATE)\b/im.test(text), false, 'no rows or tables are removed');
    // Re-running is safe: the data conversion is skipped once the constraint exists.
    assert.equal((text.match(/NOT EXISTS \(SELECT 1 FROM sys\.check_constraints WHERE name = 'CK_ss_score_out_of_20'\)/g) || []).length, 3);
});

test('migration 016 only adds report card tables', () => {
    const text = fs.readFileSync(path.join(__dirname, '../migrations/016_report_cards.sql'), 'utf8');
    for (const table of ['report_card_settings', 'report_card_terms', 'report_card_groups', 'report_card_group_subjects', 'report_card_student_terms']) {
        assert.match(text, new RegExp(`IF OBJECT_ID\\('dbo\\.${table}', 'U'\\) IS NULL\\s+CREATE TABLE dbo\\.${table}`));
    }
    assert.equal(/^\s*(DROP|DELETE|TRUNCATE|ALTER\s+TABLE|UPDATE|INSERT)\b/im.test(text), false, 'no statements that change existing tables or data');
});
