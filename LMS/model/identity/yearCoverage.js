const { authoritySql } = require('./schoolAccess');

// The caller binds the signed school membership and runs this statement at SERIALIZABLE.
// A class match only establishes that a dated placement exists somewhere in the year.
const yearCoverageSql = `
WITH placements AS (
    SELECT p.student_id, r.class_id,r.effective_to
    FROM dbo.student_enrolments p
    JOIN dbo.student_enrolment_revisions r ON r.school_id=p.school_id AND r.enrolment_id=p.id
    WHERE p.school_id=@school AND r.academic_year_id=@year AND r.status<>'voided'
        AND NOT EXISTS (SELECT 1 FROM dbo.student_enrolment_revisions newer
            WHERE newer.school_id=r.school_id AND newer.enrolment_id=r.enrolment_id AND newer.revision>r.revision)
), members AS (
    SELECT student_id FROM dbo.academic_year_students WHERE school_id=@school AND academic_year_id=@year
), courses AS (
    SELECT student_id,class_subject_id FROM dbo.class_subject_students WHERE school_id=@school AND academic_year_id=@year
), scores AS (
    SELECT student_id,class_subject_id FROM dbo.subject_scores WHERE school_id=@school AND academic_year_id=@year
), assignments AS (
    SELECT id,teacher_id,class_subject_id,link_version FROM dbo.class_subject_teachers WHERE school_id=@school AND academic_year_id=@year
), sourceCourses AS (
    SELECT student_id,class_subject_id FROM courses UNION SELECT student_id,class_subject_id FROM scores
), sourcePupils AS (
    SELECT student_id FROM members UNION SELECT student_id FROM sourceCourses
), usedOfferings AS (
    SELECT class_subject_id FROM sourceCourses UNION SELECT class_subject_id FROM assignments
)
SELECT y.id AS yearId,y.name AS yearName,
    (SELECT COUNT(*) FROM placements WHERE effective_to IS NULL OR effective_to>@today) AS unfinishedPlacements,
    (SELECT COUNT(*) FROM dbo.students WHERE school_id=@school AND academicYearId=@year AND isWithdrawn=0) AS activeProjectionPupils,
    (SELECT COUNT(*) FROM dbo.students WHERE school_id=@school AND academicYearId=@year) AS currentProjectionPupils,
    (SELECT COUNT(DISTINCT student_id) FROM members) AS yearMemberPupils,
    (SELECT COUNT(*) FROM sourcePupils) AS sourcePupils,
    (SELECT COUNT(DISTINCT student_id) FROM placements) AS ledgerPupils,
    (SELECT COUNT(*) FROM sourcePupils s WHERE NOT EXISTS
        (SELECT 1 FROM placements p WHERE p.student_id=s.student_id)) AS sourcePupilsWithoutPlacement,
    (SELECT COUNT(DISTINCT p.student_id) FROM placements p WHERE NOT EXISTS
        (SELECT 1 FROM members m WHERE m.student_id=p.student_id)) AS ledgerPupilsWithoutYearMembership,
    (SELECT COUNT(*) FROM courses) AS courseLinkRows,
    (SELECT COUNT(*) FROM scores) AS scoreRows,
    (SELECT COUNT(*) FROM sourceCourses s JOIN dbo.class_subjects o ON o.school_id=@school AND o.id=s.class_subject_id
        WHERE NOT EXISTS (SELECT 1 FROM placements p WHERE p.student_id=s.student_id AND p.class_id=o.class_id)) AS pupilOfferingsWithoutClassPlacement,
    (SELECT COUNT(*) FROM usedOfferings) AS usedOfferings,
    (SELECT COUNT(*) FROM usedOfferings u WHERE NOT EXISTS (SELECT 1 FROM dbo.year_offering_revisions r
        WHERE r.school_id=@school AND r.academic_year_id=@year AND r.offering_id=u.class_subject_id)) AS usedOfferingsWithoutCoefficient,
    (SELECT COUNT(*) FROM assignments) AS yearAssignmentRows,
    (SELECT COUNT(DISTINCT teacher_id) FROM dbo.academic_year_teachers WHERE school_id=@school AND academic_year_id=@year) AS yearMemberTeachers,
    (SELECT COUNT(DISTINCT a.teacher_id) FROM assignments a WHERE NOT EXISTS
        (SELECT 1 FROM dbo.academic_year_teachers t WHERE t.school_id=@school AND t.academic_year_id=@year AND t.teacher_id=a.teacher_id)) AS assignedTeachersWithoutYearMembership,
    (SELECT COUNT(*) FROM assignments a WHERE NOT EXISTS (SELECT 1 FROM dbo.teaching_assignment_events e
        WHERE e.school_id=@school AND e.academic_year_id=@year AND e.assignment_id=a.id AND e.link_version=a.link_version)) AS assignmentsWithoutVersionEvent,
    (SELECT COUNT(*) FROM dbo.class_subject_teachers WHERE school_id=@school AND academic_year_id IS NULL) AS schoolUndatedAssignmentRows
FROM dbo.academic_years y WHERE y.school_id=@school AND y.id=@year AND ${authoritySql};`;

module.exports = { yearCoverageSql };
