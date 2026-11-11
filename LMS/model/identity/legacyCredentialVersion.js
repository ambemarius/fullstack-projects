const db=require('../../config/database');
const tables={admin:'Admins',teacher:'teachers',student:'students'};
async function legacyIdentity(accountType,id,database={connect:db.connect,getPool:()=>db.pool},expectedPasswordHash,pupilLifecycle=require('../../config/runtimePolicy.json').canonicalPupilLifecycle===true){
 if(!Object.hasOwn(tables,accountType)||!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('Authentication required'),{statusCode:401});
 if(expectedPasswordHash!==undefined&&(typeof expectedPasswordHash!=='string'||!expectedPasswordHash||expectedPasswordHash.length>255))throw Object.assign(new Error('Authentication required'),{statusCode:401});
 const sourceState=accountType==='teacher'?"source.role='teacher' AND source.status='active'":accountType==='student'?"source.role='student' AND source.isWithdrawn=0":"LOWER(LTRIM(RTRIM(source.role)))='admin'";
 await database.connect();const result=(await database.getPool().request().input('source',db.sql.VarChar(20),tables[accountType]).input('id',db.sql.Int,id).input('role',db.sql.VarChar(30),accountType).input('expected',db.sql.NVarChar(255),expectedPasswordHash??null).query(`
  SELECT a.security_version,a.id AS accountId,m.school_id AS schoolId,m.id AS membershipId
  ${pupilLifecycle && accountType==='student' ? ',CAST(a.security_version AS FLOAT)+(SELECT COUNT_BIG(*) FROM dbo.pupil_withdrawal_access w WHERE w.school_id=m.school_id AND w.membership_id=m.id AND w.account_id=a.id) AS pupilTokenVersion' : ''}
  FROM dbo.legacy_account_map l JOIN dbo.accounts a ON a.id=l.account_id
  JOIN dbo.[${tables[accountType]}] source ON source.id=l.legacy_id AND source.school_id=l.school_id
  JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.account_id=a.id AND m.school_id=l.school_id JOIN dbo.schools s ON s.id=m.school_id
  WHERE l.source_table=@source AND l.legacy_id=@id AND l.reconciliation_status='verified' AND a.status='active' AND m.status='active' AND s.status='active'
   AND ${sourceState} AND a.password_hash COLLATE Latin1_General_100_BIN2=source.password COLLATE Latin1_General_100_BIN2
   AND (@expected IS NULL OR source.password COLLATE Latin1_General_100_BIN2=@expected COLLATE Latin1_General_100_BIN2)
   AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id AND r.role=@role)`)).recordset;
 if(result.length!==1||!Number.isSafeInteger(result[0].security_version)||result[0].security_version<1)throw Object.assign(new Error('Authentication required'),{statusCode:401});return Object.freeze(result[0]);
}
async function legacyCredentialVersion(...args){const identity=await legacyIdentity(...args);return identity.pupilTokenVersion??identity.security_version;}
module.exports={legacyCredentialVersion,legacyIdentity};
