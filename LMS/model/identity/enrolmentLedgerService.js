const crypto = require('node:crypto');
const { sql, pool, connect } = require('../../config/database');
const { authoritySql } = require('./schoolAccess');
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const id = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function exact(input, keys) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) throw fail(422, 'Invalid enrolment fields');
}
function provenance(input) {
    for (const [key, max] of [['sourceReference', 200], ['reason', 500]]) {
        if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max || /[\u0000-\u001f\u007f]/.test(input[key])) throw fail(422, 'An explicit source reference and reason are required');
    }
}
function validatePlacement(input, revision = false) {
    exact(input, ['classId', 'yearId', 'fromDate', 'toDate', 'status', 'sourceReference', 'reason', revision ? 'version' : 'studentId']);
    if (![input.classId, input.yearId, revision ? input.version : input.studentId].every(id) || (revision && input.version === 2147483647) ||
        !date(input.fromDate) || !(input.toDate === null || date(input.toDate)) ||
        (input.toDate !== null && input.toDate <= input.fromDate) ||
        !(revision ? ['enrolled', 'transferred', 'withdrawn', 'completed', 'voided'] : ['enrolled', 'withdrawn', 'completed']).includes(input.status) ||
        (!['enrolled', 'voided'].includes(input.status) && input.toDate === null)) throw fail(422, 'Invalid enrolment period or status');
    provenance(input); return input;
}
function validateTransfer(input) {
    exact(input, ['version', 'classId', 'yearId', 'onDate', 'toDate', 'sourceReference', 'reason']);
    if (![input.version, input.classId, input.yearId].every(id) || input.version === 2147483647 || !date(input.onDate) ||
        !(input.toDate === null || date(input.toDate)) || (input.toDate !== null && input.toDate <= input.onDate)) throw fail(422, 'Invalid transfer period');
    provenance(input); return input;
}
function validateCurrentTransfer(input) {
    exact(input, ['version', 'profileVersion', 'classId', 'yearId', 'onDate', 'sourceReference', 'reason']);
    if (!id(input.profileVersion) || input.profileVersion === 2147483647) throw fail(422, 'Invalid pupil version');
    const { profileVersion, ...fields } = input;
    validateTransfer({ ...fields, toDate: null }); return input;
}
const latest = `NOT EXISTS(SELECT 1 FROM dbo.student_enrolment_revisions newer
    WHERE newer.school_id=r.school_id AND newer.enrolment_id=r.enrolment_id AND newer.revision>r.revision)`;
const columns = `r.enrolment_id AS id,r.revision AS version,r.class_id AS classId,r.academic_year_id AS yearId,
    CONVERT(char(10),r.effective_from,23) AS fromDate,CONVERT(char(10),r.effective_to,23) AS toDate,r.status,
    r.source_reference AS sourceReference,r.reason,r.actor_account_id AS actorAccountId,r.actor_membership_id AS actorMembershipId,
    r.operation_id AS operationId,r.recorded_at AS recordedAt`;

