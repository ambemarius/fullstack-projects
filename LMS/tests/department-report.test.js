// Head of Department report: figures, girls/boys results, enrolment, and who may see which department.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDepartmentReport, figures, sexSplit, grade } = require('../model/Academic/departmentReport');

test('figures: average, highest, lowest, passed at 10/20, pass rate and grade spread', () => {
    const f = figures([16, 12, 9, 10, 4]);
    assert.equal(f.assessed, 5);
    assert.equal(f.average, 10.2);
    assert.equal(f.highest, 16);
    assert.equal(f.lowest, 4);
    assert.equal(f.passed, 3);
    assert.equal(f.failed, 2);
    assert.equal(f.passRate, 60);
    assert.deepEqual(f.grades, { A: 1, B: 0, C: 1, D: 1, F: 2 });
    assert.equal(figures([]).average, null);
    assert.equal(grade(15.99), 'B');
});

test('results split: sat, passed and % passed for all students, girls and boys', () => {
    const r = sexSplit([
        { mark: 12, sex: 'Female' }, { mark: 8, sex: 'Female' }, { mark: 15, sex: 'Female' },
        { mark: 10, sex: 'Male' }, { mark: 9.5, sex: 'Male' },
    ]);
    assert.deepEqual(r, {
        sat: 5, passed: 3, passRate: 60,
        girls: { sat: 3, passed: 2, passRate: 66.7 },
        boys: { sat: 2, passed: 1, passRate: 50 },
    });
    assert.deepEqual(sexSplit([]).girls, { sat: 0, passed: 0, passRate: null });
});

// A fake database: answers each query of the report by what it selects.
function fakeRequest(log) {
    return async () => {
        const inputs = {};
        return {
            input(name, _type, value) { inputs[name] = value; return this; },
            async query(text) {
                log.push({ text, inputs: { ...inputs } });
                if (text.includes('FROM dbo.academic_years')) return { recordset: [{ id: 5, name: '2026/2027' }] };
                if (text.includes('FROM dbo.class_subjects cs JOIN dbo.classes')) return { recordset: [
                    { csId: 1, classId: 10, section: 'Anglophone', label: 'Anglophone — Form1' },
                    { csId: 2, classId: 11, section: 'Anglophone', label: 'Anglophone — Form2' },
                ] };
                if (text.includes('FROM dbo.class_subject_teachers')) return { recordset: [{ csId: 1, name: 'Mrs Bio' }, { csId: 2, name: 'Mrs Bio' }] };
                if (text.includes('FROM dbo.students WHERE isWithdrawn')) return { recordset: [{ classId: 10, n: 3, girls: 2, boys: 1 }, { classId: 11, n: 2, girls: 0, boys: 2 }] };
                if (text.includes('FROM dbo.subject_scores')) return { recordset: [
                    // Form1: Ada 12 & 14 (13), Bea 8 & 6 (7), Cy 10 & 11 (10.5); Form2: Dan 16 only
                    { csId: 1, studentId: 1, student: 'Ada', sex: 'Female', term: 'First', sequence: 1, score: 12, maxScore: 20 },
                    { csId: 1, studentId: 1, student: 'Ada', sex: 'Female', term: 'First', sequence: 2, score: 14, maxScore: 20 },
                    { csId: 1, studentId: 2, student: 'Bea', sex: 'Female', term: 'First', sequence: 1, score: 8, maxScore: 20 },
                    { csId: 1, studentId: 2, student: 'Bea', sex: 'Female', term: 'First', sequence: 2, score: 6, maxScore: 20 },
                    { csId: 1, studentId: 3, student: 'Cy', sex: 'Male', term: 'First', sequence: 1, score: 10, maxScore: 20 },
                    { csId: 1, studentId: 3, student: 'Cy', sex: 'Male', term: 'First', sequence: 2, score: 11, maxScore: 20 },
                    { csId: 2, studentId: 4, student: 'Dan', sex: 'Male', term: 'First', sequence: 1, score: 16, maxScore: 20 },
                ] };
                throw new Error('unexpected query ' + text.slice(0, 60));
            },
        };
    };
}

