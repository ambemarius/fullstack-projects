const crypto=require('node:crypto');
const { sql,pool,connect }=require('../../config/database');
const { authoritySql }=require('./schoolAccess');
const {teachingScopeSql}=require('./academicPermission');
const yearHistory=require('./yearOfferings');
const fail=(statusCode,message)=>Object.assign(new Error(message),{ statusCode });
const id=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
const terms=['First','Second','Third'];
function exact(input,keys) {
    if (!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!keys.includes(key))) throw fail(422,'Invalid academic link fields');
}
function validateBatch(input) {
    exact(input,['offeringId','yearId','changes']);
    if (!id(input.offeringId)||!id(input.yearId)||!Array.isArray(input.changes)||!input.changes.length||input.changes.length>100) throw fail(422,'Invalid enrolment batch');
    const seen=new Set();
    for(const change of input.changes) {
        exact(change,['studentId','action','version']);
        if (!id(change.studentId)||!['enrol','revoke'].includes(change.action)||!Number.isInteger(change.version)||change.version<0||change.version>2147483647||seen.has(change.studentId)) throw fail(422,'Invalid enrolment change');
        seen.add(change.studentId);
    }
    return input;
}
function createAcademicLinksService(access,database={ connect,getPool:()=>pool },{datedPlacement=false,yearOfferings=false}={}) {
    function bind(identity,req) {
        return req.input('school',sql.Int,identity.schoolId).input('account',sql.Int,identity.accountId)
            .input('membership',sql.Int,identity.membershipId).input('session_hash',sql.Char(64),identity.tokenHash)
            .input('role_one',sql.VarChar(30),identity.authorizedRole).input('role_two',sql.VarChar(30),null);
    }
    async function transaction(context,operation,lockMode='Exclusive') {
        const identity=await access.authorize(context,['admin']);await database.connect();
        const tx=new sql.Transaction(database.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request=()=>bind(identity,new sql.Request(tx));
        try {
            const lock=await request().input('resource',sql.NVarChar(255),`lms-academic-links:${identity.schoolId}`).input('mode',sql.NVarChar(32),lockMode).query(`
                DECLARE @result INT;EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode=@mode,@LockOwner='Transaction',@LockTimeout=10000;SELECT @result AS result;`);
            if(lock.recordset[0].result<0) throw fail(409,'Academic links are busy');
            if(!(await request().query(`SELECT 1 AS allowed WHERE ${authoritySql}`)).recordset.length) throw fail(403,'Access denied');
            const result=await operation(request);await tx.commit();return result;
        } catch(err) {
            await tx.rollback().catch(()=>{});
            if(err.statusCode) throw err;
            if([err,...(err.precedingErrors||[])].some(item=>[2601,2627].includes(item.number))) throw fail(409,'Academic link already exists');
            throw fail(500,'Academic link update failed');
        }
    }
    async function offering(request,offeringId) {
        const row=(await request().input('offering',sql.Int,offeringId).query(`SELECT o.id,o.class_id FROM dbo.class_subjects o
            JOIN dbo.classes c ON c.id=o.class_id AND c.school_id=o.school_id
            JOIN dbo.subjects s ON s.id=o.subject_id AND s.school_id=o.school_id WHERE o.id=@offering AND o.school_id=@school`)).recordset[0];
        if(!row) throw fail(404,'Offering not found');return row;
    }
    async function year(request,yearId,current=false) {
        const row=(await request().input('year',sql.Int,yearId).query('SELECT id,isCurrent FROM dbo.academic_years WHERE id=@year AND school_id=@school')).recordset[0];
        if(!row) throw fail(404,'Academic year not found');
        if(current&&!row.isCurrent) throw fail(409,'Only current-year links can be changed');
    }
    async function audit(request,type,resource,before,after,field) {
        await request().input('resource',sql.NVarChar(100),String(resource)).input('type',sql.VarChar(40),type)
            .input('request',sql.NVarChar(100),crypto.randomUUID()).input('before',sql.Int,before).input('after',sql.Int,after)
            .input('field',sql.NVarChar(500),field).query(`INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id,
                reason_code,resource_version_before,resource_version_after,changed_fields)
                VALUES(@school,@account,@membership,'academic_link_changed',@type,@resource,@request,'administrative',@before,@after,@field)`);
    }
    async function createOffering(context,input) {
        exact(input,['classId','subjectId','coefficient']);
        const coefficient=input.coefficient===undefined?1:input.coefficient;
        if(!id(input.classId)||!id(input.subjectId)||typeof coefficient!=='number'||!Number.isFinite(coefficient)||coefficient<=0||coefficient>99.99||Math.round(coefficient*100)/100!==coefficient) throw fail(422,'Invalid offering');
        return transaction(context,async request=>{
            const parents=(await request().input('class',sql.Int,input.classId).input('subject',sql.Int,input.subjectId).query(`
                SELECT c.id FROM dbo.classes c JOIN dbo.subjects s ON s.id=@subject AND s.school_id=c.school_id WHERE c.id=@class AND c.school_id=@school`)).recordset;
            if(!parents.length) throw fail(404,'Offering parent not found');
            const result=(await request().input('class',sql.Int,input.classId).input('subject',sql.Int,input.subjectId).input('coefficient',sql.Decimal(4,2),coefficient)
                .query('INSERT dbo.class_subjects(class_id,subject_id,coefficient,school_id) OUTPUT INSERTED.id VALUES(@class,@subject,@coefficient,@school)')).recordset[0];
            await audit(request,'offering',result.id,null,1,'class_id,subject_id,coefficient');return result;
        });
    }
    async function configureYear(context,input) {
        if(!yearOfferings)throw fail(404,'Year offerings are unavailable');
        yearHistory.validate(input);
        return transaction(context,async request=>{
            await offering(request,input.offeringId);await year(request,input.yearId,true);
            const result=await yearHistory.configure(request,input);
            await audit(request,'year_offering',input.offeringId,input.version||null,result.version,'coefficient,source_reference');
            return result;
        });
    }
    async function offeringHistory(context,offeringId,yearId) {
        if(!yearOfferings)throw fail(404,'Year offerings are unavailable');
        if(!id(offeringId)||!id(yearId))throw fail(422,'Invalid year offering scope');
        return transaction(context,async request=>{
            await offering(request,offeringId);await year(request,yearId);
            return yearHistory.history(request,offeringId,yearId);
        },'Shared');
    }
    async function enrol(context,input) {
        validateBatch(input);
        return transaction(context,async request=>{
            const root=await offering(request,input.offeringId);await year(request,input.yearId,true);
            if(yearOfferings&&input.changes.some(c=>c.action==='enrol')&&!await yearHistory.revision(request,input.offeringId,input.yearId))
                throw fail(409,'Configure the subject offering for this academic year first');
            const guard=require('./currentCoursePlacement');
            const onDate=datedPlacement&&input.changes.some(c=>c.action==='enrol')?await guard.schoolDate(request):null;
            const result=[];
            for(const change of input.changes) {
                const student=(await request().input('student',sql.Int,change.studentId).query(`SELECT id,isWithdrawn,currentClassLevel,academicYearId FROM dbo.students WHERE id=@student AND school_id=@school`)).recordset[0];
                if(!student) throw fail(404,'Pupil not found');
                const old=(await request().input('offering',sql.Int,input.offeringId).input('student',sql.Int,change.studentId).input('year',sql.Int,input.yearId)
                    .query('SELECT id,link_version,enrolment_status FROM dbo.class_subject_students WITH(UPDLOCK) WHERE school_id=@school AND class_subject_id=@offering AND student_id=@student AND academic_year_id=@year')).recordset[0];
                if((old?.link_version??0)!==change.version) throw fail(409,'Enrolment has changed');
                const status=change.action==='enrol'?'active':'revoked';
                if(change.action==='enrol'&&(student.isWithdrawn||student.currentClassLevel!==root.class_id||student.academicYearId!==input.yearId)) throw fail(409,'Pupil placement requires review');
                if(change.action==='enrol'&&datedPlacement)await guard.requirePlacement(request,change.studentId,root.class_id,input.yearId,onDate);
                if(change.action==='revoke') {
                    if(!old) throw fail(404,'Enrolment not found');
                    const scores=(await request().input('offering',sql.Int,input.offeringId).input('student',sql.Int,change.studentId).input('year',sql.Int,input.yearId)
                        .query('SELECT TOP(1) id FROM dbo.subject_scores WHERE school_id=@school AND class_subject_id=@offering AND student_id=@student AND academic_year_id=@year')).recordset;
                    if(scores.length) throw fail(409,'Recorded marks require a reviewed correction');
                }
                if(old?.enrolment_status===status) { result.push({ studentId:change.studentId,id:old.id,version:old.link_version,status });continue; }
                const req=request().input('offering',sql.Int,input.offeringId).input('student',sql.Int,change.studentId).input('year',sql.Int,input.yearId).input('status',sql.VarChar(10),status);
                const changed=(await req.query(old?`UPDATE dbo.class_subject_students SET enrolment_status=@status,link_version=link_version+1
                    OUTPUT INSERTED.id,INSERTED.link_version AS version WHERE school_id=@school AND class_subject_id=@offering AND student_id=@student AND academic_year_id=@year`:
                    `INSERT dbo.class_subject_students(class_subject_id,student_id,academic_year_id,school_id) OUTPUT INSERTED.id,INSERTED.link_version AS version VALUES(@offering,@student,@year,@school)`)).recordset[0];
                if(change.action==='enrol') await request().input('student',sql.Int,change.studentId).input('year',sql.Int,input.yearId).query(`IF NOT EXISTS(SELECT 1 FROM dbo.academic_year_students WHERE school_id=@school AND academic_year_id=@year AND student_id=@student)
                    INSERT dbo.academic_year_students(academic_year_id,student_id,school_id) VALUES(@year,@student,@school)`);
                await audit(request,'subject_enrolment',changed.id,old?.link_version??null,changed.version,'enrolment_status');
                result.push({ studentId:change.studentId,...changed,status });
            }
            return result;
        });
    }
    async function assign(context,input) {
        exact(input,['offeringId','yearId','teacherId','term','action','version']);
        if(![input.offeringId,input.yearId,input.teacherId].every(id)||!terms.includes(input.term)||!['assign','revoke'].includes(input.action)||!Number.isInteger(input.version)||input.version<0||input.version>2147483647) throw fail(422,'Invalid teaching assignment');
        return transaction(context,async request=>{
            await offering(request,input.offeringId);await year(request,input.yearId,true);
            const snapshot=yearOfferings?await yearHistory.revision(request,input.offeringId,input.yearId):0;
            if(yearOfferings&&input.action==='assign'&&!snapshot)throw fail(409,'Configure the subject offering for this academic year first');
            const teacher=(await request().input('teacher',sql.Int,input.teacherId).query('SELECT id,status FROM dbo.teachers WHERE school_id=@school AND id=@teacher')).recordset[0];
            if(!teacher) throw fail(404,'Teacher not found');
            if(input.action==='assign'&&teacher.status!=='active') throw fail(409,'Teacher is not active');
            const old=(await request().input('offering',sql.Int,input.offeringId).input('teacher',sql.Int,input.teacherId).input('year',sql.Int,input.yearId).input('term',sql.NVarChar(10),input.term)
                .query('SELECT id,assignment_status,link_version FROM dbo.class_subject_teachers WITH(UPDLOCK) WHERE school_id=@school AND class_subject_id=@offering AND teacher_id=@teacher AND academic_year_id=@year AND term=@term')).recordset[0];
            if((old?.link_version??0)!==input.version) throw fail(409,'Teaching assignment has changed');
            if(!old&&input.action==='revoke') throw fail(404,'Teaching assignment not found');
            const status=input.action==='assign'?'active':'revoked';
            if(old?.assignment_status===status) return { id:old.id,version:old.link_version,status };
            const req=request().input('offering',sql.Int,input.offeringId).input('teacher',sql.Int,input.teacherId).input('year',sql.Int,input.yearId)
                .input('term',sql.NVarChar(10),input.term).input('status',sql.VarChar(10),status);
            const result=(await req.query(old?`UPDATE dbo.class_subject_teachers SET assignment_status=@status,link_version=link_version+1 OUTPUT INSERTED.id,INSERTED.link_version AS version
                WHERE school_id=@school AND class_subject_id=@offering AND teacher_id=@teacher AND academic_year_id=@year AND term=@term`:
                `INSERT dbo.class_subject_teachers(class_subject_id,teacher_id,academic_year_id,term,school_id) OUTPUT INSERTED.id,INSERTED.link_version AS version VALUES(@offering,@teacher,@year,@term,@school)`)).recordset[0];
            if(input.action==='assign') await request().input('year',sql.Int,input.yearId).input('teacher',sql.Int,input.teacherId).query(`IF NOT EXISTS(SELECT 1 FROM dbo.academic_year_teachers WHERE school_id=@school AND academic_year_id=@year AND teacher_id=@teacher)
                INSERT dbo.academic_year_teachers(academic_year_id,teacher_id,school_id) VALUES(@year,@teacher,@school)`);
            if(yearOfferings)await yearHistory.recordAssignment(request,result,snapshot);
            await audit(request,'teaching_assignment',result.id,old?.link_version??null,result.version,'assignment_status');return { ...result,status };
        });
    }
    async function roster(context,offeringId,yearId,term) {
        if(!id(offeringId)||!id(yearId)||!terms.includes(term)) throw fail(422,'Invalid roster scope');
        const identity=await access.authorize(context,['admin','teacher']);await database.connect();
        const req=()=>bind(identity,database.getPool().request()).input('offering',sql.Int,offeringId).input('year',sql.Int,yearId).input('term',sql.NVarChar(10),term);
        const permission=teachingScopeSql;
        if(!(await req().query(`SELECT 1 AS allowed WHERE ${permission}`)).recordset.length) throw fail(404,'Roster not found');
        return (await req().query(`SELECT s.id,s.firstName,s.middleName,s.lastName,s.matricule,e.link_version AS version FROM dbo.class_subject_students e
            JOIN dbo.students s ON s.id=e.student_id AND s.school_id=e.school_id WHERE e.school_id=@school AND e.class_subject_id=@offering
                AND e.academic_year_id=@year AND e.enrolment_status='active' AND ${permission} ORDER BY s.id`)).recordset;
    }
    async function myEnrolments(context,yearId) {
        if(!id(yearId)) throw fail(422,'Invalid year');
        const identity=await access.authorize(context,['student']);await database.connect();
        return (await bind(identity,database.getPool().request()).input('year',sql.Int,yearId).query(`SELECT o.id AS offeringId,o.class_id,o.subject_id,c.name AS className,subject.name AS subjectName,e.enrolment_status AS status,e.link_version AS version
            FROM dbo.legacy_account_map l JOIN dbo.students s ON s.id=l.legacy_id AND s.school_id=l.school_id
            JOIN dbo.class_subject_students e ON e.student_id=s.id AND e.school_id=s.school_id
            JOIN dbo.class_subjects o ON o.id=e.class_subject_id AND o.school_id=e.school_id
            JOIN dbo.classes c ON c.id=o.class_id AND c.school_id=o.school_id
            JOIN dbo.subjects subject ON subject.id=o.subject_id AND subject.school_id=o.school_id
            WHERE l.source_table='students' AND l.school_id=@school AND l.account_id=@account AND l.membership_id=@membership AND l.reconciliation_status='verified'
                AND e.academic_year_id=@year AND ${authoritySql} ORDER BY o.id`)).recordset;
    }
    async function listOfferings(context) {
        const identity=await access.authorize(context,['admin']);await database.connect();
        return (await bind(identity,database.getPool().request()).query(`SELECT o.id,o.class_id,o.subject_id,o.coefficient FROM dbo.class_subjects o
            WHERE o.school_id=@school AND ${authoritySql} ORDER BY o.id`)).recordset;
    }
    async function linkList(context,offeringId,yearId,term=null) {
        if(!id(offeringId)||!id(yearId)||(term!==null&&!terms.includes(term))) throw fail(422,'Invalid academic link scope');
        const identity=await access.authorize(context,['admin']);await database.connect();
        const request=()=>bind(identity,database.getPool().request());
        await offering(request,offeringId);await year(request,yearId);
        const req=request().input('offering',sql.Int,offeringId).input('year',sql.Int,yearId);
        if(term!==null) req.input('term',sql.NVarChar(10),term);
        return (await req.query(term===null?`SELECT id,student_id AS studentId,enrolment_status AS status,link_version AS version
            FROM dbo.class_subject_students WHERE school_id=@school AND class_subject_id=@offering AND academic_year_id=@year AND ${authoritySql} ORDER BY id`:
            `SELECT id,teacher_id AS teacherId,assignment_status AS status,link_version AS version FROM dbo.class_subject_teachers
            WHERE school_id=@school AND class_subject_id=@offering AND academic_year_id=@year AND term=@term AND ${authoritySql} ORDER BY id`)).recordset;
    }
    async function myAssignments(context,yearId,term) {
        if(!id(yearId)||!terms.includes(term)) throw fail(422,'Invalid assignment scope');
        const identity=await access.authorize(context,['teacher']);await database.connect();
        return (await bind(identity,database.getPool().request()).input('year',sql.Int,yearId).input('term',sql.NVarChar(10),term).query(`
            SELECT a.id,a.class_subject_id AS offeringId,a.academic_year_id AS yearId,a.term,a.link_version AS version,o.class_id,o.subject_id,c.name AS className,subject.name AS subjectName
            FROM dbo.legacy_account_map l JOIN dbo.teachers t ON t.id=l.legacy_id AND t.school_id=l.school_id AND t.status='active'
            JOIN dbo.class_subject_teachers a ON a.teacher_id=t.id AND a.school_id=t.school_id
            JOIN dbo.class_subjects o ON o.id=a.class_subject_id AND o.school_id=a.school_id
            JOIN dbo.classes c ON c.id=o.class_id AND c.school_id=o.school_id
            JOIN dbo.subjects subject ON subject.id=o.subject_id AND subject.school_id=o.school_id
            WHERE l.source_table='teachers' AND l.school_id=@school AND l.account_id=@account AND l.membership_id=@membership AND l.reconciliation_status='verified'
                AND a.academic_year_id=@year AND a.term=@term AND a.assignment_status='active' AND ${authoritySql} ORDER BY a.id`)).recordset;
    }
    async function myTimetable(context,yearId,term) {
        if (!id(yearId) || !terms.includes(term)) throw fail(422,'Invalid timetable scope');
        const identity = await access.authorize(context,['teacher','student']);
        await database.connect();
        const request = () => bind(identity,database.getPool().request());
        const lessonRequest = request().input('year',sql.Int,yearId).input('term',sql.NVarChar(10),term);
        const teacher = identity.authorizedRole === 'teacher';
        let placement = '';
        if (!teacher && datedPlacement) {
            const today = await require('./currentCoursePlacement').schoolDate(request);
            lessonRequest.input('today',sql.Date,today);
            placement = `AND EXISTS (
                SELECT 1 FROM dbo.student_enrolments e
                JOIN dbo.student_enrolment_revisions r ON r.school_id=e.school_id AND r.enrolment_id=e.id
                WHERE e.school_id=p.school_id AND e.student_id=p.id AND r.status<>'voided'
                    AND r.effective_from<=@today AND (r.effective_to IS NULL OR @today<r.effective_to)
                    AND NOT EXISTS (SELECT 1 FROM dbo.student_enrolment_revisions newer
                        WHERE newer.school_id=r.school_id AND newer.enrolment_id=r.enrolment_id AND newer.revision>r.revision)
                HAVING COUNT(*)=1 AND MAX(r.class_id)=tt.class_id AND MAX(r.academic_year_id)=@year AND MAX(r.status)='enrolled')`;
        }
        const profile = teacher
            ? "l.source_table='teachers' AND l.legacy_id=tt.teacher_id"
            : `l.source_table='students' AND EXISTS (
                SELECT 1 FROM dbo.students p
                JOIN dbo.class_subject_students en ON en.school_id=p.school_id AND en.student_id=p.id
                WHERE p.school_id=l.school_id AND p.id=l.legacy_id AND p.isWithdrawn=0
                    AND p.currentClassLevel=tt.class_id AND p.academicYearId=@year
                    AND en.class_subject_id=o.id AND en.academic_year_id=@year AND en.enrolment_status='active'
                    ${placement})`;
        return (await lessonRequest.query(`
            SELECT tt.day_of_week AS day,tt.start_time AS startTime,tt.end_time AS endTime,tt.room,
                c.name AS className,c.stream,s.name AS subjectName,t.name AS teacherName,y.name AS yearName
            FROM dbo.timetables tt
            JOIN dbo.academic_years y ON y.school_id=tt.school_id AND y.id=tt.academic_year_id AND y.isCurrent=1
            JOIN dbo.classes c ON c.school_id=tt.school_id AND c.id=tt.class_id
            JOIN dbo.subjects s ON s.school_id=tt.school_id AND s.id=tt.subject_id
            JOIN dbo.teachers t ON t.school_id=tt.school_id AND t.id=tt.teacher_id AND t.status='active'
            WHERE tt.school_id=@school AND tt.academic_year_id=@year AND tt.academic_term=@term
                AND EXISTS (SELECT 1 FROM dbo.class_subjects o
                    JOIN dbo.class_subject_teachers a ON a.school_id=o.school_id AND a.class_subject_id=o.id
                    WHERE o.school_id=tt.school_id AND o.class_id=tt.class_id AND o.subject_id=tt.subject_id
                        AND a.teacher_id=tt.teacher_id AND a.academic_year_id=@year AND a.term=@term AND a.assignment_status='active'
                        AND EXISTS (SELECT 1 FROM dbo.legacy_account_map l WHERE l.school_id=@school AND l.account_id=@account
                            AND l.membership_id=@membership AND l.reconciliation_status='verified' AND ${profile}))
                AND ${authoritySql}
            ORDER BY CASE tt.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
                WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END,tt.start_time,tt.end_time,tt.id`)).recordset;
    }
    return { createOffering,configureYear,offeringHistory,enrol,assign,roster,myEnrolments,listOfferings,linkList,myAssignments,myTimetable };
}
module.exports={ createAcademicLinksService,validateEnrolmentBatch:validateBatch };
