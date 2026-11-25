// First sign-in: a teacher whose password the administration set must choose their own before anything else.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { createApp } = require('../app/app');
const generateToken = require('../utils/generateToken');
const { serve } = require('./helpers/http');

async function appWith(t, { mustChange }) {
    const Teacher = require('../model/staff/teacher');
    const hash = await bcrypt.hash('Given-pass1', 4);
    const state = { mustChange, changedTo: null };
    t.mock.method(Teacher, 'findById', async id => ({ id, name: 'Ada', status: 'active', school_id: 1 }));
    t.mock.method(Teacher, 'findAllForLogin', async () => [{ id: 4, email: 'ada@example.invalid', status: 'active', school_id: 1, password: hash }]);
    t.mock.method(Teacher, 'passwordHash', async () => hash);
    t.mock.method(Teacher, 'teachesPracticals', async () => false);
    t.mock.method(Teacher, 'changeOwnPassword', async (id, plain) => { state.changedTo = plain; state.mustChange = false; });
    const app = createApp({ logging: false });
    app.locals.mustChangePassword = async () => state.mustChange;
    return { base: await serve(t, app), state };
}
const json = (method, body, token) => ({ method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body && JSON.stringify(body) });

test('sign-in tells the page a new password is needed; other teacher screens are refused until it is changed', async t => {
    const { base, state } = await appWith(t, { mustChange: true });
    const login = await (await fetch(base + '/api/v1/teachers/login', json('POST', { email: 'ada@example.invalid', password: 'Given-pass1' }))).json();
    assert.equal(login.mustChangePassword, true);
    const token = generateToken(4, 'teacher', undefined, 1);
    const blocked = await fetch(base + '/api/v1/teachers/my-subjects', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, 'PASSWORD_CHANGE_REQUIRED');
    assert.equal((await fetch(base + '/api/v1/teachers/profile', { headers: { Authorization: 'Bearer ' + token } })).status, 200, 'the page can still greet the teacher');

    assert.equal((await fetch(base + '/api/v1/teachers/change-password', json('POST', { current: 'wrong-pass1', next: 'My-own-pass9' }, token))).status, 422, 'wrong current password');
    assert.equal((await fetch(base + '/api/v1/teachers/change-password', json('POST', { current: 'Given-pass1', next: 'short' }, token))).status, 422, 'too weak');
    assert.equal((await fetch(base + '/api/v1/teachers/change-password', json('POST', { current: 'Given-pass1', next: 'Given-pass1' }, token))).status, 422, 'must differ');
    const ok = await fetch(base + '/api/v1/teachers/change-password', json('POST', { current: 'Given-pass1', next: 'My-own-pass9' }, token));
    assert.equal(ok.status, 200);
    assert.equal(state.changedTo, 'My-own-pass9');
    assert.notEqual((await fetch(base + '/api/v1/teachers/my-subjects', { headers: { Authorization: 'Bearer ' + token } })).status, 403, 'unlocked after the change');
});

test('a teacher who already chose their password signs in normally', async t => {
    const { base } = await appWith(t, { mustChange: false });
    const login = await (await fetch(base + '/api/v1/teachers/login', json('POST', { email: 'ada@example.invalid', password: 'Given-pass1' }))).json();
    assert.equal(login.mustChangePassword, false);
});

test('registration and recovery require the change; the page and redirects are in place', () => {
    const ctrl = fs.readFileSync(path.join(__dirname, '../controllers/staff/teacherCtrl.js'), 'utf8');
    assert.match(ctrl, /await Teacher\.requirePasswordChange\(teacher\.id\);/);
    const recovery = fs.readFileSync(path.join(__dirname, '../scripts/recoverTeacherPassword.js'), 'utf8');
    assert.match(recovery, /SET must_change_password = 1/);
    const auth = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
    assert.match(auth, /if \(role === 'teacher' && data\.mustChangePassword\) \{ window\.location\.href = '\/change-password'/);
    const app = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
    assert.match(app, /data\.code === 'PASSWORD_CHANGE_REQUIRED'/);
    const view = fs.readFileSync(path.join(__dirname, '../views/change-password.ejs'), 'utf8');
    assert.equal((view.match(/data-reveal/g) || []).length, 3, 'each password box has the eye');
    const sqlText = fs.readFileSync(path.join(__dirname, '../migrations/026_teacher_first_password.sql'), 'utf8');
    assert.match(sqlText, /ADD must_change_password BIT NOT NULL CONSTRAINT DF_teachers_must_change_password DEFAULT 0/);
});
