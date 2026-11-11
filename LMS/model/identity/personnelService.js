const crypto=require('node:crypto');
const bcrypt=require('bcrypt');
const { sql,pool,connect }=require('../../config/database');
const { authoritySql }=require('./schoolAccess');
const configs={
    student:{ table:'students',role:'student',fields:['firstName','middleName','lastName','matricule','section','sex','dateOfBirth','placeOfBirth','regionOfOrigin','division','address','parentName','parentPhone','parentPhone2'],required:['firstName','lastName','matricule','section','sex'] },
    teacher:{ table:'teachers',role:'teacher',fields:['firstName','middleName','lastName','email','phone','employmentType','section','matriculeFile','address','idCardNo','dateOfIssue','gender','civilStatus','noOfChildren','telephone','secondaryContactName','secondaryContactPhone'],required:['firstName','lastName','email','employmentType','section'] },
};
const error=(status,message)=>Object.assign(new Error(message),{ statusCode:status });
const denied=()=>error(403,'Access denied');
const positive=value=>Number.isSafeInteger(value) && value>0 && value<=2147483647;
const limits={ firstName:100,middleName:100,lastName:100,matricule:50,email:255,phone:30,matriculeFile:255,section:20,employmentType:20,sex:10,
    dateOfBirth:10,placeOfBirth:100,regionOfOrigin:100,division:100,address:200,parentName:200,parentPhone:15,parentPhone2:15,idCardNo:50,dateOfIssue:10,gender:10,civilStatus:20,telephone:30,secondaryContactName:200,secondaryContactPhone:30 };
