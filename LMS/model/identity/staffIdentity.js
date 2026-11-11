const bcrypt=require('bcrypt');const {sql}=require('../../config/database');
const {createStaffProfileResolver}=require('./staffProfileResolver');
const denied=()=>Object.assign(new Error('Access denied'),{statusCode:403});
function enableStaffIdentity(service,database){
 const previousResolve=service.resolveSession,previousLogin=service.loginSchoolIdentity,previousSwitch=service.switchSchool;
 if(typeof service.staffCoreResolve!=='function')throw Error('Staff identity requires the guarded legacy adapter');
 const resolver=createStaffProfileResolver({resolveSession:service.staffCoreResolve},database);
 service.resolveSession=async token=>{
  const current=await service.staffCoreResolve(token);if(!current?.schoolId)return null;
  const profile=await resolver.resolve(token);if(!profile){const linked=(await database.getPool().request().input('school',sql.Int,current.schoolId).input('membership',sql.Int,current.membershipId).input('account',sql.Int,current.accountId).query('SELECT id FROM dbo.staff_profile_links WHERE school_id=@school AND membership_id=@membership AND account_id=@account')).recordset.length;if(linked)return null;return previousResolve(token);}
  const anchor=(await database.getPool().request().input('account',sql.Int,profile.accountId).query(`
   SELECT a.login_key,(SELECT COUNT(*) FROM dbo.legacy_account_map l WHERE l.account_id=a.id) anchors,
    (SELECT COUNT(*) FROM dbo.legacy_account_map l LEFT JOIN dbo.Admins ad ON l.source_table='Admins' AND ad.id=l.legacy_id AND ad.school_id=l.school_id LEFT JOIN dbo.teachers t ON l.source_table='teachers' AND t.id=l.legacy_id AND t.school_id=l.school_id
     WHERE l.account_id=a.id AND l.reconciliation_status='verified' AND
      ((ad.id IS NOT NULL AND LOWER(LTRIM(RTRIM(ad.role)))='admin' AND ad.password COLLATE Latin1_General_100_BIN2=a.password_hash COLLATE Latin1_General_100_BIN2)
       OR(t.id IS NOT NULL AND t.status='active' AND t.role='teacher' AND t.password COLLATE Latin1_General_100_BIN2=a.password_hash COLLATE Latin1_General_100_BIN2))) validAnchors
   FROM dbo.accounts a WHERE a.id=@account AND a.status='active'`)).recordset[0];
  if(!anchor||!(anchor.anchors===1&&anchor.validAnchors===1||anchor.anchors===0&&anchor.login_key.startsWith('native-staff:')))return null;
  // Resolver proves current source state; the previous guard need not understand native profiles.
  const core=await service.staffCoreResolve(token);return core&&core.accountId===profile.accountId&&core.schoolId===profile.schoolId&&core.membershipId===profile.membershipId?core:null;
 };
 service.loginSchoolIdentity=async(schoolCode,type,identifier,password)=>{
  if(!['staff','admin'].includes(type))return previousLogin(schoolCode,type,identifier,password);
  if(typeof schoolCode!=='string'||!/^[A-Z0-9_-]{2,50}$/.test(schoolCode)||typeof identifier!=='string'||!identifier||identifier!==identifier.trim()||identifier.length>255||typeof password!=='string'||!password||Buffer.byteLength(password,'utf8')>72)throw denied();
  await database.connect();const rows=(await database.getPool().request().input('code',sql.NVarChar(50),schoolCode).input('email',sql.NVarChar(255),identifier).input('admin',sql.Bit,type==='admin').query(`SELECT a.id,a.password_hash,l.membership_id FROM dbo.staff_profile_links l LEFT JOIN dbo.auxiliary_staff p ON p.id=l.auxiliary_profile_id AND p.school_id=l.school_id LEFT JOIN dbo.Admins ad ON ad.id=l.admin_profile_id AND ad.school_id=l.school_id JOIN dbo.schools s ON s.id=l.school_id JOIN dbo.accounts a ON a.id=l.account_id WHERE s.code=@code AND ((@admin=0 AND p.email=@email AND p.status='active') OR(@admin=1 AND ad.email=@email AND LOWER(LTRIM(RTRIM(ad.role)))='admin')) AND s.status='active' AND a.status='active' AND l.link_status='active'`)).recordset;if(type==='admin'&&rows.length===0)return previousLogin(schoolCode,type,identifier,password);
  if(rows.length!==1||!await bcrypt.compare(password,rows[0].password_hash))throw denied();const row=rows[0],session=await service.createSession(row.id,row.membership_id);
  const equal=(await database.getPool().request().input('account',sql.Int,row.id).input('hash',sql.NVarChar(255),row.password_hash).query('SELECT id FROM dbo.accounts WHERE id=@account AND password_hash COLLATE Latin1_General_100_BIN2=@hash COLLATE Latin1_General_100_BIN2')).recordset.length===1;
  if(!equal||!await service.resolveSession(session.token)){await service.revokeSession(session.token);throw denied();}return session;
 };
 service.switchSchool=async(token,code)=>{if(!await service.resolveSession(token))throw denied();const session=await previousSwitch(token,code);if(!await service.resolveSession(session.token)){await service.revokeSession(session.token);throw denied();}return session;};
 return service;
}
module.exports={enableStaffIdentity};
