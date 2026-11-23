const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

const fixtureApp = db => createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) });
const admin = () => ({ method: 'DELETE', headers: { Authorization: `Bearer ${generateToken(1, 'admin')}` } });
const adminRow = { recordset: [{ id: 1, role: 'admin', password: 'synthetic-hash' }] };

test('deleting a pupil withdraws the record instead of cascading through marks and fees', async t => {
    const db = syntheticDatabase(statement => statement.includes('FROM Admins') ? adminRow : { recordset: [{ id: 5 }] });
    const base = await serve(t, fixtureApp(db));
    assert.equal((await fetch(`${base}/api/v1/students/5`, admin())).status, 200);
    assert.ok(db.calls.some(c => /UPDATE students SET isWithdrawn = 1/.test(c.statement) && Number(c.parameters.id) === 5));
    assert.equal(db.calls.some(c => /DELETE FROM students/i.test(c.statement)), false);
});

test('deleting a teacher withdraws the account so class, exam and timetable history survive', async t => {
    const db = syntheticDatabase(statement => statement.includes('FROM Admins') ? adminRow : { recordset: [{ id: 5, status: 'active' }] });
    const base = await serve(t, fixtureApp(db));
    assert.equal((await fetch(`${base}/api/v1/teachers/5`, admin())).status, 200);
    const update = db.calls.find(c => /UPDATE teachers SET status = @status/.test(c.statement));
    assert.deepEqual([Number(update.parameters.id), update.parameters.status], [5, 'withdrawn']);
    assert.equal(db.calls.some(c => /DELETE FROM teachers/i.test(c.statement)), false);
});

test('a subject with recorded use cannot be deleted; an unused one can', async t => {
    let scores = 3;
    const db = syntheticDatabase(statement => {
        if (statement.includes('FROM Admins')) return adminRow;
        if (statement.includes('AS offerings')) return { recordset: [{ offerings: 0, scores, exams: 0, periods: 0 }] };
        if (statement.includes('DELETE FROM subjects')) return { recordset: [] };
        return { recordset: [{ id: 3, name: 'Synthetic subject' }] };
    });
    const base = await serve(t, fixtureApp(db));
    const refused = await fetch(`${base}/api/v1/subjects/3`, admin());
    assert.equal(refused.status, 409);
    assert.equal(db.calls.some(c => /DELETE FROM subjects/.test(c.statement)), false);
    scores = 0;
    assert.equal((await fetch(`${base}/api/v1/subjects/3`, admin())).status, 200);
    assert.ok(db.calls.some(c => /DELETE FROM subjects/.test(c.statement)));
});
