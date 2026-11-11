const crypto=require('node:crypto');
const { sql,pool,connect }=require('../../config/database');
const { authoritySql }=require('./schoolAccess');
const { yearCoverageSql }=require('./yearCoverage');
const fail=(statusCode,message)=>Object.assign(new Error(message),{ statusCode });
const positive=value=>Number.isSafeInteger(value) && value>0 && value<=2147483647;
const configs={
    year:{ table:'academic_years',fields:{ name:sql.NVarChar(20),fromYear:sql.Int,toYear:sql.Int },required:['fromYear','toYear'] },
    class:{ table:'classes',fields:{ section:sql.NVarChar(20),name:sql.NVarChar(50),stream:sql.NVarChar(20),rank:sql.Int,class_master_id:sql.Int },required:['section','name','rank'] },
    subject:{ table:'subjects',fields:{ name:sql.NVarChar(100),code:sql.NVarChar(20),description:sql.NVarChar(200),coefficient:sql.Int,categories:sql.NVarChar(20),subject_master:sql.Int,class_id:sql.Int,hours_per_week:sql.Int,has_lab:sql.Bit },required:['name','code'] },
};
const nullable=new Set(['stream','class_master_id','description','categories','subject_master','class_id']);
const maxLengths={ name:{ year:20,class:50,subject:100 },section:20,stream:20,code:20,description:200,categories:20 };
function validate(kind,input,creating=false) {
    const config=Object.hasOwn(configs,kind)?configs[kind]:null;
    if (!config || !input || typeof input!=='object' || Array.isArray(input) || !Object.keys(input).length ||
        Object.keys(input).some(key=>!Object.hasOwn(config.fields,key) && !(creating && kind==='year' && key==='isCurrent'))) throw fail(422,'Invalid academic fields');
    const values={};
    for(const [key,value] of Object.entries(input)) {
        if (value===null && nullable.has(key)) { values[key]=null;continue; }
        if (['fromYear','toYear','rank','coefficient','class_master_id','subject_master','class_id','hours_per_week'].includes(key)) {
            if (!positive(value)) throw fail(422,'Invalid academic number');
        } else if (['has_lab','isCurrent'].includes(key)) {
            if (typeof value!=='boolean') throw fail(422,'Invalid academic flag');
        } else {
            const max=key==='name'?maxLengths.name[kind]:maxLengths[key];
            if (typeof value!=='string' || !value || value!==value.trim() || value.length>max) throw fail(422,'Invalid academic text');
        }
        values[key]=value;
    }
    if (creating && config.required.some(key=>!Object.hasOwn(values,key))) throw fail(422,'Required academic fields are missing');
    if (values.section && !['Anglophone','Francophone'].includes(values.section)) throw fail(422,'Invalid section');
    if (values.coefficient && (values.coefficient<1 || values.coefficient>5)) throw fail(422,'Invalid coefficient');
    if (values.hours_per_week && values.hours_per_week>10) throw fail(422,'Invalid weekly hours');
    if (values.categories && !['Science','Arts','Compulsory'].includes(values.categories)) throw fail(422,'Invalid category');
    if (kind==='year') {
        for(const key of ['fromYear','toYear']) if (values[key]!==undefined && values[key]>9999) throw fail(422,'Invalid year range');
        if (values.fromYear && values.toYear && values.toYear<=values.fromYear) throw fail(422,'Invalid year range');
        if (creating && !values.name) values.name=`${values.fromYear}/${values.toYear}`;
    }
    return values;
}
function createAcademicSetupService(access,database={ connect,getPool:()=>pool },{yearArchive=false}={}) {
    function bound(identity,request) {
        return request.input('school',sql.Int,identity.schoolId).input('account',sql.Int,identity.accountId)
            .input('membership',sql.Int,identity.membershipId).input('session_hash',sql.Char(64),identity.tokenHash)
            .input('role_one',sql.VarChar(30),identity.authorizedRole).input('role_two',sql.VarChar(30),null);
    }
    async function transaction(context,operation,lockMode='Exclusive') {
        const identity=await access.authorize(context,['admin']);
        await database.connect();const tx=new sql.Transaction(database.getPool());
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request=()=>bound(identity,new sql.Request(tx));
        try {
            const lock=await request().input('resource',sql.NVarChar(255),`lms-academic-setup:${identity.schoolId}`).input('mode',sql.VarChar(32),lockMode).query(`
                DECLARE @result INT;EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode=@mode,@LockOwner='Transaction',@LockTimeout=10000;
                SELECT @result AS result;`);
            if (lock.recordset[0].result<0) throw fail(409,'Academic setup is busy');
            if (!(await request().query(`SELECT 1 AS permitted WHERE ${authoritySql}`)).recordset.length) throw fail(403,'Access denied');
            const result=await operation(request);
            await tx.commit();return result;
        } catch(err) {
            await tx.rollback().catch(()=>{});
            if (err.statusCode) throw err;
            if ([err,...(err.precedingErrors||[])].some(item=>item.number===1205)) throw fail(409,'Academic setup changed during review. Reload and retry.');
            if ([err,...(err.precedingErrors||[])].some(item=>[2601,2627].includes(item.number))) throw fail(409,'Academic identifier already exists');
            throw fail(500,'Academic setup failed');
        }
    }
    async function audit(request,kind,id,action,fields,before,after) {
        await request().input('id',sql.NVarChar(100),String(id)).input('type',sql.VarChar(40),kind)
            .input('action',sql.VarChar(60),action).input('request',sql.NVarChar(100),crypto.randomUUID())
            .input('fields',sql.NVarChar(500),fields.join(',')).input('before',sql.Int,before).input('after',sql.Int,after).query(`
                INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id,
                    resource_version_before,resource_version_after,changed_fields)
                VALUES(@school,@account,@membership,@action,@type,@id,@request,@before,@after,@fields);`);
    }
    async function parents(request,values) {
        for(const [key,table] of [['class_master_id','teachers'],['subject_master','teachers'],['class_id','classes']]) {
            if (!Object.hasOwn(values,key) || values[key]===null) continue;
            const result=await request().input('parent',sql.Int,values[key]).query(`SELECT id FROM dbo.[${table}]
                WHERE id=@parent AND school_id=@school ${table==='teachers'?"AND status='active'":''}`);
            if (!result.recordset.length) throw fail(404,'Academic parent not found');
        }
    }
    async function clearCurrent(request,exceptId=null) {
        const cleared=(await request().input('except',sql.Int,exceptId).query(`UPDATE dbo.academic_years SET isCurrent=0,setup_version=setup_version+1
            OUTPUT INSERTED.id,DELETED.setup_version AS before_version,INSERTED.setup_version AS after_version
            WHERE school_id=@school AND isCurrent=1 AND (@except IS NULL OR id<>@except)`)).recordset;
        for(const row of cleared) await audit(request,'year',row.id,'academic_current_cleared',['isCurrent'],row.before_version,row.after_version);
    }
    async function requireUnarchived(request,id) {
        if (!yearArchive) return;
        const result=await request().input('id',sql.Int,id).query('SELECT 1 FROM dbo.academic_year_archives WHERE school_id=@school AND academic_year_id=@id');
        if (result.recordset.length) throw fail(409,'This academic year is archived');
    }
    async function create(context,kind,input) {
        const values=validate(kind,input,true),config=configs[kind];
        return transaction(context,async request=>{
            await parents(request,values);
            if (kind==='year' && values.isCurrent) await clearCurrent(request);
            const req=request();
            for(const [key,value] of Object.entries(values)) req.input(key,key==='isCurrent'?sql.Bit:config.fields[key],value);
            const fields=Object.keys(values);
            const result=(await req.query(`INSERT dbo.[${config.table}] (${fields.map(key=>`[${key}]`).join(',')},school_id${kind==='year'?',created_by_account_id':''})
                OUTPUT INSERTED.id,INSERTED.setup_version AS version VALUES(${fields.map(key=>`@${key}`).join(',')},@school${kind==='year'?',@account':''})`)).recordset[0];
            await audit(request,kind,result.id,'academic_created',fields,null,result.version);
            return result;
        });
    }
    async function update(context,kind,id,version,input) {
        const values=validate(kind,input),config=configs[kind];
        if (!positive(id) || !positive(version)) throw fail(422,'Invalid academic version');
        return transaction(context,async request=>{
            const row=(await request().input('id',sql.Int,id).query(`SELECT ${Object.keys(config.fields).map(key=>`[${key}]`).join(',')},setup_version
                FROM dbo.[${config.table}] WITH (UPDLOCK) WHERE school_id=@school AND id=@id`)).recordset[0];
            if (!row) throw fail(404,'Academic record not found');
            if (row.setup_version!==version) throw fail(409,'Academic record has changed');
            if (kind==='year') await requireUnarchived(request,id);
            if (kind==='year') validate(kind,Object.fromEntries(Object.keys(config.fields).map(key=>[key,Object.hasOwn(values,key)?values[key]:row[key]])));
            await parents(request,values);
            const req=request().input('id',sql.Int,id).input('version',sql.Int,version);
            for(const [key,value] of Object.entries(values)) req.input(key,config.fields[key],value);
            const result=(await req.query(`UPDATE dbo.[${config.table}] SET ${Object.keys(values).map(key=>`[${key}]=@${key}`).join(',')},setup_version=setup_version+1
                OUTPUT INSERTED.id,INSERTED.setup_version AS version WHERE school_id=@school AND id=@id AND setup_version=@version`)).recordset[0];
            if (!result) throw fail(409,'Academic record has changed');
            await audit(request,kind,id,'academic_updated',Object.keys(values),version,result.version);return result;
        });
    }
    async function setCurrent(context,id,version) {
        if (!positive(id) || !positive(version)) throw fail(422,'Invalid academic version');
        return transaction(context,async request=>{
            const row=(await request().input('id',sql.Int,id).query('SELECT id,isCurrent,setup_version AS version FROM dbo.academic_years WITH(UPDLOCK) WHERE school_id=@school AND id=@id')).recordset[0];
            if (!row) throw fail(404,'Academic record not found');
            if (row.version!==version) throw fail(409,'Academic record has changed');
            await requireUnarchived(request,id);
            if (row.isCurrent) return { id,version };
            await clearCurrent(request,id);
            await request().input('id',sql.Int,id).query('UPDATE dbo.academic_years SET isCurrent=1,setup_version=setup_version+1 WHERE id=@id AND school_id=@school');
            await audit(request,'year',id,'academic_current_set',['isCurrent'],version,version+1);
            return { id,version:version+1 };
        });
    }
    async function list(context,kind) {
        if (!Object.hasOwn(configs,kind)) throw fail(422,'Invalid academic resource');
        const identity=await access.authorize(context,['admin']);await database.connect();
        const config=configs[kind];
        const fields=[...Object.keys(config.fields),...(kind==='year'?['isCurrent']:[])];
        const archiveColumn=yearArchive && kind==='year' ? ',(SELECT a.archived_at FROM dbo.academic_year_archives a WHERE a.school_id=@school AND a.academic_year_id=rec.id) AS archivedAt' : '';
        return (await bound(identity,database.getPool().request()).query(`SELECT id,${fields.map(key=>`[${key}]`).join(',')},setup_version AS version${archiveColumn}
            FROM dbo.[${config.table}] rec WHERE school_id=@school AND ${authoritySql} ORDER BY id`)).recordset;
    }
    async function context(contextValue) {
        const identity=await access.authorize(contextValue,['admin','teacher','student']);await database.connect();
        const result=await bound(identity,database.getPool().request()).query(`
            SELECT id,name,fromYear,toYear FROM dbo.academic_years WHERE school_id=@school AND isCurrent=1 AND ${authoritySql};
            SELECT id,slot_number,start_time,end_time,is_break,sort_order FROM dbo.time_slots WHERE school_id=@school AND ${authoritySql} ORDER BY sort_order,id;`);
        return { currentYear:result.recordsets[0][0] || null,timeSlots:result.recordsets[1] };
    }
    async function coverage(request,yearId) {
        const school=(await request().query('SELECT timezone FROM dbo.schools WHERE id=@school')).recordset[0];
        let today;
        try { today=new Intl.DateTimeFormat('en-CA',{timeZone:school.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
        catch { throw fail(409,'Review the school time zone before continuing'); }
        const result=await request().input('year',sql.Int,yearId).input('today',sql.Date,today).query(yearCoverageSql);
        if (!result.recordset.length) throw fail(404,'Academic year not found');
        return result.recordset[0];
    }
    async function yearCoverage(context,yearId) {
        if (!positive(yearId)) throw fail(422,'Invalid academic year');
        return transaction(context,request=>coverage(request,yearId),'Shared');
    }
    async function archive(context,id,version,reason) {
        if (!yearArchive) throw fail(404,'Archive unavailable');
        if (!positive(id) || !positive(version) || version===2147483647 || typeof reason!=='string' ||
            !reason.trim() || reason.length>200 || /[\u0000-\u001f\u007f]/.test(reason)) throw fail(422,'Supply the reviewed version and a reason of up to 200 characters');
        return transaction(context,async request=>{
            const row=(await request().input('id',sql.Int,id).query('SELECT isCurrent,setup_version FROM dbo.academic_years WITH(UPDLOCK) WHERE school_id=@school AND id=@id')).recordset[0];
            if (!row) throw fail(404,'Academic year not found');
            if (row.setup_version!==version) throw fail(409,'Academic year has changed. Reload before archiving.');
            if (row.isCurrent) throw fail(409,'Select another current year before archiving this one');
            await requireUnarchived(request,id);
            const report=await coverage(request,id);
            if (report.unfinishedPlacements || report.activeProjectionPupils) throw fail(409,'Review unfinished placements and active pupil profiles before archiving this year');
            await request().input('id',sql.Int,id).input('reason',sql.NVarChar(200),reason.trim()).query(`
                UPDATE dbo.academic_years SET setup_version=setup_version+1 WHERE school_id=@school AND id=@id;
                INSERT dbo.academic_year_archives(school_id,academic_year_id,setup_version,is_current,year_name,from_year,to_year,actor_membership_id,actor_account_id,reason)
                SELECT school_id,id,setup_version,isCurrent,name,fromYear,toYear,@membership,@account,@reason FROM dbo.academic_years WHERE school_id=@school AND id=@id;`);
            await audit(request,'year',id,'academic_year_archived',['archived_at'],version,version+1);
            return {id,version:version+1};
        });
    }
    return { create,update,setCurrent,list,context,yearCoverage,archive };
}
module.exports={ createAcademicSetupService,validateAcademicSetup:validate };
