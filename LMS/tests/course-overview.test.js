const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const course = { classSubjectId: 131, classId: 4, section: 'Anglophone', className: 'Form2', stream: 'Bilingual', subjectId: 11, subject: 'Biology', code: 'BIO',
    coefficient: 3, classSize: 12, enrolled: 10, seq1Entered: 10, seq2Entered: 4, marksNotEnrolled: 2, teachers: 'Biology Teacher' };

test('course overview: administrator-only, validated, and not swallowed by the /:classSubjectId/:yearId route', async t => {
    const seen = [];
    const db = syntheticDatabase((statement, params) => {
        if (statement.includes('FROM Admins WHERE id')) return { recordset: [{ id: 1, role: 'admin', name: 'A', school_id: 1 }] };
        if (statement.includes('FROM teachers WHERE id')) return { recordset: [{ id: 3, status: 'active', name: 'T', school_id: 1 }] };
        if (statement.includes('WITH roster AS')) { seen.push(params); return { recordset: [course] }; }
        throw new Error('unexpected statement: ' + statement.slice(0, 80));
    });
    const base = await serve(t, createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) }));
    const get = (url, token) => fetch(base + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

    assert.equal((await get('/api/v1/class-subject-students/overview/5')).status, 401);
    assert.equal((await get('/api/v1/class-subject-students/overview/5', generateToken(3, 'teacher'))).status, 401);
    assert.equal((await get('/api/v1/class-subject-students/overview/5?term=Fourth', generateToken(1, 'admin'))).status, 422);
    assert.equal((await get('/api/v1/class-subject-students/overview/x', generateToken(1, 'admin'))).status, 422);

    const res = await get('/api/v1/class-subject-students/overview/5?term=Second', generateToken(1, 'admin'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual([body.data.yearId, body.data.term, body.data.courses.length], [5, 'Second', 1]);
    assert.deepEqual(seen.at(-1), { year: 5, term: 'Second' });
});

test('overview counts marks only for enrolled students and uses the same class roster as mark sheets', () => {
    const model = fs.readFileSync(path.join(__dirname, '../model/Academic/classSubjectStudent.js'), 'utf8');
    const overview = model.slice(model.indexOf('async overview('));
    assert.match(overview, /isWithdrawn = 0 AND \(academicYearId IS NULL OR academicYearId = @year\)/);
    assert.match(overview, /JOIN enrolled e ON e\.class_subject_id = ss\.class_subject_id AND e\.student_id = ss\.student_id/);
    assert.match(overview, /AS marksNotEnrolled/);
    // Course review lists students with no recorded year too (they could never be enrolled before).
    const unenrolled = model.slice(model.indexOf('async getUnenrolled('), model.indexOf('async isEnrolled('));
    assert.match(unenrolled, /\(s\.academicYearId IS NULL OR s\.academicYearId = @academicYearId\)/);
});

test('course review offers an all-courses view; report cards print a whole class or one student', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/admin-layout.ejs'), 'utf8');
    assert.match(html, /id="crViewAll" aria-selected="true"/);
    assert.match(html, /id="crOne" role="tabpanel" aria-labelledby="crViewOne" hidden/);
    assert.match(html, /<select id="rcStudent" disabled><option value="">Whole class \(all students\)<\/option><\/select>/);
    const js = fs.readFileSync(path.join(__dirname, '../public/js/admin-evaluation.js'), 'utf8');
    assert.match(js, /\/class-subject-students\/overview\//);
    assert.match(js, /if \(rcStudent && rcStudent\.value\) params\.studentId = rcStudent\.value;/);
    assert.match(js, /data\.data\.find\(s => s\.classSubjectId == subjectId\)/, 'course review matches class-subject ids');
});

test('personnel can be filtered by name, section, type and status', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/admin-layout.ejs'), 'utf8');
    for (const id of ['pfName', 'pfSection', 'pfType', 'pfStatus', 'pfReset', 'pfCount']) assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, /<option value="suspended">Suspended<\/option><option value="withdrawn">Withdrawn<\/option>/);
    const js = fs.readFileSync(path.join(__dirname, '../public/js/admin-registration.js'), 'utf8');
    assert.match(js, /\(!pf\.section\?\.value \|\| t\.section === pf\.section\.value\)/);
    assert.match(js, /\(!pf\.type\?\.value \|\| t\.employmentType === pf\.type\.value\)/);
    assert.match(js, /\(!pf\.status\?\.value \|\| t\.status === pf\.status\.value\)/);
    assert.match(js, /Showing \$\{list\.length\} of \$\{personnel\.length\} staff/);
});

test('personnel has three subtabs: staff management, duties and assignment, auxiliary staff sign-in', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/admin-layout.ejs'), 'utf8');
    const personnel = html.slice(html.indexOf('id="tab-personnel"'), html.indexOf('</section>', html.indexOf('id="tab-personnel"')));
    assert.deepEqual([...personnel.matchAll(/data-sub="([\w-]+)"[^>]*>([^<]+)</g)].map(m => [m[1], m[2]]),
        [['staff', 'Staff management'], ['duties', 'Duties and assignment'], ['aux-signin', 'Auxiliary staff sign-in']]);
    const panel = id => personnel.slice(personnel.indexOf(`id="sub-${id}"`));
    assert.match(panel('staff').slice(0, 4000), /id="personnelRows"/);
    assert.match(panel('duties').slice(0, 3000), /id="dutyForm"[\s\S]*id="dutyRows"/);
    assert.match(panel('aux-signin'), /id="auxPasswordForm"/);
    const layout = fs.readFileSync(path.join(__dirname, '../public/js/admin-layout.js'), 'utf8');
    assert.match(layout, /personnel: \{ key: 'personnelSubTab', buttons: \[\.\.\.document\.querySelectorAll\('#tab-personnel \.reg-subtab'\)\] \}/);
});
