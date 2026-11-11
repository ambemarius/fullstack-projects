// Reviewed additive009 only. Rehearsal defaults to rollback, with field-preservation checks.
const {sql}=require('../config/database');const {migrationFiles}=require('./migrate');
const {sourceSnapshot,checkOriginal}=require('./legacyAdoption');
function approvedTarget(state){if(state.name!=='schooldb'||String(state.server).toUpperCase()!=='MARIUS\\DEV')throw Error('Unapproved staff schema target');}
async function activate(database,{apply=false}={}){
 await database.connect();const state=(await database.getPool().request().query("SELECT DB_NAME() name,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server")).recordset[0];approvedTarget(state);
 const files=migrationFiles();if(files.length!==9||files[8].name!=='009_staff_profile_links.sql')throw Error('Unexpected migration scope');
 const tx=new sql.Transaction(database.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>new sql.Request(tx);
 try{
  const locked=(await request().query("DECLARE @r INT;EXEC @r=sys.sp_getapplock @Resource=N'lms-schema-migrations',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;SELECT @r result;")).recordset[0];if(locked.result<0)throw Error('Migration busy');
  const history=(await request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
  if(history.length<8||history.length>9||history.some((r,i)=>r.version!==files[i].name||r.checksum!==files[i].checksum))throw Error('Schema history mismatch');
  if(history.length===9){await tx.rollback();return {alreadyApplied:true};}
  const before=await sourceSnapshot(request);await request().query(files[8].text);await checkOriginal(request,before);
  const check=(await request().query("SELECT COUNT(*) count FROM dbo.staff_profile_links; SELECT COUNT(*) bad FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('dbo.staff_profile_links') AND (is_disabled=1 OR is_not_trusted=1)")).recordsets;if(check[0][0].count!==0||check[1][0].bad!==0)throw Error('Staff schema integrity check failed');
  if(apply){await request().input('version',sql.NVarChar(128),files[8].name).input('checksum',sql.Char(64),files[8].checksum).query('INSERT dbo.schema_migrations(version,checksum) VALUES(@version,@checksum)');await tx.commit();}else await tx.rollback();
  return {applied:apply,rehearsed:true,existingTablesPreserved:Object.keys(before.records).length,existingFieldsPreserved:true,newLinks:0};
 }catch(error){await tx.rollback().catch(()=>{});throw error;}
}
if(require.main===module){require('../config/environment').loadEnvironment();const database=require('../config/database').createDatabase();activate(database,{apply:process.argv.includes('--apply')}).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('Staff schema activation refused; credentials and records withheld');process.exitCode=1;}).finally(()=>database.close());}
module.exports={activate,approvedTarget};
