// Read-only pre-migration inventory. Only aggregate LYCEE BATOURI results leave SQL.
const path = require('node:path');
const { migrationFiles } = require('./migrate');
const { createDatabase, sql } = require('../config/database');
const { loadEnvironment } = require('../config/environment');

const stagedNames = ['010_enrolment_ledger.sql', '011_pupil_withdrawal_access.sql',
    '012_year_offering_history.sql', '013_academic_year_archive.sql'];
const sameNames = (left, right) => left.length === right.length && left.every((name, i) => name === right[i]);
async function inventory(database) {
    await database.connect();
    const query = sql => database.getPool().request().query(sql);
    const target = (await query("SELECT DB_NAME() AS db, CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AS instance")).recordset[0];
    if (target.db !== 'schooldb' || String(target.instance).toUpperCase() !== 'MARIUS\\DEV') throw Error('Unexpected database or instance');
    const files = migrationFiles();
    const installed = (await query('SELECT version, checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
    if (files.length !== 9 || installed.length !== 9 || installed.some((row,i) => row.version !== files[i].name || row.checksum !== files[i].checksum))
        throw Error('Expected the verified M1 migration ledger through 009');
    const staged = migrationFiles(path.join(__dirname,'../docs/implementation/staged')).filter(f => stagedNames.includes(f.name));
    if (!sameNames(staged.map(f => f.name), stagedNames)) throw Error('Missing staged M2 file');
    const conflicts = (await query(`SELECT
        (SELECT COUNT(*) FROM sys.objects WHERE schema_id=SCHEMA_ID('dbo') AND name IN
        ('student_enrolments','student_enrolment_revisions','pupil_withdrawal_access','year_offering_revisions',
         'teaching_assignment_events','academic_year_archives','enrolment_archive_boundary','academic_year_archive_immutable')) AS existingObjects,
        (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.school_memberships') AND (system_type_id=189 OR name='pupil_access_stamp')) AS membershipStamp,
        (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.academic_years') AND name='UX_year_archive_definition') AS archiveIndex`)).recordset[0];
    if (Object.values(conflicts).some(Number)) throw Error('Existing M2 objects or membership rowversion require review');
    const scope = (await query(`SELECT id FROM dbo.schools WHERE code='LYCEE_BATOURI' AND name=N'LYCEE BATOURI' AND status='active'`)).recordset;
    if (scope.length !== 1) throw Error('School identity requires review');
    const result = await database.getPool().request().input('school',sql.Int,scope[0].id).query(`
        SELECT (SELECT COUNT(*) FROM dbo.academic_years WHERE school_id=@school AND isCurrent=1) AS currentYears,
            (SELECT COUNT(*) FROM dbo.students WHERE school_id=@school AND isWithdrawn=0) AS activePupils,
            (SELECT COUNT(*) FROM dbo.students WHERE school_id=@school AND isWithdrawn=0 AND currentClassLevel IS NULL) AS activeMissingClass,
            (SELECT COUNT(*) FROM dbo.students WHERE school_id=@school AND isWithdrawn=0 AND academicYearId IS NULL) AS activeMissingYear,
            (SELECT COUNT(*) FROM dbo.students s WHERE s.school_id=@school AND s.isWithdrawn=0 AND EXISTS
                (SELECT 1 FROM dbo.academic_years y WHERE y.school_id=@school AND y.id=s.academicYearId AND y.isCurrent=1)
                AND EXISTS(SELECT 1 FROM dbo.classes c WHERE c.school_id=@school AND c.id=s.currentClassLevel)) AS activeWithCurrentYearAndClass,
            (SELECT COUNT(*) FROM dbo.academic_year_students WHERE school_id=@school) AS pupilYearMemberships,
            (SELECT COUNT(*) FROM dbo.class_subject_students WHERE school_id=@school) AS pupilSubjectLinks,
            (SELECT COUNT(*) FROM dbo.subject_scores WHERE school_id=@school) AS scoreRows,
            (SELECT COUNT(*) FROM dbo.class_subject_teachers WHERE school_id=@school AND academic_year_id IS NULL) AS undatedTeachingLinks,
            (SELECT COUNT(*) FROM dbo.class_subject_teachers WHERE school_id=@school AND academic_year_id IS NOT NULL) AS yearSpecificTeachingLinks,
            (SELECT COUNT(*) FROM dbo.class_subjects WHERE school_id=@school) AS catalogueOfferings`);
    return {db:target.db,instance:target.instance,migrationsVerified:installed.length,
        staged:staged.map(({name,checksum})=>({name,checksum})), counts:result.recordset[0]};
}
if (require.main === module) {
    loadEnvironment();
    const db=createDatabase();
    inventory(db).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{
        console.error('M2 inventory refused.',error.number || error.code || 'Check target, ledger and schema prerequisites.');
        process.exitCode=1;
    }).finally(()=>db.close());
}
module.exports={inventory};
