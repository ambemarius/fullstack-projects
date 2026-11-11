const { test }=require('node:test');
const assert=require('node:assert/strict');
const { createDatabase,sql }=require('../../config/database');
const { loadTestEnvironment,assertSyntheticDatabase }=require('../../scripts/testEnvironment');

test('legacy ownership expansion covers all school tables and rejects cross-school relationships',async t=>{
    loadTestEnvironment();
    const db=createDatabase(); t.after(()=>db.close());
    await assertSyntheticDatabase(db);
    await require('../../scripts/migrate').migrate(db);
    const metadata=await db.getPool().request().query(`
        SELECT t.name,c.is_nullable FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
        WHERE t.name IN ('Admins','teachers','classes','subjects','academic_years','students','student_fees','auxiliary_staff',
            'class_subjects','class_subject_teachers','class_subject_students','academic_year_students','academic_year_teachers',
            'exams','questions','exam_results','time_slots','subject_allocations','subject_scores','timetables') AND c.name='school_id';
        SELECT original.name FROM sys.foreign_keys original
        JOIN sys.tables child ON child.object_id=original.parent_object_id
        JOIN sys.tables parent ON parent.object_id=original.referenced_object_id
        WHERE EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=child.object_id AND c.name='school_id')
            AND EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=parent.object_id AND c.name='school_id')
            AND (SELECT COUNT(*) FROM sys.foreign_key_columns fkc WHERE fkc.constraint_object_id=original.object_id)=1
            AND parent.name<>'schools' AND original.name NOT LIKE 'TENANT[_]%'
            AND NOT EXISTS(SELECT 1 FROM sys.foreign_keys matched WHERE matched.name='TENANT_'+original.name);
    `);
    assert.equal(metadata.recordsets[0].length,20);
    assert.equal(metadata.recordsets[0].every(row=>row.is_nullable),true);
    assert.deepEqual(metadata.recordsets[1],[]);
    const tx=new sql.Transaction(db.getPool()); await tx.begin();
    const query=text=>new sql.Request(tx).query(text);
    try {
        const ids=(await query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES('OWN_A',N'Synthetic A','Anglophone','active');
            DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES('OWN_B',N'Synthetic B','Francophone','active');
            DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone','Ownership fixture',1,@a);
            DECLARE @class INT=SCOPE_IDENTITY();
            INSERT dbo.subjects(name,code,school_id) VALUES('Synthetic A','OWN_A',@a);
            DECLARE @subject INT=SCOPE_IDENTITY();
            INSERT dbo.subjects(name,code,school_id) VALUES('Synthetic B','OWN_B',@b);
            DECLARE @other INT=SCOPE_IDENTITY();
            SELECT @a AS a,@b AS b,@class AS class_id,@subject AS subject_id,@other AS other_id;
        `)).recordset[0];
        const { a,b,class_id:classId,subject_id:subject,other_id:other }=ids;
        await query(`INSERT dbo.class_subjects(class_id,subject_id,school_id) VALUES(${classId},${subject},${a})`);
        await assert.rejects(query(`INSERT dbo.class_subjects(class_id,subject_id,school_id) VALUES(${classId},${other},${a})`));
        await assert.rejects(query(`INSERT dbo.class_subjects(class_id,subject_id,school_id) VALUES(${classId},${other},${b})`));
        await assert.rejects(query(`UPDATE dbo.subjects SET school_id=${b} WHERE id=${subject}`));
        // NULL legacy ownership stays unresolved; it is not automatically inherited or guessed.
        const unresolved=await query('SELECT COUNT(*) AS count FROM dbo.classes WHERE school_id IS NULL');
        assert.ok(unresolved.recordset[0].count>=21);
    } finally { await tx.rollback(); }
});
