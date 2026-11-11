const db = require('../../config/database');
const { legacyAdminAuthoritySql: authority } = require('./legacySchoolAccess');
const fail = (statusCode, message) => Object.assign(Error(message), { statusCode });
const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
function createLegacyReferenceReads(access, database = { connect: db.connect, getPool: () => db.pool }) {
    async function request(context) {
        const actor = await access.authorize(context, ['admin']);
        await database.connect();
        return database.getPool().request().input('school', db.sql.Int, actor.schoolId)
            .input('account', db.sql.Int, actor.accountId).input('membership', db.sql.Int, actor.membershipId)
            .input('legacy_id', db.sql.Int, actor.legacyId).input('credential_version', db.sql.Int, actor.securityVersion)
            .input('jwt_expires', db.sql.DateTime2, actor.expiresAt);
    }
    const projections = {
        classes: { select: `c.*,t.name AS class_master_name,CASE WHEN c.rank<=5 THEN 'Secondary' ELSE 'Advanced' END AS schoolLevel`,
            from: 'dbo.classes c LEFT JOIN dbo.teachers t ON t.id=c.class_master_id AND t.school_id=c.school_id', alias: 'c', order: 'c.section,c.rank,c.stream' },
        subjects: { select: 's.*,t.name AS subject_master_name,c.name AS class_name',
            from: 'dbo.subjects s LEFT JOIN dbo.teachers t ON t.id=s.subject_master AND t.school_id=s.school_id LEFT JOIN dbo.classes c ON c.id=s.class_id AND c.school_id=s.school_id', alias: 's', order: 's.name' },
        years: { select: `ay.*,
            (SELECT COUNT(*) FROM dbo.academic_year_students e JOIN dbo.students p ON p.id=e.student_id AND p.school_id=e.school_id WHERE e.academic_year_id=ay.id AND e.school_id=ay.school_id) AS numberOfStudents,
            (SELECT COUNT(*) FROM dbo.academic_year_teachers e JOIN dbo.teachers p ON p.id=e.teacher_id AND p.school_id=e.school_id WHERE e.academic_year_id=ay.id AND e.school_id=ay.school_id) AS numberOfTeachers`,
            from: 'dbo.academic_years ay', alias: 'ay', order: 'ay.fromYear DESC' },
        auxiliary: { select: 'p.*', from: 'dbo.auxiliary_staff p', alias: 'p', order: 'p.name' }
    };
    async function records(context, kind, id) {
        if (!Object.hasOwn(projections, kind)) throw fail(422, 'Invalid reference type');
        if (id !== undefined && !validId(id)) throw fail(422, 'Invalid reference');
        const p = projections[kind], req = await request(context);
        if (id !== undefined) req.input('target', db.sql.Int, id);
        const rows = (await req.query(`SELECT ${p.select} FROM ${p.from} WHERE ${p.alias}.school_id=@school
            ${id === undefined ? '' : `AND ${p.alias}.id=@target`} AND ${authority} ORDER BY ${p.order}`)).recordset;
        if (id !== undefined && rows.length !== 1) throw fail(404, 'Record not found');
        return id === undefined ? rows : rows[0];
    }
    async function classSubjects(context, classId, term) {
        if (!validId(classId)) throw fail(422, 'Invalid class');
        if (term !== undefined && !['First', 'Second', 'Third'].includes(term)) throw fail(422, 'Invalid term');
        await records(context, 'classes', classId);
        const req = (await request(context)).input('class', db.sql.Int, classId);
        if (term !== undefined) req.input('term', db.sql.NVarChar(10), term);
        return (await req.query(`SELECT cs.id AS classSubjectId,s.id AS subjectId,s.name AS subject,s.code,
            cst.term,t.id AS teacherId,t.name AS teacher
            FROM dbo.class_subjects cs JOIN dbo.classes c ON c.id=cs.class_id AND c.school_id=cs.school_id
            JOIN dbo.subjects s ON s.id=cs.subject_id AND s.school_id=cs.school_id
            LEFT JOIN dbo.class_subject_teachers cst ON cst.class_subject_id=cs.id AND cst.school_id=cs.school_id
                ${term === undefined ? '' : 'AND cst.term=@term'}
            LEFT JOIN dbo.teachers t ON t.id=cst.teacher_id AND t.school_id=cst.school_id
            WHERE cs.class_id=@class AND cs.school_id=@school AND ${authority} ORDER BY s.name,cst.term,t.name`)).recordset;
    }
    async function context(context) {
        const years = (await (await request(context)).query(`SELECT id,name,fromYear,toYear FROM dbo.academic_years
            WHERE school_id=@school AND isCurrent=1 AND ${authority}`)).recordset;
        const slots = (await (await request(context)).query(`SELECT id,slot_number,start_time,end_time,is_break,sort_order
            FROM dbo.time_slots WHERE school_id=@school AND ${authority} ORDER BY sort_order`)).recordset;
        return { currentYear: years[0] || null, slots };
    }
    // Cameroon administrative geography is shared reference data, not school-owned data.
    async function geography(context, kind, parentId) {
        if (!['regions', 'divisions', 'subdivisions'].includes(kind)) throw fail(422, 'Invalid geography');
        if (kind !== 'regions' && !validId(parentId)) throw fail(422, 'Invalid geography parent');
        const req = await request(context);
        if (kind !== 'regions') req.input('parent', db.sql.Int, parentId);
        return (await req.query(`SELECT id,name FROM dbo.${kind} WHERE ${authority}
            ${kind === 'regions' ? '' : `AND ${kind === 'divisions' ? 'region_id' : 'division_id'}=@parent`} ORDER BY name`)).recordset;
    }
    return { records, classSubjects, context, geography };
}
module.exports = { createLegacyReferenceReads };
