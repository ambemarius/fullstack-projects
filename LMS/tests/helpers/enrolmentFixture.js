const crypto = require('node:crypto');
const { sql } = require('../../config/database');
async function seedEnrolmentFixture(db) {
    const tx = new sql.Transaction(db.getPool()); await tx.begin();
    try {
        const ids = (await new sql.Request(tx).input('prefix', sql.NVarChar(40), 'LEDGER_' + crypto.randomBytes(6).toString('hex').toUpperCase()).query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'A','Ledger A','Anglophone','active');DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'B','Ledger B','Anglophone','active');DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'A','unusable-fixture-hash','active');DECLARE @aa INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'B','unusable-fixture-hash','active');DECLARE @ab INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'T','unusable-fixture-hash','active');DECLARE @at INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@aa,'active');DECLARE @ma INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@ab,'active');DECLARE @mb INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@at,'active');DECLARE @mt INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@b,@mb,'admin'),(@a,@mt,'teacher');
            INSERT dbo.academic_years(name,fromYear,toYear,school_id,created_by_account_id) VALUES('2024/2025',2024,2025,@a,@aa);DECLARE @ya INT=SCOPE_IDENTITY();
            INSERT dbo.academic_years(name,fromYear,toYear,school_id,created_by_account_id) VALUES('2025/2026',2025,2026,@a,@aa);DECLARE @yn INT=SCOPE_IDENTITY();
            INSERT dbo.academic_years(name,fromYear,toYear,school_id,created_by_account_id) VALUES('2024/2025',2024,2025,@b,@ab);DECLARE @yb INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone','Form1',1,@a);DECLARE @ca INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone','Form2',2,@a);DECLARE @cn INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone','Form1',1,@b);DECLARE @cb INT=SCOPE_IDENTITY();
            INSERT dbo.students(firstName,lastName,matricule,password,section,sex,school_id,currentClassLevel,academicYearId)
                VALUES('Synthetic','A','SAME','unusable-fixture-hash','Anglophone','Male',@a,@ca,@ya);DECLARE @pa INT=SCOPE_IDENTITY();
            INSERT dbo.students(firstName,lastName,matricule,password,section,sex,school_id,currentClassLevel,academicYearId)
                VALUES('Synthetic','B','SAME','unusable-fixture-hash','Anglophone','Male',@b,@cb,@yb);DECLARE @pb INT=SCOPE_IDENTITY();
            SELECT @a a,@b b,@aa aa,@ab ab,@at at,@ma ma,@mb mb,@mt mt,@ya ya,@yn yn,@yb yb,@ca ca,@cn cn,@cb cb,@pa pa,@pb pb;`)).recordset[0];
        await tx.commit(); return ids;
    } catch (e) { await tx.rollback(); throw e; }
}
async function removeEnrolmentFixture(db, ids) {
    await db.getPool().request().input('a', sql.Int, ids.a).input('b', sql.Int, ids.b)
        .input('aa', sql.Int, ids.aa).input('ab', sql.Int, ids.ab).input('at', sql.Int, ids.at).query(`
        DECLARE @accounts TABLE(id INT PRIMARY KEY);
        INSERT @accounts SELECT account_id FROM dbo.school_memberships WHERE school_id IN(@a,@b) GROUP BY account_id;
        IF EXISTS(SELECT 1 FROM dbo.school_memberships WHERE account_id IN(SELECT id FROM @accounts) AND school_id NOT IN(@a,@b))
            THROW 50116,'Unexpected shared fixture account',1;
        DELETE dbo.identity_audit_events WHERE school_id IN(@a,@b);
        DELETE dbo.student_fees WHERE school_id IN(@a,@b);
        DELETE dbo.academic_year_students WHERE school_id IN(@a,@b);
        DELETE dbo.academic_year_teachers WHERE school_id IN(@a,@b);
        DELETE dbo.subject_scores WHERE school_id IN(@a,@b);
        DELETE dbo.class_subject_students WHERE school_id IN(@a,@b);
        DELETE dbo.class_subject_teachers WHERE school_id IN(@a,@b);
        DELETE dbo.class_subjects WHERE school_id IN(@a,@b);
        DELETE dbo.subjects WHERE school_id IN(@a,@b);
        DELETE dbo.legacy_account_map WHERE school_id IN(@a,@b);
        DELETE dbo.students WHERE school_id IN(@a,@b);
        DELETE dbo.classes WHERE school_id IN(@a,@b);
        DELETE dbo.teachers WHERE school_id IN(@a,@b);
        DELETE dbo.academic_years WHERE school_id IN(@a,@b);
        DELETE dbo.account_sessions WHERE account_id IN(SELECT id FROM @accounts);
        DELETE dbo.membership_roles WHERE school_id IN(@a,@b);
        DELETE dbo.school_memberships WHERE school_id IN(@a,@b);
        DELETE dbo.accounts WHERE id IN(SELECT id FROM @accounts);
        DELETE dbo.schools WHERE id IN(@a,@b);`);
}
module.exports = { seedEnrolmentFixture, removeEnrolmentFixture };
