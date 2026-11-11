const {sql} = require('../../config/database');
const {authoritySql} = require('./schoolAccess');
const fail = (statusCode,message) => Object.assign(new Error(message),{statusCode});
const validId = value => Number.isInteger(value) && value>0 && value<=2147483647;

function validate(input) {
    if (!input || Object.keys(input).some(key=>!['offeringId','yearId','version','coefficient','sourceReference'].includes(key)) ||
        !validId(input.offeringId) || !validId(input.yearId) || !Number.isInteger(input.version) || input.version<0 || input.version>=2147483647 ||
        !Number.isFinite(input.coefficient) || input.coefficient<=0 || input.coefficient>99.99 || Math.round(input.coefficient*100)/100!==input.coefficient ||
        typeof input.sourceReference!=='string' || !input.sourceReference.trim() || input.sourceReference.length>200 || /[\x00-\x1f\x7f]/.test(input.sourceReference))
        throw fail(422,'Enter a year, offering, coefficient and source reference with the reviewed version');
}
function scoped(request,offeringId,yearId) {
    return request().input('offering',sql.Int,offeringId).input('year',sql.Int,yearId);
}
async function revision(request,offeringId,yearId) {
    const row=(await scoped(request,offeringId,yearId).query(`SELECT TOP(1) revision FROM dbo.year_offering_revisions
        WHERE school_id=@school AND offering_id=@offering AND academic_year_id=@year AND ${authoritySql} ORDER BY revision DESC`)).recordset[0];
    return row?.revision??0;
}
async function configure(request,input) {
    const before=await revision(request,input.offeringId,input.yearId);
    if(before!==input.version)throw fail(409,'Year offering has changed. Review its latest revision.');
    const result=await scoped(request,input.offeringId,input.yearId).input('previous',sql.Int,before||null)
        .input('revision',sql.Int,before+1).input('coefficient',sql.Decimal(4,2),input.coefficient)
        .input('source',sql.NVarChar(200),input.sourceReference.trim()).query(`
            INSERT dbo.year_offering_revisions(school_id,offering_id,academic_year_id,revision,previous_revision,coefficient,source_reference,actor_membership_id,actor_account_id)
            OUTPUT INSERTED.revision AS version, INSERTED.coefficient
            SELECT @school,@offering,@year,@revision,@previous,@coefficient,@source,@membership,@account WHERE ${authoritySql}`);
    if(!result.recordset.length)throw fail(403,'Access denied');
    return result.recordset[0];
}
async function recordAssignment(request,assignment,offeringRevision) {
    const result=await request().input('assignment',sql.Int,assignment.id).input('version',sql.Int,assignment.version)
        .input('snapshot',sql.Int,offeringRevision||null).query(`
            INSERT dbo.teaching_assignment_events(school_id,assignment_id,link_version,offering_id,academic_year_id,offering_revision,
                teacher_id,term,assignment_status,actor_membership_id,actor_account_id)
            SELECT school_id,id,link_version,class_subject_id,academic_year_id,@snapshot,teacher_id,term,assignment_status,@membership,@account
            FROM dbo.class_subject_teachers WHERE school_id=@school AND id=@assignment AND link_version=@version AND ${authoritySql}`);
    if(result.rowsAffected[0]!==1)throw fail(409,'Teaching assignment changed during recording');
}
async function history(request,offeringId,yearId) {
    const sets=(await scoped(request,offeringId,yearId).query(`
        SELECT TOP(1001) revision AS version,coefficient,source_reference AS sourceReference,recorded_at AS recordedAt
        FROM dbo.year_offering_revisions WHERE school_id=@school AND offering_id=@offering AND academic_year_id=@year AND ${authoritySql} ORDER BY revision;
        SELECT TOP(1001) e.assignment_id AS assignmentId,e.link_version AS version,e.teacher_id AS teacherId,t.name AS teacherName,
            e.term,e.assignment_status AS status,e.offering_revision AS offeringVersion,e.recorded_at AS recordedAt
        FROM dbo.teaching_assignment_events e JOIN dbo.teachers t ON t.school_id=e.school_id AND t.id=e.teacher_id
        WHERE e.school_id=@school AND e.offering_id=@offering AND e.academic_year_id=@year AND ${authoritySql}
        ORDER BY e.recorded_at,e.assignment_id,e.link_version;`)).recordsets;
    if(sets.some(rows=>rows.length>1000))throw fail(409,'Year history exceeds review limit');
    return {revisions:sets[0],assignments:sets[1]};
}
module.exports={validate,revision,configure,recordAssignment,history};
