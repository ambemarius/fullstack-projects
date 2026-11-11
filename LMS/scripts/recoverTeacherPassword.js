const bcrypt=require('bcrypt');const crypto=require('node:crypto');const db=require('../config/database');const {isTestEnvironment}=require('../config/environment');const {validateRecoveryInput,safeRecoveryError}=require('./recoverLegacyAdmin');
const fail=(code,message)=>{throw Object.assign(new Error(message),{recoveryCode:code});};
async function runtimeReady(){try{const result=await fetch('http://127.0.0.1:2026/login',{signal:AbortSignal.timeout(5000)});if(result.status!==200||result.headers.get('x-lms-credential-versions')!=='1')throw Error();}catch{fail('RUNTIME_NOT_READY','Original application must load credential-version checks before recovery. Nothing changed.');}}
function createTeacherRecovery(database={connect:db.connect,getPool:()=>db.pool},{schoolCode='LYCEE_BATOURI',operatorEmail='admin@school.local',verifyRuntime=runtimeReady}={}){
 async function target(){await database.connect();if(isTestEnvironment()){await require('./testEnvironment').assertSyntheticDatabase(database);return;}const row=(await database.getPool().request().query("SELECT DB_NAME() name,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server")).recordset[0];if(row.name!=='schooldb'||row.server.toUpperCase()!=='MARIUS\\DEV')fail('WRONG_TARGET','Recovery refused on an unapproved database.');}
 async function operator(request){const rows=(await request.input('operatorEmail',db.sql.NVarChar(255),operatorEmail).input('operatorSchool',db.sql.NVarChar(50),schoolCode).query(`
  SELECT a.id FROM dbo.Admins p JOIN dbo.schools s ON s.id=p.school_id AND s.code=@operatorSchool AND s.status='active'
  JOIN dbo.legacy_account_map l ON l.source_table='Admins' AND l.legacy_id=p.id AND l.school_id=p.school_id AND l.reconciliation_status='verified'
  JOIN dbo.accounts a ON a.id=l.account_id AND a.status='active' JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.account_id=a.id AND m.school_id=s.id AND m.status='active'
  WHERE p.email=@operatorEmail AND LOWER(LTRIM(RTRIM(p.role)))='admin'
   AND a.password_hash COLLATE Latin1_General_100_BIN2=p.password COLLATE Latin1_General_100_BIN2
   AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=a.id AND g.permission='platform_operator' AND g.revoked_at IS NULL)`)).recordset;if(rows.length!==1)fail('OPERATOR_REQUIRED','The designated active platform operator is required for local recovery.');return rows[0].id;}
 async function teacher(request,email,secret=false){if(typeof email!=='string'||email!==email.trim()||email.length>255||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('INVALID_EMAIL','Provide the exact registered teacher email.');
  const rows=(await request.input('email',db.sql.NVarChar(255),email).input('code',db.sql.NVarChar(50),schoolCode).query(`SELECT t.id,t.email,t.status,t.school_id,l.account_id,l.membership_id,l.reconciliation_status,a.security_version,a.login_key,a.status account_status,m.status membership_status,
   CASE WHEN t.password COLLATE Latin1_General_100_BIN2=a.password_hash COLLATE Latin1_General_100_BIN2 THEN 1 ELSE 0 END credential_aligned
   ${secret?',t.password source_hash,a.password_hash canonical_hash':''}
   FROM dbo.teachers t ${secret?'WITH(UPDLOCK,HOLDLOCK)':''} JOIN dbo.schools s ON s.id=t.school_id AND s.code=@code AND s.status='active'
   JOIN dbo.legacy_account_map l ON l.source_table='teachers' AND l.legacy_id=t.id AND l.school_id=t.school_id AND l.reconciliation_status='verified'
   JOIN dbo.accounts a ${secret?'WITH(UPDLOCK,HOLDLOCK)':''} ON a.id=l.account_id JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.account_id=a.id AND m.school_id=t.school_id
   WHERE t.email=@email AND t.role='teacher' AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id AND r.role='teacher')`)).recordset;
  if(rows.length!==1)fail('TEACHER_NOT_FOUND','The teacher and verified school account must be uniquely identified.');return rows[0];
 }
 async function review(email){await target();const actor=await operator(database.getPool().request());const row=await teacher(database.getPool().request(),email);return {mode:'review',schoolCode,teacherId:row.id,accountId:row.account_id,email:row.email,status:row.status,accountStatus:row.account_status,membershipStatus:row.membership_status,securityVersion:row.security_version,credentialAligned:Boolean(row.credential_aligned),operatorAccountId:actor,changes:0};}
 async function apply(email,password,expectedId,expectedVersion){validateRecoveryInput(password,expectedId);if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('INVALID_REVIEW','Review the current credential version first.');await target();await verifyRuntime();
  const replacement=await bcrypt.hash(password,12),tx=new db.sql.Transaction(database.getPool());await tx.begin(db.sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>new db.sql.Request(tx);
  try{const actor=await operator(request()),row=await teacher(request(),email,true);if(row.id!==expectedId||row.security_version!==expectedVersion)fail('REVIEW_CHANGED','Account or credential version changed; review again.');
   const result=(await request().input('id',db.sql.Int,row.id).input('school',db.sql.Int,row.school_id).input('account',db.sql.Int,row.account_id).input('version',db.sql.Int,expectedVersion)
    .input('source',db.sql.NVarChar(255),row.source_hash).input('canonical',db.sql.NVarChar(255),row.canonical_hash).input('replacement',db.sql.NVarChar(255),replacement)
    .input('binding',db.sql.NVarChar(255),`existing-admin:${row.account_id}:${crypto.createHash('sha256').update(row.login_key).digest('hex')}`).query(`
     UPDATE dbo.teachers SET password=@replacement WHERE id=@id AND school_id=@school AND password COLLATE Latin1_General_100_BIN2=@source COLLATE Latin1_General_100_BIN2;
     IF @@ROWCOUNT<>1 THROW 50050,'Concurrent teacher change',1;
     UPDATE dbo.accounts SET password_hash=@replacement,security_version=security_version+1 WHERE id=@account AND security_version=@version AND password_hash COLLATE Latin1_General_100_BIN2=@canonical COLLATE Latin1_General_100_BIN2;
     IF @@ROWCOUNT<>1 THROW 50050,'Concurrent account change',1;
     UPDATE dbo.account_sessions SET revoked_at=SYSUTCDATETIME() WHERE account_id=@account AND revoked_at IS NULL;DECLARE @revoked INT=@@ROWCOUNT;
     UPDATE dbo.school_invitations SET revoked_at=SYSUTCDATETIME() WHERE intended_login_key=@binding AND role='admin' AND consumed_at IS NULL AND revoked_at IS NULL;
     SELECT @revoked revoked_sessions;`)).recordset[0];
   await request().input('school',db.sql.Int,row.school_id).input('actor',db.sql.Int,actor).input('id',db.sql.NVarChar(100),String(row.id)).input('request',db.sql.NVarChar(100),crypto.randomUUID()).query(`
    INSERT dbo.identity_audit_events(school_id,actor_account_id,action,resource_type,resource_id,request_id,reason_code,changed_fields)
    VALUES(@school,@actor,'teacher_password_recovered','teacher',@id,@request,'administrative','password,security_version')`);
   await tx.commit();return {mode:'applied',teacherId:row.id,email:row.email,securityVersion:expectedVersion+1,credentialCopiesUpdated:2,revokedSessions:result.revoked_sessions,statusUnchanged:true,changes:1};
  }catch(error){await tx.rollback().catch(()=>{});throw error;}
 }
 return {review,apply};
}
async function main(){const args=process.argv.slice(2);const email=args[args.indexOf('--email')+1],service=createTeacherRecovery();try{
 if(!args.includes('--email'))fail('INVALID_EMAIL','An explicit teacher email is required.');
 if(args.includes('--apply')||args.includes('--check-input')){let content='';process.stdin.setEncoding('utf8');for await(const chunk of process.stdin){content+=chunk;if(content.length>4096)fail('INPUT_FORMAT','Private input is too long.');}let input;try{input=JSON.parse(content.replace(/^\uFEFF/,''));}catch{fail('INPUT_FORMAT','Invalid private input.');}
  const id=Number(args[args.indexOf('--expected-id')+1]),version=Number(args[args.indexOf('--expected-version')+1]);validateRecoveryInput(input.password,id);if(!Number.isSafeInteger(version)||version<1)fail('INVALID_REVIEW','Reviewed credential version is required.');
  console.log(JSON.stringify(args.includes('--check-input')?{mode:'input-check',changes:0,passwordAccepted:true}:await service.apply(email,input.password,id,version)));
 }else console.log(JSON.stringify(await service.review(email)));
 }catch(error){const result=error.recoveryCode?{code:error.recoveryCode,message:error.message}:safeRecoveryError(error);console.error(JSON.stringify(result));process.exitCode=1;}finally{await db.close();}}
if(require.main===module)main();module.exports={createTeacherRecovery,runtimeReady};
