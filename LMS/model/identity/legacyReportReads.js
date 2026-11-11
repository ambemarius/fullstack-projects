const db = require('../../config/database');
const { legacyAdminAuthoritySql } = require('./legacySchoolAccess');
const { createLegacyReferenceReads } = require('./legacyReferenceReads');
const fail = (statusCode, message) => Object.assign(Error(message), { statusCode });
function createLegacyReportReads(access, database = { connect: db.connect, getPool: () => db.pool }) {
    async function rows(context, { classId, yearId, term }) {
        if (![classId, yearId].every(id => Number.isSafeInteger(id) && id > 0 && id <= 2147483647) ||
            !['First', 'Second', 'Third'].includes(term)) throw fail(422, 'Invalid report reference');
        const references = createLegacyReferenceReads(access, database);
        await references.records(context, 'classes', classId);
        await references.records(context, 'years', yearId);
        const actor = await access.authorize(context, ['admin']);
        await database.connect();
        const request = database.getPool().request()
            .input('school', db.sql.Int, actor.schoolId).input('account', db.sql.Int, actor.accountId)
            .input('membership', db.sql.Int, actor.membershipId).input('legacy_id', db.sql.Int, actor.legacyId)
            .input('credential_version', db.sql.Int, actor.securityVersion).input('jwt_expires', db.sql.DateTime2, actor.expiresAt)
            .input('classId', db.sql.Int, classId).input('academicYearId', db.sql.Int, yearId).input('term', db.sql.NVarChar(10), term);
        const metadata = (await request.query(`SELECT COL_LENGTH('dbo.subjects','passmark') AS field WHERE ${legacyAdminAuthoritySql}`)).recordset;
        if(metadata.length!==1)throw fail(401,'Authentication required');
        const result = await request.query(`SELECT s.id AS studentId,s.firstName,s.middleName,s.lastName,s.matricule,s.sex,
                cs.id AS classSubjectId,subj.name AS subjectName,subj.code AS subjectCode,cs.coefficient,
                ss1.score AS seq1,ss1.max_score AS max1,ss2.score AS seq2,ss2.max_score AS max2,${metadata[0].field === null ? 'CAST(NULL AS INT)' : 'subj.passmark'} AS passmark
                FROM dbo.students s
                JOIN dbo.classes c ON c.id=s.currentClassLevel AND c.school_id=s.school_id
                JOIN dbo.academic_years ay ON ay.id=s.academicYearId AND ay.school_id=s.school_id
                JOIN dbo.class_subjects cs ON cs.class_id=c.id AND cs.school_id=s.school_id
                JOIN dbo.subjects subj ON subj.id=cs.subject_id AND subj.school_id=cs.school_id
                LEFT JOIN dbo.subject_scores ss1 ON ss1.student_id=s.id AND ss1.class_subject_id=cs.id
                    AND ss1.school_id=s.school_id AND ss1.academic_year_id=@academicYearId AND ss1.term=@term AND ss1.sequence=1
                LEFT JOIN dbo.subject_scores ss2 ON ss2.student_id=s.id AND ss2.class_subject_id=cs.id
                    AND ss2.school_id=s.school_id AND ss2.academic_year_id=@academicYearId AND ss2.term=@term AND ss2.sequence=2
                WHERE s.currentClassLevel=@classId AND s.school_id=@school AND s.isWithdrawn=0
                    AND s.academicYearId=@academicYearId AND ${legacyAdminAuthoritySql}
                ORDER BY s.lastName,s.firstName,subj.name`);
        return result.recordset;
    }
    return { rows };
}
module.exports = { createLegacyReportReads };