function placement(input,{enrolmentLedger=false}={}) {
    const allowed=enrolmentLedger?['classId','yearId','fromDate','sourceReference','reason']:['classId','yearId'];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key))||!positive(input.classId)||!positive(input.yearId))throw error(422,'Invalid initial placement');
    if(enrolmentLedger)require('./enrolmentLedgerService').validatePlacement({...input,studentId:1,toDate:null,status:'enrolled'});
    return input;
}
function validate(kind,input,{ registration=false,enrolmentLedger=false }={}) {
    const config=Object.hasOwn(configs,kind)?configs[kind]:null;
    if (!config || !input || typeof input!=='object' || Array.isArray(input)) throw error(422,'Invalid personnel fields');
    const allowed=[...config.fields,...(registration?['password',...(kind==='student'?['placement']:[])]:[])];
    if (!Object.keys(input).length || Object.keys(input).some(key=>!allowed.includes(key))) throw error(422,'Unsupported personnel fields');
    const values={};
    for(const key of config.fields) {
        if (!Object.hasOwn(input,key)) continue;
        const value=input[key];
        if ((value===null || value==='') && !config.required.includes(key)) { values[key]=null;continue; }
        if(key==='noOfChildren'){if(!Number.isInteger(value)||value<0||value>2147483647)throw error(422,'Invalid number of children');values[key]=value;continue;}
        if (typeof value!=='string' || !value.trim() || value.length>(key==='address'&&kind==='teacher'?300:limits[key]) || value!==value.trim()) throw error(422,'Invalid personnel fields');
        if(['dateOfBirth','dateOfIssue'].includes(key)&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw error(422,'Invalid calendar date');
        values[key]=value;
    }
    if (registration && config.required.some(key=>!values[key])) throw error(422,'Required personnel fields are missing');
    if (values.section && !['Anglophone','Francophone'].includes(values.section)) throw error(422,'Invalid section');
    if (values.sex && !['Male','Female'].includes(values.sex)) throw error(422,'Invalid sex');
    if (values.gender && !['Male','Female'].includes(values.gender)) throw error(422,'Invalid gender');
    if (values.civilStatus && !['Single','Married','Divorced','Widowed'].includes(values.civilStatus)) throw error(422,'Invalid civil status');
    if (values.employmentType && !['Government','Part-time'].includes(values.employmentType)) throw error(422,'Invalid employment type');
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw error(422,'Invalid email');
    if (registration) {
        if(Object.hasOwn(input,'placement'))placement(input.placement,{enrolmentLedger});
        if(enrolmentLedger&&kind==='student'&&!input.placement)throw error(422,'An explicit initial enrolment is required');
        if (typeof input.password!=='string' || input.password.length<12 || Buffer.byteLength(input.password,'utf8')>72) throw error(422,'Invalid password length');
        if (kind==='teacher' && values.employmentType==='Government' && !values.matriculeFile) throw error(422,'Matricule file is required for Government teachers');
    }
    return values;
}
function createPersonnelService(access,database={ connect,getPool:()=>pool },{enrolmentLedger=false}={}) {
    async function write(context,operation) {
        const identity=await access.authorize(context,['admin']);
        await database.connect();
        const tx=new sql.Transaction(database.getPool());
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request=()=>new sql.Request(tx).input('school',sql.Int,identity.schoolId).input('account',sql.Int,identity.accountId)
            .input('membership',sql.Int,identity.membershipId).input('session_hash',sql.Char(64),identity.tokenHash)
            .input('role_one',sql.VarChar(30),'admin').input('role_two',sql.VarChar(30),null);
        try {
            // SERIALIZABLE holds these authority reads until the whole mutation commits.
            const auth=await request().query(`SELECT 1 AS permitted WHERE ${authoritySql}`);
            if (auth.recordset.length!==1) throw denied();
            const result=await operation(request,identity);
            await tx.commit();
            return result;
        } catch(err) {
            await tx.rollback().catch(()=>{});
            if (err.statusCode) throw err;
            const numbers=[err,...(err.precedingErrors||[])].map(item=>item.number);
            if (numbers.some(number=>[2601,2627].includes(number))) throw error(409,'Personnel identifier already exists');
            throw error(500,'Personnel update failed');
        }
    }
    function bind(request,values) {
        for(const [key,value] of Object.entries(values)) request.input(key,key==='noOfChildren'?sql.Int:['dateOfBirth','dateOfIssue'].includes(key)?sql.Date:sql.NVarChar(key==='address'?300:limits[key]),value);
        return request;
    }
    async function audit(request,{ kind,id,before=null,after,fields,reason,action }) {
        await request().input('resource',sql.NVarChar(100),String(id)).input('type',sql.VarChar(40),kind)
            .input('action',sql.VarChar(60),action).input('request',sql.NVarChar(100),crypto.randomUUID())
            .input('before',sql.Int,before).input('after',sql.Int,after).input('fields',sql.NVarChar(500),fields.join(','))
            .input('reason',sql.VarChar(40),reason).query(`
                INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id,
                    reason_code,resource_version_before,resource_version_after,changed_fields)
                VALUES(@school,@account,@membership,@action,@type,@resource,@request,@reason,@before,@after,@fields);
            `);
    }
    async function register(context,kind,input) {
        const values=validate(kind,input,{ registration:true,enrolmentLedger });
        // Refuse invalid authority before paying the password work factor.
        await access.authorize(context,['admin']);
        const passwordHash=await bcrypt.hash(input.password,12);
        const config=configs[kind];
        return write(context,async request=>{
            const fields=Object.keys(values);
            const initial=kind==='student'&&input.placement?placement(input.placement,{enrolmentLedger}):null;
            if(initial){const parents=(await request().input('class',sql.Int,initial.classId).input('year',sql.Int,initial.yearId).input('section',sql.NVarChar(20),values.section).query(`
                SELECT c.id,z.timezone FROM dbo.classes c JOIN dbo.academic_years y ON y.id=@year AND y.school_id=c.school_id AND y.isCurrent=1
                JOIN dbo.schools z ON z.id=c.school_id
                WHERE c.id=@class AND c.school_id=@school AND c.section=@section`)).recordset;
                if(!parents.length)throw error(404,'Initial placement not found');
                if(enrolmentLedger){
                    let today;try{today=new Intl.DateTimeFormat('en-CA',{timeZone:parents[0].timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
                    catch{throw error(409,'School time zone requires review');}
                    if(initial.fromDate>today)throw error(422,'Initial enrolment cannot start in the future');
                }}
            const req=bind(request(),values).input('password',sql.NVarChar(255),passwordHash);
            let nameFields='';let nameValues='';
            if (kind==='teacher') {
                const name=[values.firstName,values.middleName,values.lastName].filter(Boolean).join(' ');
                if (name.length>255) throw error(422,'Teacher name is too long');
                req.input('name',sql.NVarChar(255),name);nameFields=',name';nameValues=',@name';
            }
            const profile=(await req.query(`
                INSERT dbo.[${config.table}] (${fields.map(field=>`[${field}]`).join(',')},password,school_id${nameFields})
                OUTPUT INSERTED.id,INSERTED.profile_version
                VALUES(${fields.map(field=>`@${field}`).join(',')},@password,@school${nameValues});
            `)).recordset[0];
            if(initial)await request().input('id',sql.Int,profile.id).input('class',sql.Int,initial.classId).input('year',sql.Int,initial.yearId).query(`
                UPDATE dbo.students SET currentClassLevel=@class,academicYearId=@year WHERE id=@id AND school_id=@school;
                INSERT dbo.academic_year_students(academic_year_id,student_id,school_id) VALUES(@year,@id,@school)`);
            // Server-generated canonical identity; email/matricule resolution remains scoped to the profile.
            const loginKey=`profile:${config.table}:${crypto.randomUUID()}`;
            await request().input('id',sql.Int,profile.id).input('password',sql.NVarChar(255),passwordHash)
                .input('login',sql.NVarChar(255),loginKey).input('role',sql.VarChar(30),config.role).input('source',sql.VarChar(20),config.table).query(`
                    INSERT dbo.accounts(login_key,password_hash,status) VALUES(@login,@password,'active');
                    DECLARE @newAccount INT=SCOPE_IDENTITY();
                    INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@newAccount,'active');
                    DECLARE @newMembership INT=SCOPE_IDENTITY();
                    INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@newMembership,@role);
                    INSERT dbo.legacy_account_map(source_table,legacy_id,account_id,school_id,membership_id,reconciliation_status)
                    VALUES(@source,@id,@newAccount,@school,@newMembership,'verified');
                `);
            let enrolment;
            if(initial&&enrolmentLedger)enrolment=await require('./enrolmentLedgerService').recordEnrolmentInTransaction(request,
                {...initial,studentId:profile.id,toDate:null,status:'enrolled'});
            await audit(request,{ kind,id:profile.id,after:1,fields:[...fields,...(initial?['currentClassLevel','academicYearId']:[])],reason:'registration',action:'personnel_registered' });
            return { id:profile.id,version:profile.profile_version,...(enrolment?{enrolment}:{}) };
        });
    }
    async function update(context,kind,id,expectedVersion,input) {
        const values=validate(kind,input);
        if (!positive(id) || !positive(expectedVersion)) throw error(422,'Invalid personnel version');
        return write(context,async request=>{
            const config=configs[kind];
            const current=(await request().input('id',sql.Int,id).query(`SELECT ${config.fields.map(field=>`[${field}]`).join(',')},profile_version FROM dbo.[${config.table}] WITH (UPDLOCK) WHERE id=@id AND school_id=@school`)).recordset[0];
            if (!current) throw error(404,'Personnel record not found');
            if (current.profile_version!==expectedVersion) throw error(409,'Personnel record has changed');
            const merged={ ...current,...values };
            if (kind==='teacher' && merged.employmentType==='Government' && !merged.matriculeFile) throw error(422,'Matricule file is required for Government teachers');
            const req=bind(request(),values).input('id',sql.Int,id).input('version',sql.Int,expectedVersion);
            const sets=Object.keys(values).map(field=>`[${field}]=@${field}`);
            if (kind==='teacher') {
                const name=[merged.firstName,merged.middleName,merged.lastName].filter(Boolean).join(' ');
                if (name.length>255) throw error(422,'Teacher name is too long');
                req.input('name',sql.NVarChar(255),name);sets.push('name=@name');
            }
            const result=(await req.query(`UPDATE dbo.[${config.table}] SET ${sets.join(',')},profile_version=profile_version+1
                OUTPUT INSERTED.id,INSERTED.profile_version WHERE id=@id AND school_id=@school AND profile_version=@version`)).recordset[0];
            if (!result) throw error(409,'Personnel record has changed');
            await audit(request,{ kind,id,before:expectedVersion,after:result.profile_version,fields:Object.keys(values),reason:'profile_correction',action:'personnel_updated' });
            return { id,version:result.profile_version };
        });
    }
    async function setStatus(context,kind,id,expectedVersion,status,reason) {
        if(enrolmentLedger&&kind==='student')throw error(409,'Pupil status requires the dated enrolment workflow');
        const config=Object.hasOwn(configs,kind)?configs[kind]:null;
        if (!config || !positive(id) || !positive(expectedVersion) || !(kind==='student'?['active','withdrawn']:['active','suspended','withdrawn']).includes(status) ||
            !['administrative','withdrawal','return_to_school','employment_change'].includes(reason)) throw error(422,'Invalid status change');
        return write(context,async request=>{
            const row=(await request().input('id',sql.Int,id).input('source',sql.VarChar(20),config.table).query(`
                SELECT p.profile_version,l.account_id,l.membership_id,a.status AS account_status FROM dbo.[${config.table}] p WITH (UPDLOCK)
                JOIN dbo.legacy_account_map l ON l.legacy_id=p.id AND l.source_table=@source AND l.school_id=p.school_id AND l.reconciliation_status='verified'
                JOIN dbo.accounts a ON a.id=l.account_id
                JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.account_id=a.id AND m.school_id=p.school_id
                WHERE p.id=@id AND p.school_id=@school;
            `)).recordset[0];
            if (!row) throw error(404,'Personnel record not found');
            if (row.profile_version!==expectedVersion) throw error(409,'Personnel record has changed');
            if (status==='active' && row.account_status!=='active') throw error(409,'Account requires separate recovery review');
            if (row.membership_id===context.membershipId) throw denied();
            const req=request().input('id',sql.Int,id).input('targetMembership',sql.Int,row.membership_id)
                .input('memberStatus',sql.VarChar(20),status==='active'?'active':'revoked');
            let clause;
            if (kind==='student') { req.input('withdrawn',sql.Bit,status!=='active');clause='isWithdrawn=@withdrawn'; }
            else { req.input('status',sql.NVarChar(20),status);clause='status=@status'; }
            await req.query(`UPDATE dbo.[${config.table}] SET ${clause},profile_version=profile_version+1 WHERE id=@id AND school_id=@school;
                UPDATE dbo.school_memberships SET status=@memberStatus WHERE id=@targetMembership AND school_id=@school;
                UPDATE dbo.account_sessions SET revoked_at=SYSUTCDATETIME() WHERE active_membership_id=@targetMembership AND revoked_at IS NULL;`);
            await audit(request,{ kind,id,before:expectedVersion,after:expectedVersion+1,fields:[kind==='student'?'isWithdrawn':'status'],reason,action:'personnel_status_changed' });
            return { id,version:expectedVersion+1,status };
        });
    }
    return { register,update,setStatus };
}
module.exports={ createPersonnelService,validatePersonnel:validate };
