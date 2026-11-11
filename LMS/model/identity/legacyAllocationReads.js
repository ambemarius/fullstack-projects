// Read-only compatibility boundary for the retained allocation interface.
const db = require('../../config/database');
const { legacyAdminAuthoritySql } = require('./legacySchoolAccess');
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

function createLegacyAllocationReads(access, database = { connect: db.connect, getPool: () => db.pool }) {
    async function request(context) {
        const actor = await access.authorize(context, ['admin']);
        await database.connect();
        return database.getPool().request()
            .input('school', db.sql.Int, actor.schoolId)
            .input('account', db.sql.Int, actor.accountId)
            .input('membership', db.sql.Int, actor.membershipId)
            .input('legacy_id', db.sql.Int, actor.legacyId)
            .input('credential_version', db.sql.Int, actor.securityVersion)
            .input('jwt_expires', db.sql.DateTime2, actor.expiresAt);
    }

    async function list(context, { yearId, classId } = {}) {
        if (yearId !== undefined && !validId(yearId)) throw fail(422, 'Invalid academic year');
        if (classId !== undefined && !validId(classId)) throw fail(422, 'Invalid class');
        const yearRequest = await request(context);
        if (yearId !== undefined) yearRequest.input('year', db.sql.Int, yearId);
        const years = (await yearRequest.query(`SELECT id FROM dbo.academic_years
            WHERE school_id=@school AND ${yearId === undefined ? 'isCurrent=1' : 'id=@year'}
            AND ${legacyAdminAuthoritySql}`)).recordset;
        if (years.length !== 1) throw fail(yearId === undefined ? 400 : 404,
            yearId === undefined ? 'No current academic year' : 'Academic year not found');
        if (classId !== undefined) {
            const parent = await request(context);
            const classes = (await parent.input('class', db.sql.Int, classId).query(`SELECT id FROM dbo.classes
                WHERE id=@class AND school_id=@school AND ${legacyAdminAuthoritySql}`)).recordset;
            if (classes.length !== 1) throw fail(404, 'Class not found');
        }
        const rows = (await request(context)).input('year', db.sql.Int, years[0].id);
        if (classId !== undefined) rows.input('class', db.sql.Int, classId);
        return (await rows.query(`SELECT sa.*,s.name AS subject_name,s.code AS subject_code
            ${classId === undefined ? ',c.name AS class_name,c.section,c.stream' : ''}
            FROM dbo.subject_allocations sa
            JOIN dbo.subjects s ON s.id=sa.subject_id AND s.school_id=sa.school_id
            JOIN dbo.classes c ON c.id=sa.class_id AND c.school_id=sa.school_id
            JOIN dbo.academic_years ay ON ay.id=sa.academic_year_id AND ay.school_id=sa.school_id
            WHERE sa.school_id=@school AND sa.academic_year_id=@year
            ${classId === undefined ? '' : 'AND sa.class_id=@class'} AND ${legacyAdminAuthoritySql}
            ORDER BY ${classId === undefined ? 'c.section,c.rank,' : ''}s.name`)).recordset;
    }
    async function formData(context) {
        const classes = (await (await request(context)).query(`SELECT c.*,t.name AS class_master_name,
            CASE WHEN c.rank<=5 THEN 'Secondary' ELSE 'Advanced' END AS schoolLevel
            FROM dbo.classes c LEFT JOIN dbo.teachers t ON t.id=c.class_master_id AND t.school_id=c.school_id
            WHERE c.school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY c.section,c.rank,c.stream`)).recordset;
        const subjects = (await (await request(context)).query(`SELECT s.*,t.name AS subject_master_name,c.name AS class_name
            FROM dbo.subjects s LEFT JOIN dbo.teachers t ON t.id=s.subject_master AND t.school_id=s.school_id
            LEFT JOIN dbo.classes c ON c.id=s.class_id AND c.school_id=s.school_id
            WHERE s.school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY s.name`)).recordset;
        const academicYears = (await (await request(context)).query(`SELECT ay.*,
            (SELECT COUNT(*) FROM dbo.academic_year_students e JOIN dbo.students p ON p.id=e.student_id AND p.school_id=e.school_id
              WHERE e.academic_year_id=ay.id AND e.school_id=ay.school_id) AS numberOfStudents,
            (SELECT COUNT(*) FROM dbo.academic_year_teachers e JOIN dbo.teachers p ON p.id=e.teacher_id AND p.school_id=e.school_id
              WHERE e.academic_year_id=ay.id AND e.school_id=ay.school_id) AS numberOfTeachers
            FROM dbo.academic_years ay WHERE ay.school_id=@school AND ${legacyAdminAuthoritySql} ORDER BY ay.fromYear DESC`)).recordset;
        return { classes, subjects, academicYears };
    }
    return { list, formData };
}

module.exports = { createLegacyAllocationReads };
