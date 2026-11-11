const crypto=require('node:crypto');
const {sql,pool,connect}=require('../../config/database');
const {auxiliaryVersion}=require('./auxiliaryService');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const roles=new Set(['discipline_master','librarian','lab_attendant']);
const positive=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
const tokenValid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
function binding(account,schoolId,profile,role){return `staff-profile:${account.id}:${profile.id}:${role}:${hash(JSON.stringify([account.login_key,schoolId,auxiliaryVersion(profile),role]))}`;}
// Staged existing-account, new-membership flow only. No routes or runtime mount.
function createAuxiliaryInvitationService(identity,database={connect,getPool:()=>pool},{schoolCode=null}={}){
 async function transact(token,operator,work){
  if(!tokenValid(token))throw fail(403,'Access denied');const actor=await identity.resolveSession(token);
  if(!actor||!positive(actor.accountId)||(operator&&!actor.platformPermissions?.includes('platform_operator')))throw fail(403,'Access denied');
  await database.connect();const tx=new sql.Transaction(database.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const request=()=>new sql.Request(tx).input('actor',sql.Int,actor.accountId).input('session',sql.Char(64),hash(token));
  try{
   if(!operator)await lock(request,'lms-membership-reauth:'+actor.accountId);
   const authority=(await request().input('operator',sql.Bit,operator).query(`
    SELECT a.id FROM dbo.account_sessions x JOIN dbo.accounts a ON a.id=x.account_id
    LEFT JOIN dbo.school_memberships m ON m.id=x.active_membership_id AND m.account_id=a.id
    LEFT JOIN dbo.schools s ON s.id=m.school_id
    WHERE x.token_hash=@session AND x.account_id=@actor AND a.status='active' AND a.security_version=x.security_version
     AND x.revoked_at IS NULL AND x.expires_at>SYSUTCDATETIME()
     AND ((x.active_membership_id IS NULL AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=@actor AND g.revoked_at IS NULL))
       OR (m.status='active' AND s.status='active' AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id)))
     AND (@operator=0 OR EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=@actor AND g.permission='platform_operator' AND g.revoked_at IS NULL));`)).recordset;
   if(authority.length!==1)throw fail(403,'Access denied');const result=await work(request,actor);await tx.commit();return result;
  }catch(error){await tx.rollback().catch(()=>{});if(error.statusCode)throw error;
   if([error,...(error.precedingErrors||[])].some(e=>[2601,2627,1205].includes(e.number)))throw fail(409,'Staff invitation changed; review and retry');
   throw fail(500,'Staff invitation failed');}
 }
 async function lock(request,resource){const result=(await request().input('resource',sql.NVarChar(255),resource).query("DECLARE @r INT;EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;SELECT @r result;")).recordset[0].result;if(result<0)throw fail(409,'Staff account is busy; retry after review');}
 async function scope(request,schoolId,profileId,accountId){
  await lock(request,`lms-staff-profile:${schoolId}:${profileId}`);await lock(request,`lms-admin-membership:${schoolId}:${accountId}`);
  const school=(await request().input('school',sql.Int,schoolId).input('code',sql.NVarChar(50),schoolCode).query("SELECT id FROM dbo.schools WHERE id=@school AND status='active' AND (@code IS NULL OR code=@code)")).recordset[0];if(!school)throw fail(403,'Access denied');
 }
 async function account(request,id){const row=(await request().input('target',sql.Int,id).query(`SELECT a.id,a.login_key FROM dbo.accounts a WHERE a.id=@target AND a.status='active'
  AND NOT EXISTS(SELECT 1 FROM dbo.legacy_account_map l WHERE l.account_id=a.id AND l.source_table='students')
  AND NOT EXISTS(SELECT 1 FROM dbo.school_memberships m JOIN dbo.membership_roles r ON r.school_id=m.school_id AND r.membership_id=m.id WHERE m.account_id=a.id AND r.role='student')`)).recordset[0];if(!row)throw fail(403,'Access denied');return row;}
 async function profile(request,schoolId,id){const row=(await request().input('school',sql.Int,schoolId).input('profile',sql.Int,id).query(`SELECT id,school_id,name,firstName,middleName,lastName,email,phone,role,status,createdAt FROM dbo.auxiliary_staff p WITH(UPDLOCK,HOLDLOCK) WHERE school_id=@school AND id=@profile AND status='active' AND NOT EXISTS(SELECT 1 FROM dbo.auxiliary_staff other WHERE other.school_id=p.school_id AND other.email=p.email AND other.id<>p.id AND other.status='active')`)).recordset[0];if(!row)throw fail(409,'A reviewed active auxiliary profile is required');return row;}
 async function available(request,schoolId,accountId,profileId){
  const found=(await request().input('school',sql.Int,schoolId).input('target',sql.Int,accountId).input('profile',sql.Int,profileId).query(`
   SELECT 1 found WHERE EXISTS(SELECT 1 FROM dbo.school_memberships WHERE school_id=@school AND account_id=@target)
    OR EXISTS(SELECT 1 FROM dbo.staff_profile_links WHERE school_id=@school AND auxiliary_profile_id=@profile)
    OR EXISTS(SELECT 1 FROM dbo.legacy_account_map WHERE school_id=@school AND account_id=@target);`)).recordset;
  if(found.length)throw fail(409,'Existing membership or profile link requires separate review');
 }
 async function audit(request,schoolId,action,type,id){await request().input('school',sql.Int,schoolId).input('action',sql.VarChar(60),action).input('type',sql.VarChar(40),type).input('id',sql.NVarChar(100),String(id)).input('request',sql.NVarChar(100),crypto.randomUUID()).query(`INSERT dbo.identity_audit_events(school_id,actor_account_id,action,resource_type,resource_id,request_id) VALUES(@school,@actor,@action,@type,@id,@request)`);}
 async function issue(token,input){
  if(!input||Object.keys(input).some(k=>!['schoolId','accountId','profileId','role','profileVersion'].includes(k))||![input.schoolId,input.accountId,input.profileId].every(positive)||!roles.has(input.role)||typeof input.profileVersion!=='string'||!/^[a-f0-9]{64}$/.test(input.profileVersion))throw fail(422,'Invalid auxiliary invitation');
  return transact(token,true,async(request,actor)=>{
   if(actor.accountId===input.accountId)throw fail(409,'Self-invitation requires separate review');
   await scope(request,input.schoolId,input.profileId,input.accountId);const target=await account(request,input.accountId),person=await profile(request,input.schoolId,input.profileId);
   if(auxiliaryVersion(person)!==input.profileVersion)throw fail(409,'Auxiliary profile changed; reload it');await available(request,input.schoolId,input.accountId,input.profileId);
   const intended=binding(target,input.schoolId,person,input.role);
   const pending=(await request().input('school',sql.Int,input.schoolId).input('accountPattern',sql.NVarChar(255),`staff-profile:${target.id}:%`).input('profilePattern',sql.NVarChar(255),`staff-profile:%:${person.id}:%`).input('nativePattern',sql.NVarChar(255),`new-staff:${person.id}:%`).query(`SELECT token_hash FROM dbo.school_invitations WHERE school_id=@school AND (intended_login_key LIKE @accountPattern OR intended_login_key LIKE @profilePattern OR intended_login_key LIKE @nativePattern) AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>SYSUTCDATETIME()`)).recordset;
   if(pending.length)throw fail(409,'A pending invitation already claims this account or profile');
   const invitationToken=crypto.randomBytes(32).toString('base64url'),id=hash(invitationToken);
   const saved=(await request().input('school',sql.Int,input.schoolId).input('id',sql.Char(64),id).input('binding',sql.NVarChar(255),intended).input('role',sql.VarChar(30),input.role).query(`INSERT dbo.school_invitations(token_hash,school_id,invited_by,intended_login_key,role,expires_at) OUTPUT INSERTED.expires_at VALUES(@id,@school,@actor,@binding,@role,DATEADD(hour,24,SYSUTCDATETIME()))`)).recordset[0];
   await audit(request,input.schoolId,'auxiliary_profile_invitation_issued','membership_invitation',id);return {id,invitationToken,schoolId:input.schoolId,accountId:target.id,profileId:person.id,role:input.role,expiresAt:saved.expires_at};
  });
 }
 async function accept(token,invitationToken){if(!tokenValid(invitationToken))throw fail(403,'Access denied');return transact(token,false,async(request,actor)=>{
  const invite=(await request().input('id',sql.Char(64),hash(invitationToken)).query(`SELECT i.school_id,i.intended_login_key,i.role,i.invited_by FROM dbo.school_invitations i WITH(UPDLOCK,HOLDLOCK)
   JOIN dbo.accounts issuer ON issuer.id=i.invited_by AND issuer.status='active'
   WHERE i.token_hash=@id AND i.intended_login_key LIKE N'staff-profile:%' AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>SYSUTCDATETIME()
    AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=i.invited_by AND g.permission='platform_operator' AND g.revoked_at IS NULL)`)).recordset[0];
  if(!invite)throw fail(403,'Access denied');const match=/^staff-profile:([1-9]\d*):([1-9]\d*):(discipline_master|librarian|lab_attendant):([a-f0-9]{64})$/.exec(invite.intended_login_key);
  if(!match||Number(match[1])!==actor.accountId||match[3]!==invite.role)throw fail(403,'Access denied');const profileId=Number(match[2]);
  await scope(request,invite.school_id,profileId,actor.accountId);const target=await account(request,actor.accountId),person=await profile(request,invite.school_id,profileId);
  if(binding(target,invite.school_id,person,invite.role)!==invite.intended_login_key)throw fail(409,'Account or profile changed; request a new invitation');await available(request,invite.school_id,target.id,profileId);
  const created=(await request().input('school',sql.Int,invite.school_id).input('profile',sql.Int,profileId).input('role',sql.VarChar(30),invite.role).input('issuer',sql.Int,invite.invited_by).input('invitation',sql.Char(64),hash(invitationToken)).query(`
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@actor,'active');DECLARE @member INT=SCOPE_IDENTITY();
   INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@member,@role);
   INSERT dbo.staff_profile_links(school_id,membership_id,account_id,auxiliary_profile_id,required_role,created_by) VALUES(@school,@member,@actor,@profile,@role,@issuer);
   UPDATE dbo.school_invitations SET consumed_at=SYSUTCDATETIME() WHERE token_hash=@invitation;
   UPDATE dbo.accounts SET security_version=security_version+1 WHERE id=@actor;
   UPDATE dbo.account_sessions SET revoked_at=SYSUTCDATETIME() WHERE account_id=@actor AND revoked_at IS NULL;
   SELECT @member membershipId;`)).recordset[0];
  await audit(request,invite.school_id,'auxiliary_profile_invitation_accepted','membership',created.membershipId);
  return {schoolId:invite.school_id,accountId:actor.accountId,membershipId:created.membershipId,profileId,role:invite.role,signedOut:true};
 });}
 async function revoke(token,id){if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw fail(422,'Invalid invitation identifier');return transact(token,true,async request=>{
  const invite=(await request().input('id',sql.Char(64),id).query("SELECT school_id,consumed_at,revoked_at FROM dbo.school_invitations WITH(UPDLOCK,HOLDLOCK) WHERE token_hash=@id AND intended_login_key LIKE N'staff-profile:%'")).recordset[0];
  if(!invite)throw fail(403,'Access denied');if(invite.consumed_at||invite.revoked_at)throw fail(409,'Invitation is no longer pending');
  await request().input('id',sql.Char(64),id).query('UPDATE dbo.school_invitations SET revoked_at=SYSUTCDATETIME() WHERE token_hash=@id');
  await audit(request,invite.school_id,'auxiliary_profile_invitation_revoked','membership_invitation',id);return {revoked:true};
 });}
 return {issue,accept,revoke};
}
module.exports={createAuxiliaryInvitationService};
