const crypto=require('node:crypto');
const {sql,pool,connect}=require('../../config/database');
const validId=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
// Staged, read-only resolver. No runtime mounts it until invitation provisioning,
// login, source guards and migration activation are reviewed together.
function createStaffProfileResolver(identity,database={connect,getPool:()=>pool}){
 async function resolve(token){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  const current=await identity.resolveSession(token);
  if(!current||![current.accountId,current.schoolId,current.membershipId].every(validId))return null;
  await database.connect();
  const result=await database.getPool().request().input('session',sql.Char(64),crypto.createHash('sha256').update(token).digest('hex'))
   .input('account',sql.Int,current.accountId).input('school',sql.Int,current.schoolId).input('membership',sql.Int,current.membershipId).query(`
    SELECT l.id,l.link_version AS version,l.required_role AS requiredRole,
     CASE WHEN l.admin_profile_id IS NOT NULL THEN 'admin' WHEN l.teacher_profile_id IS NOT NULL THEN 'teacher' ELSE 'auxiliary' END AS profileType,
     COALESCE(l.admin_profile_id,l.teacher_profile_id,l.auxiliary_profile_id) AS profileId
    FROM dbo.staff_profile_links l
    JOIN dbo.account_sessions x ON x.token_hash=@session AND x.account_id=l.account_id AND x.active_membership_id=l.membership_id
    JOIN dbo.accounts a ON a.id=l.account_id AND a.status='active' AND a.security_version=x.security_version
    JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.school_id=l.school_id AND m.account_id=l.account_id AND m.status='active'
    JOIN dbo.schools s ON s.id=l.school_id AND s.status='active'
    JOIN dbo.membership_roles r ON r.membership_id=l.membership_id AND r.school_id=l.school_id AND r.role=l.required_role
    LEFT JOIN dbo.Admins ad ON ad.id=l.admin_profile_id AND ad.school_id=l.school_id
    LEFT JOIN dbo.teachers t ON t.id=l.teacher_profile_id AND t.school_id=l.school_id
    LEFT JOIN dbo.auxiliary_staff aux ON aux.id=l.auxiliary_profile_id AND aux.school_id=l.school_id
    WHERE l.account_id=@account AND l.school_id=@school AND l.membership_id=@membership AND l.link_status='active'
     AND x.revoked_at IS NULL AND x.expires_at>SYSUTCDATETIME()
     AND ((ad.id IS NOT NULL AND LOWER(LTRIM(RTRIM(ad.role)))='admin')
       OR (t.id IS NOT NULL AND t.role='teacher' AND t.status='active')
       OR (aux.id IS NOT NULL AND aux.status='active'));
   `);
  if(result.recordset.length!==1)return null;
  return Object.freeze({accountId:current.accountId,schoolId:current.schoolId,membershipId:current.membershipId,...result.recordset[0]});
 }
 return {resolve};
}
module.exports={createStaffProfileResolver};
