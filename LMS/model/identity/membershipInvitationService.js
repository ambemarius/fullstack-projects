const crypto=require('node:crypto');const {sql,pool,connect}=require('../../config/database');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const positive=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
const tokenValid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const idValid=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const error=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const denied=()=>error(403,'Access denied');
function existingAccountBinding(accountId,loginKey){if(!positive(accountId)||typeof loginKey!=='string'||!loginKey)throw denied();return `existing-admin:${accountId}:${hash(loginKey)}`;}
// Separate from pending-school bootstrap: existing authenticated accounts only, fixed school-admin role.
function createMembershipInvitationService(identity,database={connect,getPool:()=>pool},{requireSchoolProfile=true,schoolCode=null}={}){
 if(schoolCode!==null&&(typeof schoolCode!=='string'||!/^[A-Z0-9_-]{2,50}$/.test(schoolCode)))throw error(422,'Invalid configured school');
 const profilesSql=`
  SELECT l.account_id,p.name,p.email,l.membership_id,'teacher' profile_type FROM dbo.legacy_account_map l
  JOIN dbo.teachers p ON l.source_table='teachers' AND p.id=l.legacy_id AND p.school_id=l.school_id
  JOIN dbo.accounts a ON a.id=l.account_id JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.account_id=a.id AND m.school_id=l.school_id
  WHERE l.school_id=@school AND l.reconciliation_status='verified' AND m.status='active' AND a.status='active' AND p.status='active' AND p.role='teacher'
   AND a.password_hash COLLATE Latin1_General_100_BIN2=p.password COLLATE Latin1_General_100_BIN2
   AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id AND r.role='teacher')
  UNION ALL SELECT l.account_id,p.name,p.email,l.membership_id,'admin' profile_type FROM dbo.legacy_account_map l
  JOIN dbo.Admins p ON l.source_table='Admins' AND p.id=l.legacy_id AND p.school_id=l.school_id
  JOIN dbo.accounts a ON a.id=l.account_id JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.account_id=a.id AND m.school_id=l.school_id
  WHERE l.school_id=@school AND l.reconciliation_status='verified' AND m.status='active' AND a.status='active' AND LOWER(LTRIM(RTRIM(p.role)))='admin'
   AND a.password_hash COLLATE Latin1_General_100_BIN2=p.password COLLATE Latin1_General_100_BIN2
   AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id AND r.role='admin')`;
 async function activeSchool(request,schoolId){const school=(await request().input('school',sql.Int,schoolId).input('code',sql.NVarChar(50),schoolCode).query("SELECT id FROM dbo.schools WHERE id=@school AND status='active' AND (@code IS NULL OR code=@code)")).recordset[0];if(!school)throw denied();return school;}
 async function localProfile(request,schoolId,accountId){if(!requireSchoolProfile)return;const found=(await request().input('school',sql.Int,schoolId).input('target',sql.Int,accountId).query(`SELECT account_id FROM (${profilesSql}) p WHERE p.account_id=@target`)).recordset;if(found.length!==1)throw error(409,'A verified active staff profile in the target school is required');}
 async function transaction(token,operator,operation,{reauth=false}={}){
  if(!tokenValid(token))throw denied();const current=await identity.resolveSession(token);
  if(!current||!positive(current.accountId)||(operator&&!current.platformPermissions?.includes('platform_operator')))throw denied();
  await database.connect();const tx=new sql.Transaction(database.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const request=()=>new sql.Request(tx).input('actor',sql.Int,current.accountId).input('session',sql.Char(64),hash(token));
  try{
   if(reauth){const lock=(await request().input('resource',sql.NVarChar(255),'lms-membership-reauth:'+current.accountId).query("DECLARE @r INT;EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;SELECT @r result;")).recordset[0].result;if(lock<0)throw error(409,'Account is busy; retry after review');}
   const valid=(await request().input('operator',sql.Bit,operator).query(`
    SELECT a.id FROM dbo.account_sessions x JOIN dbo.accounts a ON a.id=x.account_id
    LEFT JOIN dbo.school_memberships m ON m.id=x.active_membership_id AND m.account_id=a.id
    LEFT JOIN dbo.schools s ON s.id=m.school_id
    WHERE x.token_hash=@session AND a.id=@actor AND a.status='active' AND x.security_version=a.security_version
     AND x.revoked_at IS NULL AND x.expires_at>SYSUTCDATETIME()
     AND ((x.active_membership_id IS NULL AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=a.id AND g.revoked_at IS NULL))
      OR(m.status='active' AND s.status='active' AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id)))
     AND (@operator=0 OR EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=a.id AND g.permission='platform_operator' AND g.revoked_at IS NULL));`)).recordset;
   if(valid.length!==1)throw denied();const result=await operation(request,current);await tx.commit();return result;
  }catch(cause){await tx.rollback().catch(()=>{});if(cause.statusCode)throw cause;if([cause,...(cause.precedingErrors||[])].some(e=>[2601,2627,1205,50040].includes(e.number)))throw error(409,'Invitation or membership changed; retry after review');throw error(500,'Membership invitation failed');}
 }
 async function scopeLock(request,schoolId,accountId){const result=(await request().input('resource',sql.NVarChar(255),`lms-admin-membership:${schoolId}:${accountId}`).query("DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @r result;")).recordset[0].result;if(result<0)throw error(409,'Membership is busy');}
 async function member(request,schoolId,accountId){return(await request().input('school',sql.Int,schoolId).input('target',sql.Int,accountId).query(`SELECT m.id,m.status,CASE WHEN EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id AND r.role='admin') THEN 1 ELSE 0 END is_admin
  FROM dbo.school_memberships m WITH(UPDLOCK,HOLDLOCK) WHERE m.school_id=@school AND m.account_id=@target`)).recordset[0];}
 function eligibleMembership(row){if(row?.status&&row.status!=='active')throw error(409,'Existing membership requires separate recovery review');if(row?.is_admin)throw error(409,'Account already has this school role');}
 async function targetAccount(request,id){return(await request().input('target',sql.Int,id).query(`SELECT a.id,a.login_key FROM dbo.accounts a WHERE a.id=@target AND a.status='active'
  AND NOT EXISTS(SELECT 1 FROM dbo.legacy_account_map l WHERE l.account_id=a.id AND l.source_table='students')
  AND NOT EXISTS(SELECT 1 FROM dbo.school_memberships m JOIN dbo.membership_roles r ON r.membership_id=m.id AND r.school_id=m.school_id WHERE m.account_id=a.id AND r.role='student')`)).recordset[0];}
 async function audit(request,schoolId,action,resourceType,resourceId,membershipId=null){await request().input('school',sql.Int,schoolId).input('membership',sql.Int,membershipId).input('action',sql.VarChar(60),action).input('type',sql.VarChar(40),resourceType).input('id',sql.NVarChar(100),String(resourceId)).input('request',sql.NVarChar(100),crypto.randomUUID()).query(`INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id) VALUES(@school,@actor,@membership,@action,@type,@id,@request)`);}
 async function issue(token,input){
  if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['schoolId','accountId'].includes(k))||!positive(input.schoolId)||!positive(input.accountId))throw error(422,'Invalid explicit invitation target');
  return transaction(token,true,async request=>{
   const school=await activeSchool(request,input.schoolId);
   const account=await targetAccount(request,input.accountId);if(!account)throw denied();await scopeLock(request,school.id,account.id);eligibleMembership(await member(request,school.id,account.id));await localProfile(request,school.id,account.id);
   const binding=existingAccountBinding(account.id,account.login_key),secret=crypto.randomBytes(32).toString('base64url'),id=hash(secret);
   const result=(await request().input('id',sql.Char(64),id).input('school',sql.Int,school.id).input('binding',sql.NVarChar(255),binding).query(`
    IF EXISTS(SELECT 1 FROM dbo.school_invitations WHERE school_id=@school AND intended_login_key=@binding AND role='admin' AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>SYSUTCDATETIME()) THROW 50040,'Existing invitation pending',1;
    INSERT dbo.school_invitations(token_hash,school_id,invited_by,intended_login_key,role,expires_at) OUTPUT INSERTED.expires_at
    VALUES(@id,@school,@actor,@binding,'admin',DATEADD(hour,24,SYSUTCDATETIME()));`)).recordset[0];
   await audit(request,school.id,'existing_admin_invitation_issued','membership_invitation',id);return {id,schoolId:school.id,accountId:account.id,role:'admin',invitationToken:secret,expiresAt:result.expires_at};
  });
 }
 async function accept(token,invitationToken,{signOut=false}={}){if(!tokenValid(invitationToken))throw denied();if(typeof signOut!=='boolean')throw error(422,'Invalid acceptance policy');return transaction(token,false,async(request,current)=>{
  const invite=(await request().input('invitation',sql.Char(64),hash(invitationToken)).input('code',sql.NVarChar(50),schoolCode).query(`
   SELECT i.school_id,i.intended_login_key FROM dbo.school_invitations i WITH(UPDLOCK,HOLDLOCK)
   JOIN dbo.schools s ON s.id=i.school_id JOIN dbo.accounts issuer ON issuer.id=i.invited_by
   WHERE i.token_hash=@invitation AND i.role='admin' AND i.intended_login_key LIKE N'existing-admin:%'
    AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>SYSUTCDATETIME() AND s.status='active' AND issuer.status='active' AND (@code IS NULL OR s.code=@code)
    AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=issuer.id AND g.permission='platform_operator' AND g.revoked_at IS NULL);`)).recordset[0];
  if(!invite)throw denied();const account=await targetAccount(request,current.accountId);if(!account||invite.intended_login_key!==existingAccountBinding(account.id,account.login_key))throw denied();
  await scopeLock(request,invite.school_id,current.accountId);const membership=await member(request,invite.school_id,current.accountId);eligibleMembership(membership);await localProfile(request,invite.school_id,current.accountId);
  const result=(await request().input('school',sql.Int,invite.school_id).input('existing',sql.Int,membership?.id??null).input('invitation',sql.Char(64),hash(invitationToken)).query(`
   DECLARE @membership INT=@existing;
   IF @membership IS NULL BEGIN INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@actor,'active');SET @membership=SCOPE_IDENTITY();END;
   INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@membership,'admin');
   UPDATE dbo.school_invitations SET consumed_at=SYSUTCDATETIME() WHERE token_hash=@invitation;
   SELECT @membership membership_id;`)).recordset[0];
  if(signOut)await request().query("UPDATE dbo.accounts SET security_version=security_version+1 WHERE id=@actor;UPDATE dbo.account_sessions SET revoked_at=SYSUTCDATETIME() WHERE account_id=@actor AND revoked_at IS NULL;");
  await audit(request,invite.school_id,'existing_admin_invitation_accepted','membership',result.membership_id,result.membership_id);return {schoolId:invite.school_id,accountId:current.accountId,membershipId:result.membership_id,role:'admin',signedOut:signOut};
 },{reauth:signOut});}
 async function list(token,schoolId){if(!positive(schoolId))throw error(422,'Invalid school');return transaction(token,true,async request=>{
  await activeSchool(request,schoolId);
  const rows=(await request().input('school',sql.Int,schoolId).query(`SELECT token_hash,school_id,intended_login_key,created_at,expires_at,consumed_at,revoked_at,CASE WHEN expires_at<=SYSUTCDATETIME() THEN 1 ELSE 0 END expired
   FROM dbo.school_invitations WHERE school_id=@school AND role='admin' AND intended_login_key LIKE N'existing-admin:%' ORDER BY created_at DESC`)).recordset;
  return rows.map(row=>({id:row.token_hash,schoolId:row.school_id,accountId:Number(row.intended_login_key.split(':')[1]),role:'admin',createdAt:row.created_at,expiresAt:row.expires_at,status:row.consumed_at?'accepted':row.revoked_at?'revoked':row.expired?'expired':'pending'}));
 });}
 async function revoke(token,id){if(!idValid(id))throw error(422,'Invalid invitation identifier');return transaction(token,true,async request=>{
  const invite=(await request().input('id',sql.Char(64),id).input('code',sql.NVarChar(50),schoolCode).query("SELECT i.school_id,i.consumed_at,i.revoked_at FROM dbo.school_invitations i WITH(UPDLOCK,HOLDLOCK) JOIN dbo.schools s ON s.id=i.school_id WHERE i.token_hash=@id AND i.role='admin' AND i.intended_login_key LIKE N'existing-admin:%' AND (@code IS NULL OR s.code=@code)")).recordset[0];
  if(!invite)throw denied();if(invite.consumed_at||invite.revoked_at)throw error(409,'Invitation is no longer pending');await request().input('id',sql.Char(64),id).query('UPDATE dbo.school_invitations SET revoked_at=SYSUTCDATETIME() WHERE token_hash=@id');await audit(request,invite.school_id,'existing_admin_invitation_revoked','membership_invitation',id);return {revoked:true};
 });}
 async function eligible(token,schoolId){if(!positive(schoolId))throw error(422,'Invalid school');return transaction(token,true,async request=>{
  await activeSchool(request,schoolId);return(await request().input('school',sql.Int,schoolId).query(`SELECT p.account_id AS accountId,p.name,p.email,p.profile_type AS profileType FROM (${profilesSql}) p
   WHERE NOT EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=@school AND r.membership_id=p.membership_id AND r.role='admin')
    AND NOT EXISTS(SELECT 1 FROM dbo.school_memberships m JOIN dbo.membership_roles r ON r.school_id=m.school_id AND r.membership_id=m.id WHERE m.account_id=p.account_id AND r.role='student') ORDER BY p.name,p.account_id`)).recordset;
 });}
 const removableSql=`p.profile_type='teacher' AND p.account_id<>@actor
  AND NOT EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=p.account_id AND g.revoked_at IS NULL)
  AND EXISTS(SELECT 1 FROM dbo.identity_audit_events e WHERE e.school_id=@school AND e.action='existing_admin_invitation_accepted' AND e.resource_type='membership' AND e.resource_id=CONVERT(nvarchar(100),p.membership_id))
  AND EXISTS(SELECT 1 FROM (${profilesSql}) keeper JOIN dbo.membership_roles kr ON kr.school_id=@school AND kr.membership_id=keeper.membership_id AND kr.role='admin' WHERE keeper.account_id<>p.account_id AND keeper.profile_type='admin')`;
 async function administrators(token,schoolId){if(!positive(schoolId))throw error(422,'Invalid school');return transaction(token,true,async request=>{
  await activeSchool(request,schoolId);return(await request().input('school',sql.Int,schoolId).query(`SELECT p.account_id AS accountId,p.membership_id AS membershipId,p.name,p.email,p.profile_type AS profileType,a.security_version AS version,
   CASE WHEN ${removableSql} THEN 1 ELSE 0 END canRemove
   FROM (${profilesSql}) p JOIN dbo.accounts a ON a.id=p.account_id
   WHERE EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=@school AND r.membership_id=p.membership_id AND r.role='admin') ORDER BY p.name,p.account_id`)).recordset;
 });}
 async function removeAdministrator(token,input){
  if(!input||Object.keys(input).some(k=>!['schoolId','accountId','version'].includes(k))||![input.schoolId,input.accountId,input.version].every(positive))throw error(422,'Invalid administrator removal');
  return transaction(token,true,async(request,current)=>{
   if(current.accountId===input.accountId)throw error(409,'Self-removal requires separate recovery review');
   const locked=(await request().input('resource',sql.NVarChar(255),'lms-membership-reauth:'+input.accountId).query("DECLARE @r INT;EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;SELECT @r result;")).recordset[0].result;if(locked<0)throw error(409,'Account is busy; retry after review');
   await activeSchool(request,input.schoolId);await scopeLock(request,input.schoolId,input.accountId);
   const target=(await request().input('school',sql.Int,input.schoolId).input('target',sql.Int,input.accountId).input('version',sql.Int,input.version).query(`SELECT p.membership_id FROM (${profilesSql}) p JOIN dbo.accounts a ON a.id=p.account_id
    WHERE p.account_id=@target AND a.security_version=@version AND ${removableSql}
     AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=@school AND r.membership_id=p.membership_id AND r.role='admin')`)).recordset[0];
   if(!target)throw error(409,'Access changed or this administrator requires separate recovery review');
   await request().input('school',sql.Int,input.schoolId).input('target',sql.Int,input.accountId).input('member',sql.Int,target.membership_id).input('binding',sql.NVarChar(255),`existing-admin:${input.accountId}:%`).query(`
    DELETE dbo.membership_roles WHERE school_id=@school AND membership_id=@member AND role='admin';
    UPDATE dbo.accounts SET security_version=security_version+1 WHERE id=@target;
    UPDATE dbo.account_sessions SET revoked_at=SYSUTCDATETIME() WHERE account_id=@target AND revoked_at IS NULL;
    UPDATE dbo.school_invitations SET revoked_at=SYSUTCDATETIME() WHERE school_id=@school AND role='admin' AND intended_login_key LIKE @binding AND consumed_at IS NULL AND revoked_at IS NULL;`);
   await audit(request,input.schoolId,'invited_admin_role_removed','membership',target.membership_id);
   return {schoolId:input.schoolId,accountId:input.accountId,membershipId:target.membership_id,removed:true,version:input.version+1};
  });
 }
 return {issue,accept,list,revoke,eligible,administrators,removeAdministrator};
}
module.exports={createMembershipInvitationService,existingAccountBinding};
