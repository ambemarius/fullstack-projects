const db = require('../../config/database');
const { legacyAdminAuthoritySql } = require('./legacySchoolAccess');
const teacherFields = require('../staff/teacher')._safeColumns.split(',').map(field => 'p.' + field.trim()).join(',');
const studentFields = require('../Academic/student')._safeColumns;
function createLegacySelfReads(access, database = { connect: db.connect, getPool: () => db.pool }) {
    async function profile(context) {
        const actor = await access.authorize(context, ['teacher', 'student']);
        const teacher = actor.accountType === 'teacher';
        if (!teacher && actor.accountType !== 'student') throw Object.assign(Error('Authentication required'), { statusCode: 401 });
        const table = teacher ? 'teachers' : 'students';
        let authority = legacyAdminAuthoritySql
            .replaceAll('dbo.Admins', 'dbo.' + table).replaceAll("source_table='Admins'", "source_table='" + table + "'")
            .replace("LOWER(LTRIM(RTRIM(auth_source.role)))='admin'", teacher ? "auth_source.role='teacher' AND auth_source.status='active'" : "auth_source.role='student' AND auth_source.isWithdrawn=0")
            .replace("auth_role.role='admin'", "auth_role.role='" + actor.accountType + "'");
        if (!teacher && actor.pupilTokenVersion !== undefined) {
            authority += ` AND @pupil_token_version=CAST(@credential_version AS BIGINT)+(SELECT COUNT_BIG(*) FROM dbo.pupil_withdrawal_access
                WHERE school_id=@school AND membership_id=@membership AND account_id=@account)`;
        }
        await database.connect();
        const rows = (await database.getPool().request().input('school', db.sql.Int, actor.schoolId)
            .input('account', db.sql.Int, actor.accountId).input('membership', db.sql.Int, actor.membershipId)
            .input('legacy_id', db.sql.Int, actor.legacyId).input('credential_version', db.sql.Int, actor.securityVersion)
            .input('pupil_token_version', db.sql.BigInt, actor.pupilTokenVersion ?? null).input('jwt_expires', db.sql.DateTime2, actor.expiresAt)
            .query(teacher ? `SELECT ${teacherFields} FROM dbo.teachers p WHERE p.id=@legacy_id AND p.school_id=@school AND ${authority}` :
                `SELECT ${studentFields},ay.name AS academicYearName FROM dbo.students s
                 LEFT JOIN dbo.academic_years ay ON ay.id=s.academicYearId AND ay.school_id=s.school_id
                 WHERE s.id=@legacy_id AND s.school_id=@school AND ${authority}`)).recordset;
        if (rows.length !== 1) throw Object.assign(Error('Authentication required'), { statusCode: 401 });
        return rows[0];
    }
    return { profile };
}
module.exports = { createLegacySelfReads };
