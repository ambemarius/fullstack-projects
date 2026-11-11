const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app/app');
const { withDatabase } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { syntheticDatabase } = require('./helpers/database');
const { serve } = require('./helpers/http');

test('teacher can obtain minimal academic context without admin privileges', async t => {
    const db = syntheticDatabase(statement => ({ recordset: statement.includes('FROM teachers')
        ? [{ id: 1, status: 'active' }] : [{ id: 9, isCurrent: true }] }));
    const base = await serve(t, createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) }));
    const response = await fetch(`${base}/api/v1/academic-context`, { headers: { Authorization: `Bearer ${generateToken(1, 'teacher')}` } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.currentYear.id, 9);
    assert.equal((await fetch(`${base}/api/v1/academic-years`, { headers: { Authorization: `Bearer ${generateToken(1, 'teacher')}` } })).status, 401);
});

test('marks enrol the intended student when student and offering IDs differ', async t => {
    const db = syntheticDatabase((statement, params) => {
        if (statement.includes('FROM teachers')) return { recordset: [{ id: 1, status: 'active' }] };
        if (statement.includes('FROM class_subjects')) return { recordset: [{ id: 77, class_id: 3 }] };
        if (statement.includes('FROM class_subject_teachers')) return { recordset: [{ id: 1 }] };
        if (statement.includes('INSERT INTO class_subject_students')) {
            assert.equal(params.classSubjectId, 77);
            assert.equal(params.studentId, 42);
        }
        return { recordset: [], rowsAffected: [1] };
    });
    const base = await serve(t, createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(db, next) }));
    for (const [route, body] of [
        ['/api/v1/marks/save/77/First/1/9', { scores: [{ studentId: 42, score: 30, maxScore: 50 }] }],
        ['/api/v1/marks/save-all/77/First/9', { entries: [{ studentId: 42, seq1: 30, seq2: 35, maxScore: 50 }] }],
    ]) {
        const response = await fetch(`${base}${route}`, {
            method: 'POST', headers: { Authorization: `Bearer ${generateToken(1, 'teacher')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        assert.equal(response.status, 200);
    }
});
