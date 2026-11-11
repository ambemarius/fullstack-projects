// Real-data copy only. Always rolls back; cannot target the original database.
const db=require('../config/database');
const {migrationFiles}=require('./migrate');
const TARGET='schooldb_m1_rehearsal_008eafa5e2aed4d8';
async function rehearse(){
 await db.connect();const transaction=new db.sql.Transaction(db.pool);await transaction.begin(db.sql.ISOLATION_LEVEL.SERIALIZABLE);
 let stage='target-check';
 try{
  const request=()=>new db.sql.Request(transaction);
  await request().query(`USE [${TARGET}];`);
  const identity=(await request().query("SELECT DB_NAME() name,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server")).recordset[0];
  if(identity.name!==TARGET||identity.server.toUpperCase()!=='MARIUS\\DEV')throw new Error('Target mismatch');
  const existing=(await request().query("SELECT name FROM sys.tables WHERE name IN ('schools','schema_migrations')")).recordset;
  if(existing.length)throw new Error('Copy is already versioned; review before another adoption');
  const before=(await request().query('SELECT COUNT_BIG(*) students FROM dbo.students; SELECT COUNT_BIG(*) teachers FROM dbo.teachers;')).recordsets;
  for(const file of migrationFiles().slice(1)){stage=file.name;await request().query(file.text);}
  stage='constraint-validation';
  const constraints=(await request().query('SELECT COUNT(*) untrusted FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1')).recordset[0];
  if(constraints.untrusted!==0)throw new Error('Untrusted constraints');
  const after=(await request().query('SELECT COUNT_BIG(*) students FROM dbo.students; SELECT COUNT_BIG(*) teachers FROM dbo.teachers;')).recordsets;
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Source count changed');
  await transaction.rollback();
  return {target:TARGET,mode:'always-rollback',expandMigrations:7,passed:true,sourceRecordsChanged:0,committed:false};
 }catch(error){await transaction.rollback().catch(()=>{});return {target:TARGET,mode:'always-rollback',passed:false,stage,sqlNumber:error.number||null,code:error.code||null,committed:false};}
}
if(require.main===module)rehearse().then(result=>{console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}).finally(()=>db.close());
module.exports={rehearse};
