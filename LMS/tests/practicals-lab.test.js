// Laboratory requests only for teachers of a subject marked "Requires practicals".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const generateToken = require('../utils/generateToken');
const { createInventoryRouter } = require('../routes/inventory/inventoryRouter');
const { serve } = require('./helpers/http');

test('a teacher without a practical subject is refused laboratory requests; a science teacher is let in', async t => {
    const Teacher = require('../model/staff/teacher');
    const StaffDuty = require('../model/staff/staffDuty');
    t.mock.method(Teacher, 'findById', async id => ({ id, name: 'T' + id, status: 'active', school_id: 1 }));
    t.mock.method(StaffDuty, 'forStaff', async () => []);
    const asked = [];
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    app.use(createInventoryRouter({
        service: { listLab: async () => ({ requests: [{ id: 1, status: 'pending' }], today: '2026-11-24' }) },
        teachesPracticals: async id => (asked.push(id), id === 11),
    }));
    const base = await serve(t, app);
    const mine = id => fetch(base + '/lab-requests/mine', { headers: { Accept: 'application/json', Authorization: 'Bearer ' + generateToken(id, 'teacher', undefined, 1) } });
    const science = await mine(11);
    assert.equal(science.status, 200);
    assert.equal((await science.json()).data.requests.length, 1);
    const maths = await mine(12);
    assert.equal(maths.status, 403);
    assert.match(await maths.text(), /subjects with practicals/);
    assert.deepEqual(asked, [11, 12]);
});

test('the portal hides Laboratory until the profile says the teacher teaches practicals; subjects carry the checkbox', () => {
    const view = fs.readFileSync(path.join(__dirname, '../views/teacher-dashboard.ejs'), 'utf8');
    const js = fs.readFileSync(path.join(__dirname, '../public/js/teacher-dashboard.js'), 'utf8');
    assert.match(view, /<a class="tp-link" href="#lab" data-tab="lab" id="tw-tab-lab" hidden>/);
    assert.match(js, /teachesPracticals = Boolean\(data\.data\.teachesPracticals\)/);
    assert.match(js, /labReady = profileReady\.then\(\(\) => \(teachesPracticals \? loadLab\(\) : null\)\)/, 'no lab request call for other teachers');
    const ctrl = fs.readFileSync(path.join(__dirname, '../controllers/staff/teacherCtrl.js'), 'utf8');
    assert.match(ctrl, /teachesPracticals: await Teacher\.teachesPracticals\(req\.userAuth\.id\)/);
    const model = fs.readFileSync(path.join(__dirname, '../model/staff/teacher.js'), 'utf8');
    assert.match(model, /cst\.assignment_status = 'active' AND s\.has_lab = 1/);
    const admin = fs.readFileSync(path.join(__dirname, '../views/admin-layout.ejs'), 'utf8');
    assert.match(admin, /<input type="checkbox" id="subHasLab"> Requires practicals \(laboratory\)/);
});
