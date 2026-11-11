const {sql}=require('../../config/database');
const {authoritySql}=require('./schoolAccess');
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const positive=value=>Number.isInteger(value)&&value>0&&value<=2147483647;
function validDate(value){
    return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value>='0001-01-01' &&
        Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}

function createAttendanceService(access,database){
    async function authorize(context){
        const identity=await access.authorize(context,['discipline_master']);
        await database.connect();
        return request=>request.input('school',sql.Int,identity.schoolId)
            .input('account',sql.Int,identity.accountId).input('membership',sql.Int,identity.membershipId)
            .input('role_one',sql.VarChar(30),identity.authorizedRole).input('role_two',sql.VarChar(30),null)
            .input('session_hash',sql.Char(64),identity.tokenHash);
    }
    async function registers(context){
        const bind=await authorize(context);
        return (await bind(database.getPool().request()).query(`
            SELECT a.id,c.name AS className,c.stream,y.name AS yearName,CONVERT(char(10),a.lesson_date,23) AS lessonDate,
                a.scheduled_periods AS periods FROM dbo.attendance_sessions a
            JOIN dbo.classes c ON c.school_id=a.school_id AND c.id=a.class_id
            JOIN dbo.academic_years y ON y.school_id=a.school_id AND y.id=a.year_id
            WHERE a.school_id=@school AND ${authoritySql} ORDER BY a.lesson_date DESC,c.name,c.stream,a.id`)).recordset;
    }
    async function sheet(context,sessionId){
        if(!positive(sessionId))throw fail(422,'Invalid register');
        const bind=await authorize(context);
        const result=await bind(database.getPool().request()).input('register',sql.Int,sessionId).query(`
            SELECT id FROM dbo.attendance_sessions WHERE school_id=@school AND id=@register AND ${authoritySql};
            SELECT r.student_id AS studentId,r.pupil_name AS name,r.matricule,v.attended,
                COALESCE(v.revision,0) AS version,v.reason
            FROM dbo.attendance_roster r OUTER APPLY (SELECT TOP(1) attended,revision,reason
                FROM dbo.attendance_revisions v WHERE v.school_id=r.school_id AND v.session_id=r.session_id
                AND v.student_id=r.student_id ORDER BY revision DESC) v
            WHERE r.school_id=@school AND r.session_id=@register AND ${authoritySql} ORDER BY r.pupil_name,r.student_id`);
        if(!result.recordsets[0].length)throw fail(404,'Register not found');
        return result.recordsets[1];
    }
    async function save(context,input){
        if(!input||Object.keys(input).some(k=>!['sessionId','studentId','version','attended','reason'].includes(k))||
            !positive(input.sessionId)||!positive(input.studentId)||!Number.isInteger(input.version)||input.version<0||input.version>=2147483647||
            !Number.isInteger(input.attended)||input.attended<0||input.attended>24||
            typeof input.reason!=='string'||input.reason.length>300||(input.version>0&&!input.reason.trim()))
            throw fail(422,'Enter the attended periods and give a reason for a correction');
        const bind=await authorize(context);
        const tx=new sql.Transaction(database.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request=()=>bind(new sql.Request(tx)).input('register',sql.Int,input.sessionId).input('pupil',sql.Int,input.studentId);
        try{
            const row=(await request().query(`SELECT a.scheduled_periods AS periods,
                (SELECT MAX(v.revision) FROM dbo.attendance_revisions v WHERE v.school_id=r.school_id AND
                    v.session_id=r.session_id AND v.student_id=r.student_id) AS version
                FROM dbo.attendance_roster r WITH(UPDLOCK,HOLDLOCK)
                JOIN dbo.attendance_sessions a ON a.school_id=r.school_id AND a.id=r.session_id
                WHERE r.school_id=@school AND r.session_id=@register AND r.student_id=@pupil AND ${authoritySql}`)).recordset[0];
            if(!row)throw fail(404,'Pupil not found in this register');
            if(input.attended>row.periods)throw fail(422,'Attendance exceeds the scheduled periods');
            if((row.version??0)!==input.version)throw fail(409,'This entry changed. Reopen the register before correcting it.');
            const written=await request().input('attended',sql.TinyInt,input.attended).input('version',sql.Int,input.version+1)
                .input('reason',sql.NVarChar(300),input.reason.trim()||null).query(`
                INSERT dbo.attendance_revisions(school_id,session_id,student_id,revision,attended,reason,editor_membership_id,editor_account_id)
                SELECT @school,@register,@pupil,@version,@attended,@reason,@membership,@account WHERE ${authoritySql}`);
            if(written.rowsAffected[0]!==1)throw fail(403,'Access denied');
            await tx.commit();
            return {version:input.version+1,attended:input.attended,missed:row.periods-input.attended};
        }catch(error){await tx.rollback().catch(()=>{});throw error;}
    }
    async function history(context,sessionId,studentId){
        if(!positive(sessionId)||!positive(studentId))throw fail(422,'Invalid attendance history');
        const bind=await authorize(context);
        const result=await bind(database.getPool().request()).input('register',sql.Int,sessionId).input('pupil',sql.Int,studentId).query(`
            SELECT student_id FROM dbo.attendance_roster WHERE school_id=@school AND session_id=@register AND student_id=@pupil AND ${authoritySql};
            SELECT revision,attended,LAG(attended) OVER(ORDER BY revision) AS previousAttended,reason,recorded_at AS recordedAt,
                editor_membership_id AS editorMembershipId FROM dbo.attendance_revisions
            WHERE school_id=@school AND session_id=@register AND student_id=@pupil AND ${authoritySql} ORDER BY revision`);
        if(!result.recordsets[0].length)throw fail(404,'Pupil not found in this register');
        return result.recordsets[1];
    }
    async function totals(context,input){
        if(!input||Object.keys(input).some(k=>!['registerId','from','to'].includes(k))||!positive(input.registerId)||
            !validDate(input.from)||!validDate(input.to)||input.to<input.from||
            (Date.parse(input.to)-Date.parse(input.from))/86400000>365)
            throw fail(422,'Choose a valid date range of up to 366 days');
        const bind=await authorize(context);
        const result=await bind(database.getPool().request()).input('register',sql.Int,input.registerId)
            .input('from',sql.Date,input.from).input('to',sql.Date,input.to).query(`
            SELECT id FROM dbo.attendance_sessions WHERE school_id=@school AND id=@register AND ${authoritySql};
            SELECT r.student_id AS studentId,MAX(r.pupil_name) AS name,MAX(r.matricule) AS matricule,
                COUNT(*) AS registeredDays,SUM(CONVERT(int,s.scheduled_periods)) AS scheduled,
                SUM(COALESCE(CONVERT(int,v.attended),0)) AS attended,
                SUM(CASE WHEN v.revision IS NULL THEN 0 ELSE s.scheduled_periods-v.attended END) AS missed,
                SUM(CASE WHEN v.revision IS NULL THEN CONVERT(int,s.scheduled_periods) ELSE 0 END) AS unrecorded
            FROM dbo.attendance_sessions selected
            JOIN dbo.attendance_sessions s ON s.school_id=selected.school_id AND s.class_id=selected.class_id AND s.year_id=selected.year_id
            JOIN dbo.attendance_roster r ON r.school_id=s.school_id AND r.session_id=s.id
            OUTER APPLY (SELECT TOP(1) revision,attended FROM dbo.attendance_revisions v
                WHERE v.school_id=r.school_id AND v.session_id=r.session_id AND v.student_id=r.student_id ORDER BY revision DESC) v
            WHERE selected.school_id=@school AND selected.id=@register AND s.lesson_date>=@from AND s.lesson_date<=@to
                AND ${authoritySql} GROUP BY r.student_id ORDER BY MAX(r.pupil_name),r.student_id`);
        if(!result.recordsets[0].length)throw fail(404,'Register not found');
        return result.recordsets[1];
    }
    return {registers,sheet,save,history,totals};
}
module.exports={createAttendanceService};
