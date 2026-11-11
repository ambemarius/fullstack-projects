const fs = require('node:fs');
const path = require('node:path');
const { sql } = require('../config/database');
const { assertSyntheticDatabase } = require('./testEnvironment');

async function install(db, rehearsal=false, {yearOfferings=false,yearArchive=false}={}) {
    await assertSyntheticDatabase(db);
    const tx = new sql.Transaction(db.getPool());
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const existing = (await new sql.Request(tx).query(`SELECT OBJECT_ID('dbo.student_enrolments') roots,
            OBJECT_ID('dbo.student_enrolment_revisions') revisions,OBJECT_ID('dbo.pupil_withdrawal_access') receipts,
            COL_LENGTH('dbo.school_memberships','pupil_access_stamp') stamp,
            OBJECT_ID('dbo.year_offering_revisions') coefficients,OBJECT_ID('dbo.teaching_assignment_events') assignments,
            OBJECT_ID('dbo.academic_year_archives') archives`)).recordset[0];
        if (Object.values(existing).some(value=>value!==null)) throw Error('Staged schema already exists');
        for (const file of ['010_enrolment_ledger.sql','011_pupil_withdrawal_access.sql',...(yearOfferings?['012_year_offering_history.sql']:[]),...(yearArchive?['013_academic_year_archive.sql']:[])]) {
            await new sql.Request(tx).query(fs.readFileSync(path.join(__dirname,'../docs/implementation/staged',file),'utf8'));
        }
        if (rehearsal) await tx.rollback();
        else await tx.commit();
    } catch (error) { await tx.rollback().catch(()=>{}); throw error; }
}
async function remove(db, ids, {yearOfferings=false,yearArchive=false}={}) {
    await assertSyntheticDatabase(db);
    const tx = new sql.Transaction(db.getPool());
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        if(yearArchive)await new sql.Request(tx).input('a',sql.Int,ids?.a??0).input('b',sql.Int,ids?.b??0).query(`
            IF EXISTS(SELECT 1 FROM dbo.academic_year_archives WHERE school_id NOT IN(@a,@b))
                THROW 50116,'Unexpected archived year; cleanup refused',1;
            DROP TRIGGER dbo.enrolment_archive_boundary;
            DROP TABLE dbo.academic_year_archives;
            DROP INDEX UX_year_archive_definition ON dbo.academic_years;`);
        if(yearOfferings)await new sql.Request(tx).input('a',sql.Int,ids?.a??0).input('b',sql.Int,ids?.b??0).query(`
            IF EXISTS(SELECT 1 FROM dbo.year_offering_revisions WHERE school_id NOT IN(@a,@b))
                OR EXISTS(SELECT 1 FROM dbo.teaching_assignment_events WHERE school_id NOT IN(@a,@b))
                THROW 50116,'Unexpected year history; cleanup refused',1;
            DROP TABLE dbo.teaching_assignment_events;DROP TABLE dbo.year_offering_revisions;`);
        await new sql.Request(tx).input('a',sql.Int,ids?.a??0).input('b',sql.Int,ids?.b??0).query(`
            IF EXISTS(SELECT 1 FROM dbo.student_enrolments WHERE school_id NOT IN(@a,@b))
                OR EXISTS(SELECT 1 FROM dbo.pupil_withdrawal_access WHERE school_id NOT IN(@a,@b))
                THROW 50116,'Unexpected staged data; cleanup refused',1;
            DROP TABLE dbo.pupil_withdrawal_access;
            ALTER TABLE dbo.school_memberships DROP COLUMN pupil_access_stamp;
            DROP TABLE dbo.student_enrolment_revisions;DROP TABLE dbo.student_enrolments;`);
        await tx.commit();
    } catch (error) { await tx.rollback().catch(()=>{}); throw error; }
}
module.exports = { install, remove };
