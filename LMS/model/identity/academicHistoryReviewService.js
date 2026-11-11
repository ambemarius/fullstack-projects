const { sql, pool, connect } = require('../../config/database');
const { authoritySql } = require('./schoolAccess');

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
// A source association is evidence for review, never a certified placement or an access grant.
function placementReview(evidence) {
    const candidateClassIds = [...new Set(evidence.map(row => row.classId))].sort((a, b) => a - b);
    return { status: candidateClassIds.length === 0 ? 'unknown' : candidateClassIds.length === 1 ? 'requires_confirmation' : 'multiple_candidates',
        candidateClassIds, authoritative: false, effectiveFrom: null, effectiveTo: null };
}

function createAcademicHistoryReviewService(access, database = { connect, getPool: () => pool }) {
    async function yearRequest(context, yearId) {
        if (!validId(yearId)) throw fail(422, 'Invalid history scope');
        const identity = await access.authorize(context, ['admin']);
        await database.connect();
        return database.getPool().request().input('school', sql.Int, identity.schoolId)
            .input('account', sql.Int, identity.accountId).input('membership', sql.Int, identity.membershipId)
            .input('session_hash', sql.Char(64), identity.tokenHash).input('role_one', sql.VarChar(30), 'admin')
            .input('role_two', sql.VarChar(30), null).input('year', sql.Int, yearId);
    }
    async function request(context, personId, yearId) {
        if (!validId(personId)) throw fail(422,'Invalid history scope');
        return (await yearRequest(context,yearId)).input('person',sql.Int,personId);
    }
    function bounded(rows) {
        // Refuse truncation: an incomplete set must not be described as a single-class candidate.
        if (rows.length > 1000) throw fail(409, 'History evidence exceeds review limit');
        return rows;
    }
    async function student(context, studentId, yearId) {
        const req = await request(context, studentId, yearId);
        const sets = (await req.query(`
            SELECT s.id AS studentId,y.id AS yearId,y.name AS yearName,
                current_class.id AS currentClassId,current_year.id AS currentYearId,
                CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.academic_year_students ay
                    WHERE ay.school_id=@school AND ay.student_id=s.id AND ay.academic_year_id=@year) THEN 1 ELSE 0 END AS BIT) AS yearMembershipRecorded
            FROM dbo.students s JOIN dbo.academic_years y ON y.id=@year AND y.school_id=s.school_id
            LEFT JOIN dbo.classes current_class ON current_class.id=s.currentClassLevel AND current_class.school_id=s.school_id
            LEFT JOIN dbo.academic_years current_year ON current_year.id=s.academicYearId AND current_year.school_id=s.school_id
            WHERE s.school_id=@school AND s.id=@person AND ${authoritySql};

            SELECT TOP(1001) 'class_subject_students' AS sourceTable,e.id AS sourceId,o.class_id AS classId,
                c.name AS className,o.subject_id AS subjectId,s.name AS subjectName,e.enrolment_status AS sourceStatus
            FROM dbo.class_subject_students e
            JOIN dbo.students p ON p.school_id=e.school_id AND p.id=e.student_id
            JOIN dbo.academic_years y ON y.school_id=e.school_id AND y.id=e.academic_year_id
            JOIN dbo.class_subjects o ON o.school_id=e.school_id AND o.id=e.class_subject_id
            JOIN dbo.classes c ON c.school_id=o.school_id AND c.id=o.class_id
            JOIN dbo.subjects s ON s.school_id=o.school_id AND s.id=o.subject_id
            WHERE e.school_id=@school AND e.student_id=@person AND e.academic_year_id=@year AND ${authoritySql}
            ORDER BY e.id;

            SELECT TOP(1001) 'subject_scores' AS sourceTable,e.id AS sourceId,o.class_id AS classId,
                c.name AS className,o.subject_id AS subjectId,s.name AS subjectName,e.term,e.sequence
            FROM dbo.subject_scores e
            JOIN dbo.students p ON p.school_id=e.school_id AND p.id=e.student_id
            JOIN dbo.academic_years y ON y.school_id=e.school_id AND y.id=e.academic_year_id
            JOIN dbo.class_subjects o ON o.school_id=e.school_id AND o.id=e.class_subject_id
            JOIN dbo.classes c ON c.school_id=o.school_id AND c.id=o.class_id
            JOIN dbo.subjects s ON s.school_id=o.school_id AND s.id=o.subject_id
            WHERE e.school_id=@school AND e.student_id=@person AND e.academic_year_id=@year AND ${authoritySql}
            ORDER BY e.id;`)).recordsets;
        const person = sets[0][0];
        if (!person) throw fail(404, 'History not found');
        const subjectLinks = bounded(sets[1]), scoreReferences = bounded(sets[2]);
        return { studentId, yearId, yearName: person.yearName, yearMembershipRecorded: person.yearMembershipRecorded,
            currentPlacement: { classId: person.currentClassId, yearId: person.currentYearId, historicalEvidence: false },
            placement: placementReview([...subjectLinks, ...scoreReferences]), subjectLinks, scoreReferences };
    }
    async function teacher(context, teacherId, yearId) {
        const req = await request(context, teacherId, yearId);
        const sets = (await req.query(`
            SELECT p.id AS teacherId,y.name AS yearName FROM dbo.teachers p
            JOIN dbo.academic_years y ON y.school_id=p.school_id AND y.id=@year
            WHERE p.school_id=@school AND p.id=@person AND ${authoritySql};
            SELECT TOP(1001) a.id AS sourceId,a.academic_year_id AS yearId,a.term,a.assignment_status AS sourceStatus,
                o.class_id AS classId,c.name AS className,o.subject_id AS subjectId,s.name AS subjectName
            FROM dbo.class_subject_teachers a
            JOIN dbo.teachers p ON p.school_id=a.school_id AND p.id=a.teacher_id
            JOIN dbo.class_subjects o ON o.school_id=a.school_id AND o.id=a.class_subject_id
            JOIN dbo.classes c ON c.school_id=o.school_id AND c.id=o.class_id
            JOIN dbo.subjects s ON s.school_id=o.school_id AND s.id=o.subject_id
            LEFT JOIN dbo.academic_years y ON y.school_id=a.school_id AND y.id=a.academic_year_id
            WHERE a.school_id=@school AND a.teacher_id=@person
                AND ((a.academic_year_id=@year AND y.id IS NOT NULL) OR a.academic_year_id IS NULL) AND ${authoritySql}
            ORDER BY a.id;`)).recordsets;
        if (!sets[0][0]) throw fail(404, 'History not found');
        const rows = bounded(sets[1]);
        return { teacherId, yearId, yearName: sets[0][0].yearName, sourceTable: 'class_subject_teachers',
            assignments: rows.filter(row => row.yearId !== null), unresolvedYearAssignments: rows.filter(row => row.yearId === null),
            grantsAccess: false };
    }
    async function placementReviewList(context,yearId,afterStudentId) {
        if (afterStudentId!==undefined && !validId(afterStudentId)) throw fail(422,'Invalid pupil cursor');
        const req=(await yearRequest(context,yearId)).input('after',sql.Int,afterStudentId??0);
        const rows=(await req.query(`
            SELECT y.name AS currentYear,y.isCurrent,p.* FROM dbo.academic_years y
            OUTER APPLY (
                SELECT TOP (51) s.id,s.matricule,s.firstName,s.middleName,s.lastName,
                    c.name AS profileClass,py.name AS profileYear
                FROM dbo.students s
                LEFT JOIN dbo.classes c ON c.school_id=s.school_id AND c.id=s.currentClassLevel
                LEFT JOIN dbo.academic_years py ON py.school_id=s.school_id AND py.id=s.academicYearId
                WHERE y.isCurrent=1 AND s.school_id=y.school_id AND s.isWithdrawn=0 AND s.id>@after
                    AND (c.id IS NULL OR py.id IS NULL OR py.id<>y.id)
                ORDER BY s.id
            ) p
            WHERE y.id=@year AND y.school_id=@school AND ${authoritySql} ORDER BY p.id`)).recordset;
        if (!rows.length) throw fail(404,'Academic year not found');
        if (!rows[0].isCurrent) throw fail(409,'The current year changed. Refresh registration before reviewing placements.');
        const pupils=rows.filter(row=>row.id!==null).slice(0,50).map(({currentYear,isCurrent,...person})=>person);
        return {yearName:rows[0].currentYear,pupils,nextAfterStudentId:rows.length>50?pupils.at(-1).id:null};
    }
    return { student, teacher, placementReviewList };
}
module.exports = { createAcademicHistoryReviewService, placementReview };