test('a head of department sees only their own subject and section, per class and for the department', async () => {
    const log = [];
    const staffDuty = { department: async () => ({ subjectId: 11, subjectName: 'Biology', section: 'Anglophone' }) };
    const service = createDepartmentReport({ request: fakeRequest(log), staffDuty });
    const teacher = { type: 'teacher', id: 3 };
    // Asking for another subject is ignored: the department comes from the duty.
    const r = await service.report(teacher, { subjectId: 99, section: 'Francophone', term: 'First' });
    assert.deepEqual(r.department, { subjectId: 11, subjectName: 'Biology', section: 'Anglophone' });
    const classQuery = log.find(q => q.text.includes('FROM dbo.class_subjects cs JOIN dbo.classes'));
    assert.equal(classQuery.inputs.s, 11);
    assert.equal(classQuery.inputs.sec, 'Anglophone');
    assert.deepEqual(r.sequences, [1, 2]);

    const [f1, f2] = r.classes;
    assert.deepEqual(f1.enrolment, { total: 3, boys: 1, girls: 2, boysPercent: 33.3, girlsPercent: 66.7 });
    assert.deepEqual(f1.results, { sat: 3, passed: 2, passRate: 66.7, girls: { sat: 2, passed: 1, passRate: 50 }, boys: { sat: 1, passed: 1, passRate: 100 } });
    assert.equal(f1.marksEntered, 6);
    assert.equal(f1.marksExpected, 6);
    assert.deepEqual(f1.sequenceAverages, { 1: 10, 2: 10.33 });
    assert.equal(f2.marksEntered, 1);
    assert.equal(f2.marksExpected, 4, '2 students x 2 sequences');

    assert.deepEqual(r.totals.enrolment, { total: 5, boys: 3, girls: 2, boysPercent: 60, girlsPercent: 40 });
    assert.deepEqual(r.totals.results, { sat: 4, passed: 3, passRate: 75, girls: { sat: 2, passed: 1, passRate: 50 }, boys: { sat: 2, passed: 2, passRate: 100 } });
    assert.equal(r.totals.completion, 70, '7 of 10 marks entered');
    assert.equal(r.teachers.length, 1);
    assert.equal(r.teachers[0].results.sat, 4);
    assert.deepEqual(r.top.map(x => x.name), ['Dan', 'Ada', 'Cy', 'Bea']);
});

test('a teacher without a department is refused; an administrator chooses any subject', async () => {
    const service = createDepartmentReport({ request: fakeRequest([]), staffDuty: { department: async () => null } });
    await assert.rejects(service.report({ type: 'teacher', id: 9 }, { term: 'First' }), { statusCode: 403 });
    await assert.rejects(service.report({ type: 'admin', id: 1 }, {}), { statusCode: 422 });
    await assert.rejects(service.report({ type: 'teacher', id: 9 }, { term: 'Fourth' }), { statusCode: 403 });
});

test('migration 019 adds the department table and allows the new duty name, nothing else', () => {
    const text = fs.readFileSync(path.join(__dirname, '../migrations/019_department_heads.sql'), 'utf8');
    assert.match(text, /CREATE TABLE dbo\.staff_duty_departments/);
    assert.match(text, /REFERENCES dbo\.staff_duties\(id\) ON DELETE CASCADE/);
    assert.match(text, /'discipline_master', 'head_of_department'/);
    assert.equal(/^\s*(DROP\s+TABLE|DELETE|TRUNCATE|UPDATE|INSERT)\b/im.test(text), false);
});

test('teacher portal: the Department tab is hidden until the duty is found, and the report can be printed and downloaded', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/teacher-dashboard.ejs'), 'utf8');
    assert.match(html, /href="#department" data-tab="department" id="tw-tab-department" hidden/);
    assert.match(html, /id="tw-department" aria-labelledby="tpTitle" hidden>[\s\S]*id="hodForm"[\s\S]*id="hodReport"[\s\S]*id="hodRemarks"/);
    assert.match(html, /<script src="\/js\/teacher-department\.js"><\/script>/);
    const js = fs.readFileSync(path.join(__dirname, '../public/js/teacher-department.js'), 'utf8');
    assert.match(js, /d\.duty === 'head_of_department'/);
    assert.match(js, /DepartmentView\.body\(d\)/, 'the HOD tab and the admin page share one report display');
    const view = fs.readFileSync(path.join(__dirname, '../public/js/department-view.js'), 'utf8');
    assert.match(view, /'% Girls passed'/);
    assert.match(view, /'% Boys'/);
    assert.match(view, /text\/csv/);
    assert.ok(html.indexOf('/js/department-view.js') < html.indexOf('/js/teacher-department.js'));
});

