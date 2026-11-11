const db=require('../config/database');
const {accountState}=require('./reconcileSchool');
const TARGET='schooldb_m1_rehearsal_008eafa5e2aed4d8';
async function inspect(){await db.connect();
 const result=await db.pool.request().query(`USE [${TARGET}]; SELECT DB_NAME() name; SELECT id,password,role FROM dbo.Admins; SELECT id,password,role,status FROM dbo.teachers; SELECT id,password,role,isWithdrawn FROM dbo.students; SELECT DISTINCT section FROM dbo.classes;`);
 if(result.recordsets[0][0].name!==TARGET)throw new Error('Target mismatch');
 const tables=['Admins','teachers','students'];
 return {target:TARGET,changes:0,accounts:tables.map((table,index)=>{
 const rows=result.recordsets[index+1];let eligible=0,inactive=0;const exceptions=[];
 for(const row of rows){try{const state=accountState(table,row);eligible++;if(state.account!=='active')inactive++;}catch(error){exceptions.push({id:row.id,reason:error.message.replace('Reconciliation refused: ','')});}}
 return {table,total:rows.length,eligible,inactive,exceptions};}),sections:result.recordsets[4].map(r=>r.section)};
}
if(require.main===module)inspect().then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{console.error('Account review stopped; credentials withheld');process.exitCode=1;}).finally(()=>db.close());
module.exports={inspect};
