// Original-data backup preparation only; never alters schema or school records.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const db=require('../config/database');
const literal=value=>`N'${String(value).replaceAll("'","''")}'`;
function packet({suffix,backupPath,files,dataPath,logPath}){
    if(!/^[a-f0-9]{16}$/.test(suffix)||![backupPath,dataPath,logPath].every(p=>typeof p==='string'&&path.win32.isAbsolute(p))||!Array.isArray(files)||!files.length||files.some(f=>![0,1].includes(f.type)||typeof f.name!=='string'))throw new Error('Unsupported backup layout');
    const target=`schooldb_m1_rehearsal_${suffix}`;
    const moves=files.map((f,i)=>`MOVE ${literal(f.name)} TO ${literal(path.win32.join(f.type===1?logPath:dataPath,`${target}_${i}.${f.type===1?'ldf':i===0?'mdf':'ndf'}`))}`);
    return `-- Contains real school data: restricted local DBA rehearsal only.\n-- Run the ENTIRE script on MARIUS\\DEV. Never replace schooldb.\nUSE [master];\nIF CAST(SERVERPROPERTY('ServerName') AS nvarchar(128))<>N'MARIUS\\DEV' THROW 50000,'Wrong SQL instance',1;\nIF DB_ID(${literal(target)}) IS NOT NULL THROW 50000,'Rehearsal target exists; stop for review',1;\nRESTORE VERIFYONLY FROM DISK=${literal(backupPath)} WITH CHECKSUM;\nRESTORE DATABASE [${target}] FROM DISK=${literal(backupPath)} WITH ${moves.join(',\n')}, RECOVERY,CHECKSUM;\nDBCC CHECKDB ([${target}]) WITH NO_INFOMSGS;\nSELECT name,state_desc FROM sys.databases WHERE name=${literal(target)};\n-- Do not grant public access. Ask the project maintainer to verify the copy before migration.\n`;
}
async function prepare(){
    await db.connect();
    const identity=(await db.pool.request().query("SELECT DB_NAME() db,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server,CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000)) data_path,CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(4000)) log_path,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','BACKUP DATABASE') can_backup")).recordset[0];
    if(identity.db!=='schooldb'||identity.server.toUpperCase()!=='MARIUS\\DEV'||identity.can_backup!==1)throw new Error('Unexpected source or missing backup permission');
    const files=(await db.pool.request().query('SELECT name,type,physical_name FROM sys.database_files ORDER BY file_id')).recordset;
    const suffix=crypto.randomBytes(8).toString('hex');
    const dataPath=identity.data_path||path.win32.dirname(files.find(f=>f.type===0).physical_name);
    const logPath=identity.log_path||path.win32.dirname(files.find(f=>f.type===1).physical_name);
    const backupPath=path.win32.join(dataPath,`schooldb_before_m1_${suffix}.bak`);
    const sql=packet({suffix,backupPath,files,dataPath,logPath});
    const directory=path.join(__dirname,'../backups/legacy-migration');fs.mkdirSync(directory,{recursive:true});
    const restoreFile=path.join(directory,`${suffix}_restore.sql`);
    // Persist recovery instructions before attempting the backup. No source probe or row changes.
    fs.writeFileSync(restoreFile,sql,{flag:'wx'});
    const request=new db.sql.Request(db.pool,{requestTimeout:300000});
    await request.input('file',db.sql.NVarChar(4000),backupPath).query('BACKUP DATABASE [schooldb] TO DISK=@file WITH COPY_ONLY,CHECKSUM;');
    const manifest={preparedAt:new Date().toISOString(),source:identity.server+'/schooldb',school:'LYCEE BATOURI',backupPath,target:`schooldb_m1_rehearsal_${suffix}`,restoreFile,backupCompleted:true,restoreVerified:false,sourceRecordsChanged:0};
    fs.writeFileSync(path.join(directory,`${suffix}_manifest.json`),JSON.stringify(manifest,null,2),{flag:'wx'});
    console.log(JSON.stringify(manifest,null,2));
}
if(require.main===module){if(!process.argv.includes('--backup-original')){console.error('Explicit --backup-original required');process.exitCode=1;}else prepare().catch(()=>{console.error('Backup preparation stopped; source records were not modified. Review server permissions and the generated packet.');process.exitCode=1;}).finally(()=>db.close());}
module.exports={packet};
