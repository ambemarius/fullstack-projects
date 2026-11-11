const crypto=require('node:crypto');const {sql,pool,connect}=require('../../config/database');const {authoritySql}=require('./schoolAccess');
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const fields={firstName:100,middleName:100,lastName:100,email:255,phone:30,jobTitle:50};
function validate(input,creating=false){
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length||Object.keys(input).some(key=>!Object.hasOwn(fields,key)))throw fail(422,'Unsupported auxiliary fields');
 const values={};for(const [key,value]of Object.entries(input)){
  if((value===null||value==='')&&['middleName','phone'].includes(key)){values[key]=null;continue;}
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>fields[key])throw fail(422,'Invalid auxiliary fields');values[key]=value;
 }
 if(creating&&['firstName','lastName','email','jobTitle'].some(key=>!values[key]))throw fail(422,'Required auxiliary fields are missing');
 if(values.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))throw fail(422,'Invalid email');return values;
}
function version(row){return crypto.createHash('sha256').update(JSON.stringify([row.id,row.school_id,row.name,row.firstName,row.middleName,row.lastName,row.email,row.phone,row.role,row.status,row.createdAt])).digest('hex');}
const dto=row=>({id:row.id,firstName:row.firstName,middleName:row.middleName,lastName:row.lastName,email:row.email,phone:row.phone,jobTitle:row.role,status:row.status,version:version(row)});
const validId=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
function createAuxiliaryService(access,database={connect,getPool:()=>pool},{staffAccounts=false}={}){
 function bound(identity,request){return request.input('school',sql.Int,identity.schoolId).input('account',sql.Int,identity.accountId).input('membership',sql.Int,identity.membershipId).input('session_hash',sql.Char(64),identity.tokenHash).input('role_one',sql.VarChar(30),'admin').input('role_two',sql.VarChar(30),null);}
 async function authorized(context){const identity=await access.authorize(context,['admin']);await database.connect();return identity;}
 async function list(context,{search='',offset=0,limit=50}={}){
  if(typeof search!=='string'||search.length>100||!Number.isInteger(offset)||offset<0||offset>1000000||!Number.isInteger(limit)||limit<1||limit>100)throw fail(422,'Invalid auxiliary list request');
  const identity=await authorized(context);const result=await bound(identity,database.getPool().request()).input('search',sql.NVarChar(100),search).input('offset',sql.Int,offset).input('limit',sql.Int,limit).query(`
   SELECT p.id,p.school_id,p.name,p.firstName,p.middleName,p.lastName,p.email,p.phone,p.role,p.status,p.createdAt FROM dbo.auxiliary_staff p
   WHERE p.school_id=@school AND ${authoritySql} AND (@search=N'' OR p.name LIKE N'%'+@search+N'%' OR p.email LIKE N'%'+@search+N'%') ORDER BY p.id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
   SELECT COUNT(*) total FROM dbo.auxiliary_staff p WHERE p.school_id=@school AND ${authoritySql} AND (@search=N'' OR p.name LIKE N'%'+@search+N'%' OR p.email LIKE N'%'+@search+N'%');`);
  return {data:result.recordsets[0].map(dto),total:result.recordsets[1][0].total};
 }
 async function write(context,operation){const identity=await authorized(context);const tx=new sql.Transaction(database.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>bound(identity,new sql.Request(tx));
  try{if(!(await request().query(`SELECT 1 permitted WHERE ${authoritySql}`)).recordset.length)throw fail(403,'Access denied');const result=await operation(request);await tx.commit();return result;}
  catch(error){await tx.rollback().catch(()=>{});if(error.statusCode)throw error;if([error,...(error.precedingErrors||[])].some(e=>[2601,2627].includes(e.number)))throw fail(409,'Auxiliary email already exists in this school');throw fail(500,'Auxiliary update failed');}
 }
 async function read(request,id){return (await request().input('id',sql.Int,id).query('SELECT id,school_id,name,firstName,middleName,lastName,email,phone,role,status,createdAt FROM dbo.auxiliary_staff WITH(UPDLOCK,HOLDLOCK) WHERE id=@id AND school_id=@school')).recordset[0];}
 async function audit(request,id,action,changed,reason){await request().input('resource',sql.NVarChar(100),String(id)).input('action',sql.VarChar(60),action).input('request',sql.NVarChar(100),crypto.randomUUID()).input('fields',sql.NVarChar(500),changed.join(',')).input('reason',sql.VarChar(40),reason).query(`INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id,changed_fields,reason_code) VALUES(@school,@account,@membership,@action,'auxiliary_staff',@resource,@request,@fields,@reason)`);}
 function bind(request,values){for(const [key,value]of Object.entries(values))request.input(key,sql.NVarChar(fields[key]),value);return request;}
 function fullName(values){const name=[values.firstName,values.middleName,values.lastName].filter(Boolean).join(' ');if(name.length>255)throw fail(422,'Auxiliary name is too long');return name;}
 async function create(context,input){const values=validate(input,true);return write(context,async request=>{
  const keys=Object.keys(values);const result=(await bind(request(),values).input('name',sql.NVarChar(255),fullName(values)).query(`INSERT dbo.auxiliary_staff(name,${keys.map(key=>`[${key==='jobTitle'?'role':key}]`).join(',')},status,school_id) OUTPUT INSERTED.id VALUES(@name,${keys.map(key=>'@'+key).join(',')},'pending',@school)`)).recordset[0];
  await audit(request,result.id,'auxiliary_registered',keys,'registration');return dto(await read(request,result.id));
 });}
 async function update(context,id,expected,input){const values=validate(input);if(!validId(id)||typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))throw fail(422,'Invalid auxiliary version');return write(context,async request=>{
  const current=await read(request,id);if(!current)throw fail(404,'Auxiliary record not found');if(version(current)!==expected)throw fail(409,'Auxiliary record has changed; reload it');
  const merged={...current,...values};const name=['firstName','middleName','lastName'].some(key=>Object.hasOwn(values,key))?fullName(merged):current.name;await bind(request(),values).input('id',sql.Int,id).input('name',sql.NVarChar(255),name).query(`UPDATE dbo.auxiliary_staff SET name=@name,${Object.keys(values).map(key=>`[${key==='jobTitle'?'role':key}]=@${key}`).join(',')} WHERE id=@id AND school_id=@school`);
  await audit(request,id,'auxiliary_updated',Object.keys(values),'profile_correction');return dto(await read(request,id));
 });}
 async function setStatus(context,id,expected,status){if(!validId(id)||typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected)||!['pending','active','suspended','withdrawn'].includes(status))throw fail(422,'Invalid auxiliary status request');return write(context,async request=>{
  const current=await read(request,id);if(!current)throw fail(404,'Auxiliary record not found');if(version(current)!==expected)throw fail(409,'Auxiliary record has changed; reload it');
  await request().input('id',sql.Int,id).input('status',sql.NVarChar(20),status).query('UPDATE dbo.auxiliary_staff SET status=@status WHERE id=@id AND school_id=@school');
  if(staffAccounts&&status!=='active')await request().input('id',sql.Int,id).query(`UPDATE x SET revoked_at=SYSUTCDATETIME() FROM dbo.account_sessions x JOIN dbo.staff_profile_links l ON l.membership_id=x.active_membership_id AND l.account_id=x.account_id WHERE l.school_id=@school AND l.auxiliary_profile_id=@id AND x.revoked_at IS NULL`);
  await audit(request,id,'auxiliary_status_changed',['status'],'administrative');return dto(await read(request,id));
 });}
 return {list,create,update,setStatus};
}
module.exports={createAuxiliaryService,validateAuxiliary:validate,auxiliaryVersion:version};
