const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, sql } = require('../../config/database');
const { loadTestEnvironment, assertSyntheticDatabase } = require('../../scripts/testEnvironment');
const { migrationFiles } = require('../../scripts/migrate');

test('identity expand migration rehearses transactionally without changing legacy data', async t => {
    loadTestEnvironment();
    const db = createDatabase();
    t.after(() => db.close());
    await assertSyntheticDatabase(db);
    const existing = await db.getPool().request().query("SELECT OBJECT_ID(N'dbo.schools') AS id");
    if (existing.recordset[0].id) return; // Already applied: constraint test below remains mandatory.
    const tx = new sql.Transaction(db.getPool());
    await tx.begin();
    try {
        await new sql.Request(tx).query(migrationFiles().find(f => f.name === '002_identity_foundation.sql').text);
        const result = await new sql.Request(tx).query("SELECT COUNT(*) AS count FROM dbo.schools");
        assert.equal(result.recordset[0].count, 0);
    } finally { await tx.rollback(); }
    const after = await db.getPool().request().query("SELECT OBJECT_ID(N'dbo.schools') AS id");
    assert.equal(after.recordset[0].id, null);
});

test('canonical identity constraints reject mixed schools, mismatched accounts and implicit platform roles', async t => {
    loadTestEnvironment();
    const db = createDatabase();
    t.after(() => db.close());
    await assertSyntheticDatabase(db);
    // Apply only through the reviewed ledger; repeated execution is checked by schema.test.js.
    await require('../../scripts/migrate').migrate(db);
    const tx = new sql.Transaction(db.getPool());
    await tx.begin();
    const query = text => new sql.Request(tx).query(text);
    try {
        const data = await query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES(N'IDENTITY_A',N'Synthetic A','Anglophone','active');
            DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES(N'IDENTITY_B',N'Synthetic B','Francophone','active');
            DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(N'synthetic:identity:one',N'unusable-test-hash','active');
            DECLARE @one INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(N'synthetic:identity:two',N'unusable-test-hash','active');
            DECLARE @two INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@one,'active');
            DECLARE @ma INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@one,'active');
            DECLARE @mb INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@a,@ma,'teacher'),(@b,@mb,'librarian');
            SELECT @a AS a,@b AS b,@one AS one,@two AS two,@ma AS ma,@mb AS mb;
        `);
        const { a,b,one,two,ma,mb } = data.recordset[0];
        await assert.rejects(query(`INSERT dbo.membership_roles VALUES(${b},${ma},'teacher')`));
        await assert.rejects(query(`INSERT dbo.membership_roles VALUES(${a},${ma},'platform_operator')`));
        await assert.rejects(query(`INSERT dbo.school_memberships(school_id,account_id) VALUES(${a},${one})`));
        await assert.rejects(query(`INSERT dbo.account_sessions(token_hash,account_id,active_membership_id,csrf_hash,security_version,expires_at)
            VALUES(REPLICATE('a',64),${two},${ma},REPLICATE('b',64),1,DATEADD(hour,1,SYSUTCDATETIME()))`));
        await assert.rejects(query(`INSERT dbo.legacy_account_map VALUES('teachers',1,${one},${a},${mb},'verified',SYSUTCDATETIME())`));
        await query(`INSERT dbo.legacy_account_map VALUES('Admins',1,${one},${a},${ma},'verified',SYSUTCDATETIME());
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(${a},${two},'active');
            DECLARE @mt INT=SCOPE_IDENTITY();
            INSERT dbo.legacy_account_map VALUES('teachers',1,${two},${a},@mt,'verified',SYSUTCDATETIME());`);
        const grants = await query('SELECT COUNT(*) AS count FROM dbo.platform_role_grants');
        assert.equal(grants.recordset[0].count,0);
        await assert.rejects(query(`INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id)
            VALUES(${b},${one},${ma},'test','school','synthetic','synthetic')`));
    } finally { await tx.rollback(); }
    const remaining = await db.getPool().request().query("SELECT COUNT(*) AS count FROM dbo.schools WHERE code IN (N'IDENTITY_A',N'IDENTITY_B')");
    assert.equal(remaining.recordset[0].count,0);
});
