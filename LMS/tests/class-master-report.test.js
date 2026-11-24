// Class master's end-of-term report: built from the report cards, limited to the class master's own classes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClassMasterReport, passSplit } = require('../model/Academic/classMasterReport');

test('passSplit: sat, passed and % passed for all, girls and boys; students without an average have not sat', () => {
    assert.deepEqual(passSplit([
        { value: 12, sex: 'Female' }, { value: 8, sex: 'Female' }, { value: 10, sex: 'Male' }, { value: null, sex: 'Male' },
    ]), { sat: 3, passed: 2, passRate: 66.7, girls: { sat: 2, passed: 1, passRate: 50 }, boys: { sat: 1, passed: 1, passRate: 100 } });
});

// Report cards as reportCardService.classCards returns them (only the fields the class report reads).
const row = (name, avg, coef, classAvg, seq = [avg, avg]) => ({ name, avg, coef, class_avg: classAvg, teacher: 'T ' + name, fail: avg < 10, seq });
const card = (id, name, average, rank, rows, extra = {}) => ({
    student: { id: String(id), full_name: name, matricule: 'M' + id, is_repeater: false },
    seq_labels: ['Seq. 1', 'Seq. 2'],
    groups: [{ rows }],
    totals: { average, rank, subjects_passed: rows.filter(r => !r.fail).length, subjects_taken: rows.length },
    annual_average: null, status: average >= 10 ? 'PASSED' : 'FAILED', council_remark: 'Fair',
    discipline: { absences: extra.absences || 0 },
});
const CARDS = [
    card(1, 'Ada', 14, 1, [row('MATHEMATICS', 16, 5, 11), row('BIOLOGY', 12, 3, 9)], { absences: 2 }),
    card(2, 'Ben', 10.5, 2, [row('MATHEMATICS', 11, 5, 11), row('BIOLOGY', 10, 3, 9)]),
    card(3, 'Cleo', 6, 3, [row('MATHEMATICS', 6, 5, 11, [6, null]), row('BIOLOGY', 5, 3, 9)], { absences: 6 }),
];

function fakeRequest() {
    return async () => {
        const inputs = {};
        return {
            input(n, _t, v) { inputs[n] = v; return this; },
            async query(text) {
                if (text.includes('WHERE c.class_master_id = @t')) return { recordset: inputs.t === 5 ? [{ id: 40, label: 'Anglophone — Form1' }] : [] };
                if (text.includes('FROM dbo.classes c ORDER BY')) return { recordset: [{ id: 40, label: 'Anglophone — Form1' }, { id: 41, label: 'Anglophone — Form2' }] };
                if (text.includes('FROM dbo.academic_years')) return { recordset: [{ id: 5, name: '2026/2027', isCurrent: true }] };
                if (text.includes('LEFT JOIN dbo.teachers t ON t.id = c.class_master_id')) return { recordset: [{ section: 'Anglophone', classMaster: 'Mrs Master' }] };
                if (text.includes('SELECT id, sex FROM dbo.students')) return { recordset: [{ id: 1, sex: 'Female' }, { id: 2, sex: 'Male' }, { id: 3, sex: 'Female' }] };
                throw new Error('unexpected query ' + text.slice(0, 60));
            },
        };
    };
}

test('a class master sees only their own class; administrators see any class', async () => {
    const reportCards = { classCards: async () => ({ className: 'Form1', yearName: '2026/2027', cards: CARDS }) };
    const service = createClassMasterReport({ request: fakeRequest(), reportCards });
    assert.deepEqual((await service.options({ type: 'teacher', id: 5 })).classes.map(c => c.id), [40]);
    assert.deepEqual((await service.options({ type: 'teacher', id: 9 })).classes, [], 'not a class master: no classes, the tab stays hidden');
    await assert.rejects(service.report({ type: 'teacher', id: 5 }, { classId: 41, term: 'First' }), { statusCode: 403 });
    await assert.rejects(service.report({ type: 'teacher', id: 9 }, { classId: 40, term: 'First' }), { statusCode: 403 });
    await assert.rejects(service.report({ type: 'teacher', id: 5 }, { classId: 40, term: 'Fourth' }), { statusCode: 422 });
    assert.equal((await service.report({ type: 'admin', id: 1 }, { classId: 41, term: 'First' })).students.length, 3);
});