test('whole-school subject report: administrators only, one line per subject, girls and boys added up', async () => {
    const log = [];
    const base = fakeRequest(log);
    // Two subjects; each subject report reuses the same fake classes and marks.
    const request = async () => {
        const r = await base();
        const query = r.query.bind(r);
        r.query = async text => {
            if (text.includes('FROM dbo.subjects s') && text.includes('EXISTS')) return { recordset: [{ id: 11, name: 'Biology', code: 'BIO' }, { id: 8, name: 'Mathematics', code: 'MATH' }] };
            if (text.includes('SELECT name FROM dbo.subjects')) return { recordset: [{ name: 'Subject' }] };
            if (text.includes('FROM dbo.students p JOIN dbo.classes')) return { recordset: [{ total: 5, boys: 3, girls: 2 }] };
            return query(text);
        };
        return r;
    };
    const service = createDepartmentReport({ request, staffDuty: { department: async () => null } });
    await assert.rejects(service.schoolReport({ type: 'teacher', id: 3, duties: ['head_of_department'] }, {}), { statusCode: 403 });
    const r = await service.schoolReport({ type: 'admin', id: 1 }, { term: 'First' });
    assert.equal(r.subjects.length, 2);
    assert.deepEqual(r.subjects.map(s => s.subjectName), ['Biology', 'Mathematics']);
    assert.deepEqual(r.subjects[0].results.girls, { sat: 2, passed: 1, passRate: 50 });
    assert.deepEqual(r.enrolment, { total: 5, boys: 3, girls: 2, boysPercent: 60, girlsPercent: 40 });
    assert.deepEqual(r.totals.results, { sat: 8, passed: 6, passRate: 75, girls: { sat: 4, passed: 2, passRate: 50 }, boys: { sat: 4, passed: 4, passRate: 100 } });
});

test('admin page: Evaluation has a Subject results sub-tab using the shared report display', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/admin-layout.ejs'), 'utf8');
    assert.match(html, /data-sub="subject-results" aria-controls="sub-subject-results"/);
    assert.match(html, /id="sub-subject-results"[\s\S]*id="srForm"[\s\S]*id="srSection"[\s\S]*id="srReport"[\s\S]*id="srDetail"/);
    assert.ok(html.indexOf('/js/department-view.js') < html.indexOf('/js/admin-subject-results.js'));
    const js = fs.readFileSync(path.join(__dirname, '../public/js/admin-subject-results.js'), 'utf8');
    assert.match(js, /\/department\/school-report\?/);
    assert.match(js, /DepartmentView\.body\(subjectReport\)/);
});

test('department report sections are sub-tabs: one open at a time on screen, all of them when printed', () => {
    const view = fs.readFileSync(path.join(__dirname, '../public/js/department-view.js'), 'utf8');
    const tabs = [...view.matchAll(/\['(\w+)', '([^']+)'\]/g)].map(m => m[2]);
    assert.deepEqual(tabs.slice(0, 6), ['Class enrolment', 'Results by class', 'Marks by class', 'Grade spread', 'Best students', 'By teacher']);
    for (const key of ['enrolment', 'results', 'marks', 'grades', 'best', 'teachers']) assert.match(view, new RegExp(`data-dv-panel="${key}" role="tabpanel"`));
    assert.match(view, /role="tablist"/);
    assert.match(view, /localStorage\.setItem\('deptTab'/, 'the open tab is remembered');
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    assert.match(css, /\.dv \.dv-panel \{ display: none; \}/);
    assert.match(css, /@media print \{ \.dv-tabs \{ display: none !important; \} \.dv \.dv-panel \{ display: block !important; \} \}/);
});
