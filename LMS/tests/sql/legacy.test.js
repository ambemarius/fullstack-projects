const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, sql } = require('../../config/database');
const { loadTestEnvironment, assertSyntheticDatabase } = require('../../scripts/testEnvironment');
const { teacherStatus, studentFacts } = require('../../migrations/legacyPolicy');

test('synthetic legacy SQL fixtures retain inactive flags and unknown demographics', async t => {
    loadTestEnvironment();
    const db = createDatabase();
    t.after(() => db.close());
    await assertSyntheticDatabase(db);
    const transaction = new sql.Transaction(db.getPool());
    await transaction.begin();
    try {
        const query = text => new sql.Request(transaction).query(text);
        await new sql.Request(transaction).batch(`
            CREATE TABLE #LegacyTeachers(id int PRIMARY KEY,isSuspended bit NULL,isWithdrawn bit NULL,status nvarchar(20) NULL);
            INSERT INTO #LegacyTeachers VALUES(1,1,0,NULL),(2,0,1,NULL),(3,0,0,NULL),(4,NULL,NULL,NULL);
            CREATE TABLE #LegacyStudents(id int PRIMARY KEY,name nvarchar(100),sex nvarchar(10) NULL,yearOfEnrollment int NULL);
            INSERT INTO #LegacyStudents VALUES(1,N'Synthetic Legacy Student',NULL,NULL),(2,N'Synthetic Legacy Student',NULL,NULL);
        `);
        const teachers = (await query('SELECT * FROM #LegacyTeachers ORDER BY id')).recordset;
        for (const row of teachers) {
            const resolution = teacherStatus(row);
            await new sql.Request(transaction).input('id', sql.Int, row.id)
                .input('status', sql.NVarChar(20), resolution.status)
                .query('UPDATE #LegacyTeachers SET status=@status WHERE id=@id');
        }
        const after = (await query('SELECT * FROM #LegacyTeachers ORDER BY id')).recordset;
        assert.deepEqual(after.map(row => row.status), ['suspended', 'withdrawn', 'active', null]);
        assert.equal(after[0].isSuspended, true);
        assert.equal(after[1].isWithdrawn, true);
        const students = (await query('SELECT * FROM #LegacyStudents ORDER BY id')).recordset;
        for (const row of students) {
            const facts = studentFacts(row);
            assert.equal(facts.sex, null);
            assert.equal(facts.yearOfEnrollment, null);
            assert.equal(facts.needsReview, true);
        }
    } finally {
        await transaction.rollback();
    }
});
