// Reviewed additive release 017. Defaults to rollback; never edits migrations001-009.
const fs=require('node:fs'),crypto=require('node:crypto');
const {sql}=require('../config/database');
const {sourceSnapshot,checkOriginal}=require('./legacyAdoption');
const schema=fs.readFileSync(require.resolve('../docs/implementation/staged/017_school_administration.sql'),'utf8');
const checksum=crypto.createHash('sha256').update(schema).digest('hex');
function approvedTarget(state){if(state.name!=='schooldb'||String(state.server).toUpperCase()!=='MARIUS\\DEV')throw Error('Unapproved school administration target');}
async function readiness(database){
 const result=(await database.getPool().request().query(`SELECT checksum FROM dbo.school_administration_release WHERE version=17;
 SELECT COUNT(*) bad FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('dbo.school_administrator_grants') AND (is_disabled=1 OR is_not_trusted=1);
 SELECT COUNT(*) available FROM dbo.school_administrator_grants g JOIN dbo.school_memberships m ON m.school_id=g.school_id AND m.id=g.membership_id AND m.account_id=g.account_id JOIN dbo.accounts a ON a.id=g.account_id JOIN dbo.schools s ON s.id=g.school_id
 WHERE s.code='LYCEE_BATOURI' AND s.status='active' AND m.status='active' AND a.status='active' AND g.permission='school_super_admin' AND g.revoked_at IS NULL
 AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id AND r.role='admin');`)).recordsets;
 if(result[0].length!==1||result[0][0].checksum!==checksum||result[1][0].bad||result[2][0].available<1)throw Error('School administration release is not ready');
 return {version:17,schoolSuperAdministrators:result[2][0].available};
}
async function activate(database,{apply=false}={}){
 await database.connect();approvedTarget((await database.getPool().request().query("SELECT DB_NAME() name,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server")).recordset[0]);
 const tx=new sql.Transaction(database.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>new sql.Request(tx);
 try{
  const lock=(await request().query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'lms-schema-migrations',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;SELECT @r result;")).recordset[0];if(lock.result<0)throw Error('Migration lock unavailable');
  const files=require('./migrate').migrationFiles(),history=(await request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
  if(files.length!==9||JSON.stringify(history.map(r=>[r.version,r.checksum]))!==JSON.stringify(files.map(f=>[f.name,f.checksum])))throw Error('Unexpected baseline migration history');
  const exists=(await request().query("SELECT OBJECT_ID('dbo.school_administrator_grants') grantsTable,OBJECT_ID('dbo.school_administration_release') releaseTable")).recordset[0];
  if(exists.grantsTable||exists.releaseTable){if(!exists.grantsTable||!exists.releaseTable)throw Error('Partial release requires review');const previous=(await request().query('SELECT checksum FROM dbo.school_administration_release WHERE version=17')).recordset;if(previous.length!==1||previous[0].checksum!==checksum)throw Error('Release checksum mismatch');await tx.rollback();return {alreadyApplied:true,...await readiness(database)};}
  const before=await sourceSnapshot(request);
  const accountsBefore=(await request().query('SELECT id,password_hash,security_version FROM dbo.accounts ORDER BY id')).recordset;
  // Explicit existing owner chosen during the approved legacy adoption. No guessed
  // account, email-only promotion, new platform grant or password reset.
  const owners=(await request().query(`SELECT l.school_id,l.membership_id,l.account_id FROM dbo.legacy_account_map l
   JOIN dbo.Admins p ON l.source_table='Admins' AND p.id=l.legacy_id AND p.school_id=l.school_id
   JOIN dbo.schools s ON s.id=l.school_id JOIN dbo.accounts a ON a.id=l.account_id
   JOIN dbo.school_memberships m ON m.school_id=l.school_id AND m.id=l.membership_id AND m.account_id=l.account_id
   WHERE s.code='LYCEE_BATOURI' AND s.name=N'LYCEE BATOURI' AND s.status='active'
   AND p.email=N'admin@school.local' AND LOWER(LTRIM(RTRIM(p.role)))='admin' AND l.reconciliation_status='verified'
   AND a.status='active' AND m.status='active' AND a.password_hash COLLATE Latin1_General_100_BIN2=p.password COLLATE Latin1_General_100_BIN2
   AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id AND r.role='admin')
   AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=a.id AND g.permission='platform_operator' AND g.revoked_at IS NULL)`)).recordset;
  if(owners.length!==1)throw Error('The previously designated owner requires review');const owner=owners[0];
  await request().query(schema);
  await request().input('school',sql.Int,owner.school_id).input('membership',sql.Int,owner.membership_id).input('account',sql.Int,owner.account_id).input('checksum',sql.Char(64),checksum).query(`
   INSERT dbo.school_administrator_grants(school_id,membership_id,account_id,permission,granted_by) VALUES(@school,@membership,@account,'school_super_admin',@account);
   CREATE TABLE dbo.school_administration_release(version int NOT NULL PRIMARY KEY,checksum char(64) NOT NULL,applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
   INSERT dbo.school_administration_release(version,checksum) VALUES(17,@checksum);`);
  await checkOriginal(request,before);const accountsAfter=(await request().query('SELECT id,password_hash,security_version FROM dbo.accounts ORDER BY id')).recordset;
  if(JSON.stringify(accountsBefore)!==JSON.stringify(accountsAfter))throw Error('Account preservation check failed');
  // Append the intentional release audit only after proving all pre-existing rows unchanged.
  await request().input('school',sql.Int,owner.school_id).input('membership',sql.Int,owner.membership_id).input('account',sql.Int,owner.account_id).query(`INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id) VALUES(@school,@account,@membership,'school_super_admin_bootstrapped','membership',CONVERT(nvarchar(100),@membership),'school-administration-017');`);
  if(apply)await tx.commit();else await tx.rollback();return {applied:apply,rehearsed:true,version:17,newSchoolGrants:1,originalFieldsPreserved:true,credentialsPreserved:true};
 }catch(error){await tx.rollback().catch(()=>{});throw error;}
}
if(require.main===module){require('../config/environment').loadEnvironment();const db=require('../config/database').createDatabase();activate(db,{apply:process.argv.includes('--apply')}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error('School administration activation refused: '+error.message);process.exitCode=1;}).finally(()=>db.close());}
module.exports={activate,readiness,approvedTarget};