test('the class report adds up the report cards: results by sex, best and weakest subject, ranking, students to watch, attendance', async () => {
    let asked = null;
    const reportCards = { classCards: async options => { asked = options; return { className: 'Form1', yearName: '2026/2027', cards: CARDS }; } };
    const r = await createClassMasterReport({ request: fakeRequest(), reportCards }).report({ type: 'teacher', id: 5 }, { classId: 40, term: 'Second' });
    assert.deepEqual(asked, { classId: 40, yearId: 5, term: 'Second' });
    assert.equal(r.className, 'Anglophone — Form1');
    assert.equal(r.classMaster, 'Mrs Master');
    assert.deepEqual(r.enrolment, { total: 3, boys: 1, girls: 2, boysPercent: 33.3, girlsPercent: 66.7 });
    assert.deepEqual(r.results, { sat: 3, passed: 2, passRate: 66.7, girls: { sat: 2, passed: 1, passRate: 50 }, boys: { sat: 1, passed: 1, passRate: 100 } });
    assert.equal(r.classAverage, 10.17);
    assert.equal(r.highest, 14);
    assert.equal(r.lowest, 6);
    assert.equal(r.bestSubject.name, 'MATHEMATICS');
    assert.equal(r.worstSubject.name, 'BIOLOGY');
    const maths = r.subjects.find(s => s.name === 'MATHEMATICS');
    assert.deepEqual(maths.results.girls, { sat: 2, passed: 1, passRate: 50 });
    assert.equal(maths.marksEntered, 5, 'one Seq. 2 mark is missing');
    assert.equal(maths.marksExpected, 6);
    assert.deepEqual(maths.best, { name: 'Ada', mark: 16 });
    assert.deepEqual(r.students.map(s => s.rank), [1, 2, 3]);
    assert.deepEqual(r.atRisk.map(s => s.name), ['Cleo']);
    assert.deepEqual(r.atRisk[0].weakest, ['MATHEMATICS', 'BIOLOGY']);
    assert.deepEqual(r.attendance, { totalHours: 8, perStudent: 2.7, most: [{ name: 'Cleo', hours: 6 }, { name: 'Ada', hours: 2 }] });
    assert.deepEqual(r.bands.map(b => b.count), [0, 1, 0, 1, 1]);
});

test('teacher portal: My class appears only for a class master, with sub-tabs, print and CSV', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/teacher-dashboard.ejs'), 'utf8');
    assert.match(html, /href="#myclass" data-tab="myclass" id="tw-tab-myclass" hidden/);
    assert.match(html, /id="tw-myclass" aria-labelledby="tpTitle" hidden>[\s\S]*id="cmForm"[\s\S]*id="cmReport"[\s\S]*id="cmRemarks"/);
    assert.ok(html.indexOf('/js/department-view.js') < html.indexOf('/js/teacher-classmaster.js'));
    const js = fs.readFileSync(path.join(__dirname, '../public/js/teacher-classmaster.js'), 'utf8');
    assert.match(js, /\/class-master\/options/);
    assert.match(js, /if \(!res\.ok \|\| !res\.data\.data\.classes\.length\) return;/);
    for (const label of ['Overview', 'Subjects', 'Ranking', 'Students to watch', 'Attendance']) assert.ok(js.includes(`'${label}'`), label);
    assert.match(js, /Best subject/);
    assert.match(js, /Weakest subject/);
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    assert.match(css, /#tw-myclass \.cm-panel\[hidden\] \{ display: block !important; \}/, 'printing shows every section');
});