function checkEffectiveDate(onDate, timezone) {
    let today;
    try { today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch { throw fail(409, 'School time zone requires review'); }
    if (onDate > today) throw fail(422, 'Placement change cannot take effect in the future');
}
async function destinationCourses(request, studentId, input, section) {
    const destination = (await request().input('class', sql.Int, input.classId).input('year', sql.Int, input.yearId)
        .input('section', sql.NVarChar(20), section).query(`
        SELECT c.id FROM dbo.classes c JOIN dbo.academic_years y ON y.school_id=c.school_id AND y.id=@year AND y.isCurrent=1
        WHERE c.school_id=@school AND c.id=@class AND c.section=@section AND ${authoritySql}`)).recordset;
    if (!destination.length) throw fail(404, 'Current placement destination not found');
    const activeLinks = (await request().input('student', sql.Int, studentId).input('class', sql.Int, input.classId)
        .input('year', sql.Int, input.yearId).query(`
        SELECT TOP(101) e.id,e.link_version AS version,s.name FROM dbo.class_subject_students e
        JOIN dbo.class_subjects o ON o.school_id=e.school_id AND o.id=e.class_subject_id
        JOIN dbo.subjects s ON s.school_id=o.school_id AND s.id=o.subject_id
        WHERE e.school_id=@school AND e.student_id=@student AND o.class_id=@class AND e.academic_year_id=@year
            AND e.enrolment_status='active' AND ${authoritySql} ORDER BY e.id`)).recordset;
    if (activeLinks.length>100) throw fail(409,'Course list exceeds review limit');
    return activeLinks;
}

async function parents(request, input) {
    const rows = (await request().input('class', sql.Int, input.classId).input('year', sql.Int, input.yearId).query(`
        SELECT c.id FROM dbo.classes c JOIN dbo.academic_years y ON y.school_id=c.school_id AND y.id=@year
        WHERE c.school_id=@school AND c.id=@class AND ${authoritySql}`)).recordset;
    if (!rows.length) throw fail(404, 'Enrolment parent not found');
}
async function current(request, enrolmentId, version) {
    const row = (await request().input('id', sql.Int, enrolmentId).query(`SELECT ${columns} FROM dbo.student_enrolment_revisions r
        WHERE r.school_id=@school AND r.enrolment_id=@id AND ${latest} AND ${authoritySql}`)).recordset[0];
    if (!row) throw fail(404, 'Enrolment not found');
    if (row.version !== version) throw fail(409, 'Enrolment has changed'); return row;
}
async function noOverlap(request, studentId, input, excludedId = null) {
    if (input.status === 'voided') return;
    const rows = (await request().input('student', sql.Int, studentId).input('excluded', sql.Int, excludedId)
        .input('from', sql.Date, input.fromDate).input('to', sql.Date, input.toDate).query(`
        SELECT TOP(1) e.id FROM dbo.student_enrolments e JOIN dbo.student_enrolment_revisions r ON r.school_id=e.school_id AND r.enrolment_id=e.id
        WHERE e.school_id=@school AND e.student_id=@student AND (@excluded IS NULL OR e.id<>@excluded)
            AND ${latest} AND r.status<>'voided' AND (@to IS NULL OR r.effective_from<@to)
            AND (r.effective_to IS NULL OR @from<r.effective_to) AND ${authoritySql}`)).recordset;
    if (rows.length) throw fail(409, 'Enrolment periods overlap');
}
async function append(request, enrolmentId, version, input, operationId) {
    const rows = (await request().input('id', sql.Int, enrolmentId).input('version', sql.Int, version)
        .input('previous', sql.Int, version === 1 ? null : version - 1).input('class', sql.Int, input.classId).input('year', sql.Int, input.yearId)
        .input('from', sql.Date, input.fromDate).input('to', sql.Date, input.toDate).input('status', sql.VarChar(12), input.status)
        .input('source', sql.NVarChar(200), input.sourceReference.trim()).input('reason', sql.NVarChar(500), input.reason.trim())
        .input('operation', sql.UniqueIdentifier, operationId).query(`DECLARE @added TABLE(id INT,version INT);
        INSERT dbo.student_enrolment_revisions
        (school_id,enrolment_id,revision,previous_revision,class_id,academic_year_id,effective_from,effective_to,status,source_reference,reason,actor_account_id,actor_membership_id,operation_id)
        OUTPUT INSERTED.enrolment_id,INSERTED.revision INTO @added
        SELECT @school,@id,@version,@previous,@class,@year,@from,@to,@status,@source,@reason,@account,@membership,@operation WHERE ${authoritySql};
        SELECT id,version FROM @added`)).recordset;
    if (!rows.length) throw fail(403, 'Access denied');
    await request().input('id', sql.NVarChar(100), String(enrolmentId)).input('operation', sql.NVarChar(100), operationId)
        .query(`INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id)
            SELECT @school,@account,@membership,'enrolment_revision_recorded','student_enrolment',@id,@operation WHERE ${authoritySql};
            IF @@ROWCOUNT<>1 THROW 50112,'Enrolment authority lost',1;`);
    return rows[0];
}
async function newRoot(request, studentId) {
    const row = (await request().input('student', sql.Int, studentId).query(`INSERT dbo.student_enrolments(school_id,student_id)
        OUTPUT INSERTED.id SELECT @school,@student WHERE ${authoritySql}`)).recordset[0];
    if (!row) throw fail(403, 'Access denied'); return row.id;
}

// Internal composition boundary: callers supply the same SERIALIZABLE transaction and
// server-bound authority on every request. This never opens or commits a transaction.
async function recordEnrolmentInTransaction(makeRequest, input) {
    validatePlacement(input);
    const first = makeRequest(), transaction = first.parent;
    if (!(transaction instanceof sql.Transaction) || transaction.isolationLevel !== sql.ISOLATION_LEVEL.SERIALIZABLE)
        throw new Error('Enrolment composition requires a serializable transaction');
    const request = () => {
        const req = makeRequest();
        if (req.parent !== transaction) throw new Error('Enrolment transaction changed');
        return req;
    };
    const lock = (await first.input('student', sql.Int, input.studentId).query(`
        DECLARE @resource nvarchar(255)=CONCAT('lms-enrolment:',@school,':',@student),@result int;
        EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        SELECT @result result;`)).recordset[0];
    if (lock.result < 0) throw fail(409, 'Enrolment is busy');
    const pupil = (await request().input('student', sql.Int, input.studentId).query(`SELECT id FROM dbo.students
        WHERE school_id=@school AND id=@student AND ${authoritySql}`)).recordset;
    if (!pupil.length) throw fail(404, 'Pupil not found');
    await parents(request, input); await noOverlap(request, input.studentId, input);
    return append(request, await newRoot(request, input.studentId), 1, input, crypto.randomUUID());
}

function createEnrolmentLedgerService(access, database = { connect, getPool: () => pool }) {
    const bind = (identity, request) => request.input('school', sql.Int, identity.schoolId).input('account', sql.Int, identity.accountId)
        .input('membership', sql.Int, identity.membershipId).input('session_hash', sql.Char(64), identity.tokenHash)
        .input('role_one', sql.VarChar(30), 'admin').input('role_two', sql.VarChar(30), null);
    async function write(context, studentId, enrolmentId, operation, academicLock = false) {
        const identity = await access.authorize(context, ['admin']); await database.connect();
        const tx = new sql.Transaction(database.getPool()); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request = () => bind(identity, new sql.Request(tx));
        try {
            // Match academic enrolment's lock order before reading/changing the pupil projection.
            if (academicLock) {
                const result = (await request().input('resource', sql.NVarChar(255), `lms-academic-links:${identity.schoolId}`).query(`
                    DECLARE @result INT;EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
                    SELECT @result AS result;`)).recordset[0];
                if (result.result < 0) throw fail(409, 'Academic placement is busy');
            }
            if (enrolmentId) {
                const root = (await request().input('id', sql.Int, enrolmentId).query(`SELECT student_id FROM dbo.student_enrolments
                    WHERE school_id=@school AND id=@id AND ${authoritySql}`)).recordset[0];
                if (!root) throw fail(404, 'Enrolment not found'); studentId = root.student_id;
            }
            const lock = (await request().input('resource', sql.NVarChar(255), `lms-enrolment:${identity.schoolId}:${studentId}`).query(`
                DECLARE @result INT;EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
                SELECT @result AS result;`)).recordset[0];
            if (lock.result < 0) throw fail(409, 'Enrolment is busy');
            if (!(await request().query(`SELECT 1 allowed WHERE ${authoritySql}`)).recordset.length) throw fail(403, 'Access denied');
            if (!(await request().input('student', sql.Int, studentId).query(`SELECT id FROM dbo.students WHERE school_id=@school AND id=@student AND ${authoritySql}`)).recordset.length) throw fail(404, 'Pupil not found');
            const result = await operation(request, studentId, crypto.randomUUID());
            await tx.commit(); return result;
        } catch (error) {
            await tx.rollback().catch(() => {});
            if (error.statusCode) throw error;
            if ([error,...(error.precedingErrors || [])].some(e=>e.number===50131)) throw fail(409,'Archived year placements are read-only');
            if ([error, ...(error.precedingErrors || [])].some(e => [1205, 2601, 2627].includes(e.number))) throw fail(409, 'Enrolment has changed; reload before retrying');
            throw fail(500, 'Enrolment update failed');
        }
    }
    async function record(context, input) {
        validatePlacement(input);
        return write(context, input.studentId, null, request => recordEnrolmentInTransaction(request, input));
    }
    async function revise(context, enrolmentId, input) {
        if (!id(enrolmentId)) throw fail(422, 'Invalid enrolment'); validatePlacement(input, true);
        return write(context, null, enrolmentId, async (request, studentId, operationId) => {
            await current(request, enrolmentId, input.version); await parents(request, input); await noOverlap(request, studentId, input, enrolmentId);
            return append(request, enrolmentId, input.version + 1, input, operationId);
        });
    }
    async function move(request, studentId, old, input, operationId) {
        if (old.status !== 'enrolled' || input.onDate <= old.fromDate || (old.toDate !== null && input.onDate >= old.toDate) ||
            (old.classId === input.classId && old.yearId === input.yearId)) throw fail(409, 'Transfer requires an enrolled placement and an interior transfer date');
        await parents(request, input);
        const closed = { ...old, toDate: input.onDate, status: 'transferred', sourceReference: input.sourceReference, reason: input.reason };
        const next = { ...input, fromDate: input.onDate, status: 'enrolled' };
        await noOverlap(request, studentId, next, old.id);
        const source = await append(request, old.id, input.version + 1, closed, operationId);
        const destination = await append(request, await newRoot(request, studentId), 1, next, operationId);
        return { source, destination, operationId };
    }
    async function transfer(context, enrolmentId, input) {
        if (!id(enrolmentId)) throw fail(422, 'Invalid enrolment'); validateTransfer(input);
        return write(context, null, enrolmentId, async (request, studentId, operationId) =>
            move(request, studentId, await current(request, enrolmentId, input.version), input, operationId));
    }
    // Staged current-placement workflow. Historical correction remains a separate review.
    async function transferCurrent(context, enrolmentId, input) {
        if (!id(enrolmentId)) throw fail(422, 'Invalid enrolment'); validateCurrentTransfer(input);
        return write(context, null, enrolmentId, async (request, studentId, operationId) => {
            const old = await current(request, enrolmentId, input.version);
            const pupil = (await request().input('student', sql.Int, studentId).query(`
                SELECT s.profile_version,s.currentClassLevel,s.academicYearId,s.isWithdrawn,s.section,z.timezone
                FROM dbo.students s WITH(UPDLOCK) JOIN dbo.schools z ON z.id=s.school_id
                WHERE s.school_id=@school AND s.id=@student AND ${authoritySql}`)).recordset[0];
            if (!pupil) throw fail(404, 'Pupil not found');
            if (pupil.profile_version !== input.profileVersion || pupil.isWithdrawn || old.status !== 'enrolled' || old.toDate !== null ||
                pupil.currentClassLevel !== old.classId || pupil.academicYearId !== old.yearId)
                throw fail(409, 'Current placement requires review');
            checkEffectiveDate(input.onDate, pupil.timezone);
            if ((await destinationCourses(request, studentId, input, pupil.section)).length) throw fail(409, 'Existing destination course enrolments require review');
            const sourceYear = (await request().input('student', sql.Int, studentId).input('year', sql.Int, old.yearId).query(`
                SELECT student_id FROM dbo.academic_year_students WHERE school_id=@school AND student_id=@student AND academic_year_id=@year AND ${authoritySql}`)).recordset;
            if (!sourceYear.length) throw fail(409, 'Source year membership requires review');
            const { profileVersion, ...fields } = input;
            const moved = await move(request, studentId, old, { ...fields, toDate: null }, operationId);
            const updated = (await request().input('student', sql.Int, studentId).input('version', sql.Int, profileVersion)
                .input('class', sql.Int, input.classId).input('year', sql.Int, input.yearId).query(`
                UPDATE dbo.students SET currentClassLevel=@class,academicYearId=@year,profile_version=profile_version+1
                OUTPUT INSERTED.id,INSERTED.profile_version AS version
                WHERE school_id=@school AND id=@student AND profile_version=@version AND ${authoritySql};
                IF NOT EXISTS(SELECT 1 FROM dbo.academic_year_students WHERE school_id=@school AND student_id=@student AND academic_year_id=@year)
                    INSERT dbo.academic_year_students(school_id,student_id,academic_year_id)
                    SELECT @school,@student,@year WHERE ${authoritySql};`)).recordset[0];
            if (!updated) throw fail(409, 'Pupil has changed');
            await request().input('student', sql.NVarChar(100), String(studentId)).input('before', sql.Int, profileVersion)
                .input('after', sql.Int, updated.version).input('operation', sql.NVarChar(100), operationId).query(`
                INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id,
                    resource_version_before,resource_version_after,changed_fields,reason_code)
                SELECT @school,@account,@membership,'pupil_placement_transferred','student',@student,@operation,
                    @before,@after,'currentClassLevel,academicYearId','administrative' WHERE ${authoritySql};
                IF @@ROWCOUNT<>1 THROW 50112,'Transfer authority lost',1;`);
            return { ...moved, pupil: updated };
        }, true);
    }
    async function read(context) {
        const identity = await access.authorize(context, ['admin']); await database.connect();
        return bind(identity, database.getPool().request());
    }
    async function history(context, studentId) {
        if (!id(studentId)) throw fail(422, 'Invalid pupil');
        const req = (await read(context)).input('student', sql.Int, studentId);
        const sets = (await req.query(`SELECT id FROM dbo.students WHERE school_id=@school AND id=@student AND ${authoritySql};
            SELECT TOP(1001) ${columns},CAST(CASE WHEN ${latest} THEN 1 ELSE 0 END AS BIT) AS isLatest
            FROM dbo.student_enrolments e JOIN dbo.student_enrolment_revisions r ON r.school_id=e.school_id AND r.enrolment_id=e.id
            WHERE e.school_id=@school AND e.student_id=@student AND ${authoritySql} ORDER BY e.id,r.revision;`)).recordsets;
        if (!sets[0].length) throw fail(404, 'Pupil not found');
        if (sets[1].length > 1000) throw fail(409, 'Enrolment history exceeds review limit'); return sets[1];
    }
    async function roster(context, input) {
        exact(input, ['classId', 'yearId', 'onDate', 'afterStudentId']);
        if (![input.classId, input.yearId].every(id) || !date(input.onDate) ||
            (input.afterStudentId !== undefined && !id(input.afterStudentId))) throw fail(422, 'Invalid roster scope');
        const req = (await read(context)).input('class', sql.Int, input.classId).input('year', sql.Int, input.yearId)
            .input('on', sql.Date, input.onDate).input('after', sql.Int, input.afterStudentId || 0);
        const sets = (await req.query(`SELECT c.id FROM dbo.classes c JOIN dbo.academic_years y ON y.school_id=c.school_id AND y.id=@year
            WHERE c.school_id=@school AND c.id=@class AND ${authoritySql};
            SELECT TOP(101) e.student_id AS studentId,e.id AS enrolmentId,r.revision AS version
            FROM dbo.student_enrolments e JOIN dbo.student_enrolment_revisions r ON r.school_id=e.school_id AND r.enrolment_id=e.id
            JOIN dbo.students s ON s.school_id=e.school_id AND s.id=e.student_id
            WHERE e.school_id=@school AND r.class_id=@class AND r.academic_year_id=@year AND ${latest}
                AND r.status<>'voided' AND r.effective_from<=@on AND (r.effective_to IS NULL OR @on<r.effective_to)
                AND e.student_id>@after AND ${authoritySql} ORDER BY e.student_id,e.id;`)).recordsets;
        if (!sets[0].length) throw fail(404, 'Roster scope not found');
        return { rows: sets[1].slice(0, 100), nextAfterStudentId: sets[1].length > 100 ? sets[1][99].studentId : null };
    }
    async function changeStatus(context, enrolmentId, action, input) {
        if (!id(enrolmentId) || !['withdraw','return'].includes(action)) throw fail(422, 'Invalid pupil status action');
        const returning = action === 'return';
        exact(input, ['version','profileVersion','onDate','sourceReference','reason',...(returning ? ['classId','yearId','reviewedCourses'] : [])]);
        const numbers = [input.version,input.profileVersion];
        if (!numbers.every(value => id(value) && value < 2147483647) || !date(input.onDate) ||
            (returning && ![input.classId,input.yearId].every(id))) throw fail(422, 'Invalid status date or version');
        provenance(input);
        const reviewed = input.reviewedCourses===undefined ? [] : input.reviewedCourses;
        if (!Array.isArray(reviewed) || reviewed.length>100) throw fail(422,'Invalid reviewed courses');
        const versions = new Map();
        for (const item of reviewed) {
            exact(item,['id','version']);
            if (!id(item.id)||!id(item.version)||versions.has(item.id)) throw fail(422,'Invalid reviewed courses');
            versions.set(item.id,item.version);
        }
        return write(context, null, enrolmentId, async (request, studentId, operationId) => {
            const old = await current(request, enrolmentId, input.version);
            const pupil = await require('./pupilAccessLifecycle').loadPupil(request, studentId, old, input.profileVersion, returning);
            checkEffectiveDate(input.onDate, pupil.timezone);
            let entry;
            if (returning) {
                if (old.status !== 'withdrawn' || !old.toDate || input.onDate < old.toDate) throw fail(409, 'Review the withdrawal period before returning the pupil');
                const courses=await destinationCourses(request, studentId, input, pupil.section);
                if(courses.length!==versions.size || courses.some(c=>versions.get(c.id)!==c.version))
                    throw fail(409,'Review the active destination subjects before recording this return');
                const next = { ...input, fromDate:input.onDate, toDate:null, status:'enrolled' };
                await noOverlap(request, studentId, next);
                entry = await append(request, await newRoot(request, studentId), 1, next, operationId);
            } else {
                if (old.status !== 'enrolled' || old.toDate !== null || input.onDate <= old.fromDate) throw fail(409, 'Withdrawal must follow the start of an open placement');
                entry = await append(request, enrolmentId, old.version + 1, { ...old,toDate:input.onDate,status:'withdrawn',
                    sourceReference:input.sourceReference,reason:input.reason }, operationId);
            }
            await require('./pupilAccessLifecycle').applyChange(request, pupil, old, entry, input, returning, operationId);
            return { enrolment:entry, pupil:{ id:studentId, version:input.profileVersion+1 }, operationId };
        }, true);
    }
    async function returnCourses(context,enrolmentId,input) {
        exact(input,['version','profileVersion','classId','yearId']);
        if (![enrolmentId,input.version,input.profileVersion,input.classId,input.yearId].every(id)) throw fail(422,'Invalid return review scope');
        return write(context,null,enrolmentId,async(request,studentId)=>{
            const old=await current(request,enrolmentId,input.version);
            if(old.status!=='withdrawn'||!old.toDate)throw fail(409,'Review the pupil withdrawal first');
            const pupil=await require('./pupilAccessLifecycle').loadPupil(request,studentId,old,input.profileVersion,true);
            return destinationCourses(request,studentId,input,pupil.section);
        },true);
    }
    return { record, revise, transfer, transferCurrent, history, roster, changeStatus, returnCourses };
}
module.exports = { createEnrolmentLedgerService, recordEnrolmentInTransaction, validatePlacement, validateTransfer, validateCurrentTransfer, validLedgerDate: date };
