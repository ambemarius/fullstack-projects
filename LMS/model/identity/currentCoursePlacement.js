const {sql} = require('../../config/database');
const {authoritySql} = require('./schoolAccess');
const conflict = message => Object.assign(new Error(message), {statusCode:409});

async function schoolDate(request) {
    const school = (await request().query(`SELECT timezone FROM dbo.schools WHERE id=@school AND ${authoritySql}`)).recordset[0];
    if (!school) throw Object.assign(new Error('Access denied'), {statusCode:403});
    try {
        return new Intl.DateTimeFormat('en-CA',{timeZone:school.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    } catch { throw conflict('School time zone requires review'); }
}

async function requirePlacement(request,studentId,classId,yearId,onDate) {
    // Read all candidates before comparing the offering. Conflicting placements must fail closed.
    const rows=(await request().input('placementStudent',sql.Int,studentId).input('placementDate',sql.Date,onDate).query(`
        SELECT TOP(2) r.class_id,r.academic_year_id,r.status FROM dbo.student_enrolments e
        JOIN dbo.student_enrolment_revisions r ON r.enrolment_id=e.id AND r.school_id=e.school_id
        WHERE e.school_id=@school AND e.student_id=@placementStudent AND r.status<>'voided'
            AND r.effective_from<=@placementDate AND (r.effective_to IS NULL OR @placementDate<r.effective_to)
            AND NOT EXISTS(SELECT 1 FROM dbo.student_enrolment_revisions newer
                WHERE newer.school_id=r.school_id AND newer.enrolment_id=r.enrolment_id AND newer.revision>r.revision)
            AND ${authoritySql}`)).recordset;
    if(rows.length!==1 || rows[0].status!=='enrolled' || rows[0].class_id!==classId || rows[0].academic_year_id!==yearId)
        throw conflict('A verified current placement is required for this course');
}
module.exports = { schoolDate, requirePlacement };
