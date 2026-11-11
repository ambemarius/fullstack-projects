const crypto=require('node:crypto');
const {sql,pool,connect}=require('../../config/database');
const {teachingScopeSql}=require('./academicPermission');
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const id=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
const decimal=value=>typeof value==='number'&&Number.isFinite(value)&&Math.round(value*100)/100===value;
function scope(value){if(!value||!id(value.offeringId)||!id(value.yearId)||!['First','Second','Third'].includes(value.term))throw fail(422,'Invalid mark scope');}
function validateBatch(input){scope(input);if(Object.keys(input).some(key=>!['offeringId','yearId','term','scores'].includes(key))||!Array.isArray(input.scores)||!input.scores.length||input.scores.length>200)throw fail(422,'Invalid mark batch');
    const seen=new Set();for(const row of input.scores){if(!row||Object.keys(row).some(key=>!['studentId','sequence','score','maxScore','version'].includes(key))||!id(row.studentId)||![1,2].includes(row.sequence)||!decimal(row.score)||!decimal(row.maxScore)||row.maxScore<=0||row.maxScore>999.99||row.score<0||row.score>row.maxScore||!Number.isInteger(row.version)||row.version<0||row.version>2147483647)throw fail(422,'Invalid score or version');const key=`${row.studentId}:${row.sequence}`;if(seen.has(key))throw fail(422,'Duplicate pupil sequence');seen.add(key);}return input;
}
function createMarksService(access,database={connect,getPool:()=>pool},{datedPlacement=false}={}){
    function request(identity,root,tx){return(tx?new sql.Request(tx):database.getPool().request()).input('school',sql.Int,identity.schoolId)
        .input('account',sql.Int,identity.accountId).input('membership',sql.Int,identity.membershipId).input('session_hash',sql.Char(64),identity.tokenHash)
        .input('role_one',sql.VarChar(30),identity.authorizedRole).input('role_two',sql.VarChar(30),null)
        .input('offering',sql.Int,root.offeringId).input('year',sql.Int,root.yearId).input('term',sql.NVarChar(10),root.term);}
    async function sheet(context,root){scope(root);const identity=await access.authorize(context,['admin','teacher']);await database.connect();
        if(!(await request(identity,root).query(`SELECT 1 AS allowed WHERE ${teachingScopeSql}`)).recordset.length)throw fail(404,'Mark sheet not found');
        const result=await request(identity,root).query(`SELECT s.id AS studentId,s.firstName,s.middleName,s.lastName,s.matricule,
            m.id AS markId,m.sequence,m.score,m.max_score AS maxScore,m.score_version AS version
            FROM dbo.class_subject_students e JOIN dbo.students s ON s.id=e.student_id AND s.school_id=e.school_id
            LEFT JOIN dbo.subject_scores m ON m.student_id=s.id AND m.class_subject_id=e.class_subject_id AND m.academic_year_id=e.academic_year_id
                AND m.school_id=e.school_id AND m.term=@term
            WHERE e.school_id=@school AND e.class_subject_id=@offering AND e.academic_year_id=@year AND e.enrolment_status='active'
                AND ${teachingScopeSql} ORDER BY s.id,m.sequence`);return result.recordset;
    }
    async function save(context,input){validateBatch(input);const identity=await access.authorize(context,['admin','teacher']);await database.connect();
        const tx=new sql.Transaction(database.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const req=()=>request(identity,input,tx);
        try{const lock=await req().input('resource',sql.NVarChar(255),`lms-marks:${identity.schoolId}:${input.offeringId}:${input.yearId}:${input.term}`).query(`DECLARE @r INT;EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;SELECT @r AS result;`);
            if(lock.recordset[0].result<0)throw fail(409,'Mark sheet is busy');
            if(!(await req().query(`SELECT 1 AS allowed WHERE ${teachingScopeSql}`)).recordset.length)throw fail(404,'Mark sheet not found');
            if(!(await req().query('SELECT id FROM dbo.academic_years WHERE id=@year AND school_id=@school AND isCurrent=1')).recordset.length)throw fail(409,'Historical mark corrections require review');
            const guard=require('./currentCoursePlacement'),onDate=datedPlacement?await guard.schoolDate(req):null;
            const requestId=crypto.randomUUID(),saved=[];for(const row of input.scores){const enrolled=(await req().input('student',sql.Int,row.studentId).query(`
                SELECT s.id,o.class_id FROM dbo.class_subject_students e JOIN dbo.students s ON s.id=e.student_id AND s.school_id=e.school_id
                JOIN dbo.class_subjects o ON o.id=e.class_subject_id AND o.school_id=e.school_id
                WHERE e.school_id=@school AND e.class_subject_id=@offering AND e.academic_year_id=@year AND e.student_id=@student
                    AND e.enrolment_status='active' AND s.isWithdrawn=0 AND s.academicYearId=@year AND s.currentClassLevel=o.class_id`)).recordset;
                if(!enrolled.length)throw fail(404,'Active pupil enrolment not found');
                if(datedPlacement)await guard.requirePlacement(req,row.studentId,enrolled[0].class_id,input.yearId,onDate);
                const old=(await req().input('student',sql.Int,row.studentId).input('sequence',sql.TinyInt,row.sequence).query(`SELECT id,score_version FROM dbo.subject_scores WITH(UPDLOCK)
                    WHERE school_id=@school AND student_id=@student AND class_subject_id=@offering AND academic_year_id=@year AND term=@term AND sequence=@sequence`)).recordset[0];
                if((old?.score_version??0)!==row.version)throw fail(409,'A score changed since this sheet was opened. Review the latest sheet before retrying.');
                const result=(await req().input('student',sql.Int,row.studentId).input('sequence',sql.TinyInt,row.sequence).input('score',sql.Decimal(5,2),row.score).input('max',sql.Decimal(5,2),row.maxScore).query(old?`
                    UPDATE dbo.subject_scores SET score=@score,max_score=@max,score_version=score_version+1,last_editor_account_id=@account,last_editor_membership_id=@membership,updated_at=SYSUTCDATETIME()
                    OUTPUT INSERTED.id,INSERTED.score_version AS version WHERE school_id=@school AND student_id=@student AND class_subject_id=@offering AND academic_year_id=@year AND term=@term AND sequence=@sequence`:
                    `INSERT dbo.subject_scores(student_id,class_subject_id,academic_year_id,term,sequence,score,max_score,school_id,last_editor_account_id,last_editor_membership_id)
                    OUTPUT INSERTED.id,INSERTED.score_version AS version VALUES(@student,@offering,@year,@term,@sequence,@score,@max,@school,@account,@membership)`)).recordset[0];
                await req().input('resource',sql.NVarChar(100),String(result.id)).input('request',sql.NVarChar(100),requestId).input('before',sql.Int,old?.score_version??null).input('after',sql.Int,result.version).query(`
                    INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id,resource_version_before,resource_version_after,changed_fields)
                    VALUES(@school,@account,@membership,'score_saved','subject_score',@resource,@request,@before,@after,'score,max_score')`);
                saved.push({studentId:row.studentId,sequence:row.sequence,...result});}
            await tx.commit();return saved;
        }catch(err){await tx.rollback().catch(()=>{});if(err.statusCode)throw err;throw fail(500,'Mark batch failed');}
    }
    return{sheet,save};
}
module.exports={createMarksService,validateMarkBatch:validateBatch};
