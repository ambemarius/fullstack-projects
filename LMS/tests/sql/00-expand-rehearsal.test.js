const { test }=require('node:test');
const assert=require('node:assert/strict');
const { createDatabase,sql }=require('../../config/database');
const { loadTestEnvironment,assertSyntheticDatabase }=require('../../scripts/testEnvironment');
const { migrationFiles }=require('../../scripts/migrate');

test('pending expand migrations rehearse with rollback before the SQL suite applies them',async t=>{
    loadTestEnvironment();
    const db=createDatabase(); t.after(()=>db.close());
    await assertSyntheticDatabase(db);
    const before=await db.getPool().request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version');
    const files=migrationFiles().filter(file=>!before.recordset.some(row=>row.version===file.name));
    const tx=new sql.Transaction(db.getPool()); await tx.begin();
    try {
        for(const file of files) await new sql.Request(tx).query(file.text);
        const bad=await new sql.Request(tx).query('SELECT name FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1');
        assert.deepEqual(bad.recordset,[]);
    } finally { await tx.rollback(); }
    const after=await db.getPool().request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version');
    assert.deepEqual(after.recordset,before.recordset);
    if(files.some(f=>f.name==='003_school_ownership_expand.sql')) {
        const columns=await db.getPool().request().query("SELECT COL_LENGTH(N'dbo.students',N'school_id') AS length");
        assert.equal(columns.recordset[0].length,null);
    }
    t.diagnostic(files.length ? `Rolled back ${files.map(f=>f.name).join(', ')}` : 'No pending migrations');
});
