const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTestEnvironment, assertSyntheticDatabase } = require('../../scripts/testEnvironment');
const { createDatabase, sql } = require('../../config/database');
const { migrate } = require('../../scripts/migrate');
const { withDatabase } = require('../../config/database');
const { createApp } = require('../../app/app');
const { serve } = require('../helpers/http');
const generateToken = require('../../utils/generateToken');
const verifyToken = require('../../utils/verifyToken');

test('approved synthetic SQL baseline applies twice with trusted constraints', async t => {
    loadTestEnvironment();
    const database = createDatabase();
    t.after(() => database.close());
    await database.connect();
    const pool = database.getPool();
    // Confirm the server-side marker before allowing any migration write.
    await assertSyntheticDatabase(database);
    await migrate(database);
    assert.deepEqual(await migrate(database), []);
    const tables = await pool.request().query('SELECT name FROM sys.tables WHERE is_ms_shipped=0');
    assert.equal(tables.recordset.length, 36);
    assert.ok(tables.recordset.some(row=>row.name==='staff_profile_links'));
    const constraints = await pool.request().query(`
        SELECT name FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1;
    `);
    assert.deepEqual(constraints.recordset, []);
    const probe = new sql.Transaction(pool);
    await probe.begin();
    try {
        await assert.rejects(new sql.Request(probe).query(`
            INSERT INTO timetables(class_id,subject_id,teacher_id,day_of_week,time_slot_id,start_time,end_time,academic_term,academic_year_id,created_by)
            VALUES(-1,-1,-1,N'Monday',-1,N'07:30',N'08:30',N'First',-1,-1);
        `));
    } finally {
        await probe.rollback().catch(() => {});
    }
});

test('real SQL account/login/student-list contracts work and synthetic rows roll back', async t => {
    loadTestEnvironment();
    const database = createDatabase();
    t.after(() => database.close());
    await assertSyntheticDatabase(database);
    const transaction = new sql.Transaction(database.getPool());
    await transaction.begin();
    const adapter = {
        connect: async () => transaction,
        getPool: () => ({ request: () => new sql.Request(transaction) }),
    };
    const marker = require('node:crypto').randomUUID();
    const syntheticPassword = require('node:crypto').randomBytes(24).toString('hex');
    try {
        const admin = await withDatabase(adapter, () => require('../../model/staff/admin').create({
            name: 'Synthetic SQL administrator', email: `${marker}@example.invalid`,
            password: syntheticPassword, role: 'admin',
        }));
        const teacher = await withDatabase(adapter, () => require('../../model/staff/teacher').create({
            firstName: 'Synthetic', lastName: 'Teacher', email: `teacher-${marker}@example.invalid`,
            password: syntheticPassword, employmentType: 'Part-time', section: 'Anglophone', status: 'active',
        }));
        assert.ok(teacher.id > 0);
        const student = await withDatabase(adapter, () => require('../../model/Academic/student').create({
            firstName: 'Synthetic', lastName: 'Student', matricule: marker,
            password: syntheticPassword, section: 'Anglophone', sex: 'Male',
        }));
        const base = await serve(t, createApp({ logging: false, requestContext: (_req, _res, next) => withDatabase(adapter, next) }));
        for (const [group, role, identity] of [
            ['admin', 'admin', { email: `${marker}@example.invalid` }],
            ['teachers', 'teacher', { email: `teacher-${marker}@example.invalid` }],
            ['students', 'student', { matricule: marker }],
        ]) {
            const response = await fetch(`${base}/api/v1/${group}/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...identity, password: syntheticPassword }),
            });
            assert.equal(response.status, 200);
            const payload = await response.json();
            assert.equal(Object.hasOwn(payload.data, 'password'), false);
            assert.equal(Boolean(verifyToken(payload.token, role)), true);
        }
        const list = await fetch(`${base}/api/v1/students`, {
            headers: { Authorization: `Bearer ${generateToken(admin.id, 'admin')}` },
        });
        assert.equal(list.status, 200);
        const payload = await list.json();
        assert.equal(payload.data.some(row => row.id === student.id), true);
        assert.equal(payload.data.some(row => Object.hasOwn(row, 'password')), false);
    } finally {
        await transaction.rollback();
    }
    const remaining = await database.getPool().request().input('email', sql.NVarChar(255), `${marker}@example.invalid`)
        .query('SELECT COUNT(*) AS count FROM Admins WHERE email=@email');
    assert.equal(remaining.recordset[0].count, 0);
});
