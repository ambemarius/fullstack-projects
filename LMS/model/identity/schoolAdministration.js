const {sql}=require('../../config/database');
const crypto=require('node:crypto');
const positive=n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647;
const denied=()=>Object.assign(new Error('School super-administrator access is required'),{statusCode:403});
// Used inside the same transaction as the protected operation. All identifiers
// here are fixed aliases/parameters, never supplied by an HTTP caller.
const issuerAuthoritySql=`EXISTS(SELECT 1 FROM dbo.school_administrator_grants sg
 JOIN dbo.school_memberships sm ON sm.school_id=sg.school_id AND sm.id=sg.membership_id AND sm.account_id=sg.account_id
 JOIN dbo.membership_roles sr ON sr.school_id=sm.school_id AND sr.membership_id=sm.id AND sr.role='admin'
 WHERE sg.school_id=i.school_id AND sg.account_id=i.invited_by AND sg.permission='school_super_admin'
 AND sg.revoked_at IS NULL AND sm.status='active')`;
async function resolveManager(identity,token,schoolId){
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw denied();
 const actor=await identity.resolveSession(token);
 if(!actor||![actor.accountId,actor.membershipId,actor.schoolId].every(positive)||!actor.roles?.includes('admin')||
   (schoolId!==null&&schoolId!==actor.schoolId))throw denied();
 return actor;
}
async function verifyManager(request,actor,token){
 const row=(await request().input('manager',sql.Int,actor.accountId).input('managedSchool',sql.Int,actor.schoolId)
 .input('managedMembership',sql.Int,actor.membershipId).input('managerSession',sql.Char(64),crypto.createHash('sha256').update(token).digest('hex')).query(`
 SELECT s.name,s.code FROM dbo.account_sessions x JOIN dbo.accounts a ON a.id=x.account_id
 JOIN dbo.school_memberships m ON m.id=x.active_membership_id AND m.account_id=a.id
 JOIN dbo.schools s ON s.id=m.school_id
 JOIN dbo.school_administrator_grants g WITH(HOLDLOCK) ON g.school_id=m.school_id AND g.membership_id=m.id AND g.account_id=a.id
 WHERE x.token_hash=@managerSession AND a.id=@manager AND m.id=@managedMembership AND m.school_id=@managedSchool
 AND a.status='active' AND x.security_version=a.security_version AND x.revoked_at IS NULL AND x.expires_at>SYSUTCDATETIME()
 AND m.status='active' AND s.status='active' AND (@code IS NULL OR s.code=@code)
 AND g.permission='school_super_admin' AND g.revoked_at IS NULL
 AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id AND r.role='admin')`)).recordset[0];
 if(!row)throw denied();return row;
}
module.exports={resolveManager,verifyManager,issuerAuthoritySql};
