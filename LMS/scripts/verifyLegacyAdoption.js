const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const db=require('../config/database');const {targetName}=require('./legacyAdoption');const {migrationFiles}=require('./migrate');
const {createIdentityService}=require('../model/identity/identityService');const {createSchoolAccess}=require('../model/identity/schoolAccess');
async function verify(target='schooldb_m1_rehearsal_008eafa5e2aed4d8'){
 targetName(target);const reportFile=path.join(__dirname,`../backups/legacy-migration/${target==='schooldb'?'adoption-original':'adoption-rehearsal'}.json`);
 const expected=JSON.parse(fs.readFileSync(reportFile,'utf8'));assert.equal(expected.target,target);assert.equal(expected.committed,true);
 await db.connect();const tx=new db.sql.Transaction(db.pool);await tx.begin();let stage='target';
 try{
  const request=()=>new db.sql.Request(tx);
  await request().query(`USE ${targetName(target)}; SET XACT_ABORT OFF;`);
  const actual=(await request().query("SELECT DB_NAME() name,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server")).recordset[0];
  assert.equal(actual.name,target);assert.equal(actual.server,'MARIUS\\DEV');
  stage='counts-and-history';
  for(const [table,count]of Object.entries(expected.sourceCounts))assert.equal(Number((await request().query(`SELECT COUNT_BIG(*) count FROM dbo.[${table.replaceAll(']',']]')}]`)).recordset[0].count),count);
  const ledger=(await request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
  assert.deepEqual(ledger,migrationFiles().map(f=>({version:f.name,checksum:f.checksum})));
  assert.equal((await request().query('SELECT COUNT(*) count FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1')).recordset[0].count,0);
  assert.equal((await request().query('SELECT COUNT(*) count FROM dbo.legacy_account_map')).recordset[0].count,expected.mappedAccounts);
  assert.equal((await request().query("SELECT COUNT(*) count FROM dbo.legacy_account_map WHERE source_table='Admins' AND legacy_id=5")).recordset[0].count,0);
  const grants=(await request().query("SELECT g.permission,p.email,p.role,a.status FROM dbo.platform_role_grants g JOIN dbo.legacy_account_map m ON m.account_id=g.account_id AND m.source_table='Admins' JOIN dbo.Admins p ON p.id=m.legacy_id JOIN dbo.accounts a ON a.id=g.account_id WHERE g.revoked_at IS NULL")).recordset;
  assert.equal(grants.length,1);assert.equal(grants[0].email,'admin@school.local');assert.equal(grants[0].role.toLowerCase(),'admin');assert.equal(grants[0].status,'active');
  stage='canonical-session';
  const identity=createIdentityService({connect:async()=>{},getPool:()=>({request})});const access=createSchoolAccess(identity);
  const members=(await request().query("SELECT a.id account_id,m.id membership_id,a.status,m.school_id FROM dbo.school_memberships m JOIN dbo.accounts a ON a.id=m.account_id ORDER BY a.id")).recordset;
  const active=members.find(m=>m.status==='active');const inactive=members.find(m=>m.status==='disabled');assert.ok(active);assert.ok(inactive);
  await assert.rejects(identity.createSession(inactive.account_id,inactive.membership_id),error=>error.statusCode===403);
  const session=await identity.createSession(active.account_id,active.membership_id);const context=await access.resolve(session.token);
  assert.equal(context.schoolId,active.school_id);assert.equal(await identity.validateCsrf(session.token,session.csrfToken),true);
  await identity.revokeSession(session.token);assert.equal(await identity.resolveSession(session.token),null);
  stage='cross-school-rejection';
  const rejection=(await request().input('membership',db.sql.Int,active.membership_id).query(`
   INSERT dbo.schools(code,name,education_system,status) VALUES('ADOPTION_VERIFY_B','Migration verification only','Bilingual','active');
   DECLARE @school INT=SCOPE_IDENTITY();
   BEGIN TRY INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@membership,'admin');SELECT 0 rejected; END TRY
   BEGIN CATCH SELECT ERROR_NUMBER() rejected; END CATCH;`)).recordset[0].rejected;
  assert.equal(rejection,547);
  await tx.rollback();
  stage='integrity';const integrity=new db.sql.Request(db.pool,{requestTimeout:300000});await integrity.query(`DBCC CHECKDB (${targetName(target)}) WITH NO_INFOMSGS, MAXDOP=2;`);
  const result={target,passed:true,verifiedAt:new Date().toISOString(),sourceCountsPreserved:true,migrationChecksums:true,canonicalSession:true,inactiveSessionDenied:true,revocation:true,crossSchoolConstraintDenied:true,integrity:true,testChangesRolledBack:true};
  fs.writeFileSync(path.join(__dirname,`../backups/legacy-migration/${target==='schooldb'?'verification-original':'verification-rehearsal'}.json`),JSON.stringify(result,null,2));return result;
 }catch(error){await tx.rollback().catch(()=>{});throw Object.assign(new Error(`Verification stopped at ${stage}`),{stage,sqlNumber:error.number||null});}
}
if(require.main===module)verify(process.argv.includes('--original')?'schooldb':undefined).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(JSON.stringify({error:error.message,sqlNumber:error.sqlNumber}));process.exitCode=1;}).finally(()=>db.close());
module.exports={verify};
