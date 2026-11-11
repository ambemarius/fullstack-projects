const verifyToken=require('../../utils/verifyToken');const {legacyIdentity}=require('./legacyCredentialVersion');
const db=require('../../config/database');const denied=()=>Object.assign(new Error('Authentication required'),{statusCode:401});
const validId=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
function createLegacySchoolAccess(database={connect:db.connect,getPool:()=>db.pool},{pupilLifecycle}={}){
 const contexts=new WeakMap();
 async function read(token,roles){const claims=typeof token==='string'&&verifyToken(token);if(!claims||!roles.includes(claims.accountType))throw denied();const identity=await legacyIdentity(claims.accountType,claims.id,database,undefined,pupilLifecycle);
  if(![identity.accountId,identity.schoolId,identity.membershipId].every(validId)||(claims.credentialVersion??1)!==(identity.pupilTokenVersion??identity.security_version))throw denied();const expiresAt=new Date(claims.exp*1000);if(!Number.isFinite(expiresAt.getTime()))throw denied();return{accountId:identity.accountId,schoolId:identity.schoolId,membershipId:identity.membershipId,legacyId:claims.id,accountType:claims.accountType,securityVersion:identity.security_version,pupilTokenVersion:identity.pupilTokenVersion,expiresAt};}
 async function resolve(header,roles=['admin']){const match=typeof header==='string'&&/^Bearer ([^\s]+)$/.exec(header);if(!match)throw denied();const identity=await read(match[1],roles),context=Object.freeze({...identity});contexts.set(context,match[1]);return context;}
 async function authorize(context,roles=['admin']){const token=context&&contexts.get(context);if(!token)throw denied();const current=await read(token,roles);if(['accountId','schoolId','membershipId','legacyId','accountType','securityVersion'].some(key=>current[key]!==context[key]))throw denied();return current;}
 return{resolve,authorize};
}
// Administrator authority is rechecked inside every exam statement, not trusted from a prior scan.
const legacyAdminAuthoritySql=`EXISTS(SELECT 1 FROM dbo.legacy_account_map auth_map
 JOIN dbo.accounts auth_account ON auth_account.id=auth_map.account_id
 JOIN dbo.Admins auth_source ON auth_source.id=auth_map.legacy_id AND auth_source.school_id=auth_map.school_id AND auth_map.source_table='Admins'
 JOIN dbo.school_memberships auth_member ON auth_member.id=auth_map.membership_id AND auth_member.account_id=auth_account.id AND auth_member.school_id=auth_map.school_id
 JOIN dbo.schools auth_school ON auth_school.id=auth_member.school_id
 WHERE auth_map.reconciliation_status='verified' AND auth_map.legacy_id=@legacy_id AND auth_account.id=@account AND auth_member.id=@membership AND auth_member.school_id=@school
 AND auth_account.status='active' AND auth_account.security_version=@credential_version AND auth_member.status='active' AND auth_school.status='active'
 AND SYSUTCDATETIME()<@jwt_expires AND LOWER(LTRIM(RTRIM(auth_source.role)))='admin'
 AND auth_account.password_hash COLLATE Latin1_General_100_BIN2=auth_source.password COLLATE Latin1_General_100_BIN2
 AND EXISTS(SELECT 1 FROM dbo.membership_roles auth_role WHERE auth_role.school_id=@school AND auth_role.membership_id=@membership AND auth_role.role='admin'))`;
module.exports={createLegacySchoolAccess,legacyAdminAuthoritySql};
