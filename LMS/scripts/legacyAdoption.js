// Explicit adoption of the owner-attested single-school database. No application activation.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const db=require('../config/database');const {migrationFiles}=require('./migrate');
const {OWNED,accountState,canonicalKey}=require('./reconcileSchool');
const COPY='schooldb_m1_rehearsal_008eafa5e2aed4d8';
const quote=value=>`[${String(value).replaceAll(']',']]')}]`;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rowDigest=rows=>digest(rows.map(row=>digest(row)).sort());
function targetName(value){if(!['schooldb',COPY].includes(value))throw new Error('Target not approved');return quote(value);}
async function sourceSnapshot(request){
 const columns=(await request().query(`SELECT t.name table_name,c.name column_name,ty.name type_name,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity
 FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
 WHERE t.schema_id=SCHEMA_ID('dbo') AND t.is_ms_shipped=0 ORDER BY t.name,c.column_id;`)).recordset;
 const names=[...new Set(columns.map(c=>c.table_name))];const records={};const counts={};
 for(const name of names){const rows=(await request().query(`SELECT * FROM dbo.${quote(name)} WITH(HOLDLOCK,TABLOCKX)`)).recordset;records[name]=rowDigest(rows);counts[name]=rows.length;}
 return {columns,records,counts,fingerprint:digest({columns,records})};
}
async function checkOriginal(request,snapshot){
 for(const name of Object.keys(snapshot.records)){
  const fields=snapshot.columns.filter(c=>c.table_name===name).map(c=>quote(c.column_name)).join(',');
  const rows=(await request().query(`SELECT ${fields} FROM dbo.${quote(name)}`)).recordset;
  if(rowDigest(rows)!==snapshot.records[name])throw new Error('Original field preservation failed');
 }
}
async function adopt({target=COPY,commit=false,expectedFingerprint}={}){
 targetName(target);if(target==='schooldb'&&(!commit||!expectedFingerprint))throw new Error('Original requires reviewed rehearsal fingerprint');
 await db.connect();const tx=new db.sql.Transaction(db.pool);await tx.begin(db.sql.ISOLATION_LEVEL.SERIALIZABLE);
 let stage='target';
 try{
  const request=()=>new db.sql.Request(tx,{requestTimeout:120000});
  await request().query(`USE ${targetName(target)}; SET XACT_ABORT ON;`);
  const identity=(await request().query("SELECT DB_NAME() name,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server")).recordset[0];
  if(identity.name!==target||identity.server.toUpperCase()!=='MARIUS\\DEV')throw new Error('Unexpected instance');
  await request().query("DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource=N'lms-schema-migrations',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; IF @r<0 THROW 50000,'Migration lock unavailable',1;");
  if((await request().query("SELECT name FROM sys.tables WHERE name IN ('schools','schema_migrations','legacy_adoption_runs')")).recordset.length)throw new Error('Already adopted or partially versioned; refusing replay');
  stage='source-snapshot';const snapshot=await sourceSnapshot(request);
  if(expectedFingerprint&&expectedFingerprint!==snapshot.fingerprint)throw new Error('Source differs from rehearsed copy');
  if(OWNED.some(name=>!snapshot.counts.hasOwnProperty(name)))throw new Error('Missing legacy table');
  const identities=[];const exceptions=[];
  for(const table of ['Admins','teachers','students']){
   const fields=table==='teachers'?'status':table==='students'?'isWithdrawn':'email';
   const rows=(await request().query(`SELECT id,password,role,${fields} FROM dbo.${quote(table)} ORDER BY id`)).recordset;
   for(const row of rows){
    // Known legacy Admins teacher-role row is retained without any canonical authority.
    if(table==='Admins'&&row.id===5&&String(row.role).trim().toLowerCase()==='teacher'){exceptions.push({table,id:row.id,reason:'non_admin_legacy_row_no_authority'});continue;}
    const state=accountState(table,row);identities.push({table,id:row.id,state,operator:table==='Admins'&&row.email==='admin@school.local'});
   }
  }
  if(identities.filter(i=>i.operator&&i.state.account==='active').length!==1)throw new Error('Designated operator missing or ambiguous');
  stage='compatibility';
  // Missing legacy values remain unknown. Do not infer Government references or old offering coefficients.
  await request().query(`IF COL_LENGTH('dbo.teachers','matricule') IS NULL ALTER TABLE dbo.teachers ADD matricule NVARCHAR(255) NULL;
  IF COL_LENGTH('dbo.class_subjects','coefficient') IS NULL ALTER TABLE dbo.class_subjects ADD coefficient DECIMAL(4,2) NULL;
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_key_columns c WHERE c.parent_object_id=OBJECT_ID('dbo.timetables') AND COL_NAME(c.parent_object_id,c.parent_column_id)='time_slot_id' AND c.referenced_object_id=OBJECT_ID('dbo.time_slots'))
   ALTER TABLE dbo.timetables WITH CHECK ADD CONSTRAINT FK_tt_slot FOREIGN KEY(time_slot_id) REFERENCES dbo.time_slots(id);`);
  const files=migrationFiles();
  for(const file of files.slice(1)){stage=file.name;await request().query(file.text);}
  stage='ownership';
  const school=(await request().query("INSERT dbo.schools(code,name,education_system,status,timezone) OUTPUT INSERTED.id VALUES(N'LYCEE_BATOURI',N'LYCEE BATOURI','Bilingual','active',N'Africa/Douala')")).recordset[0].id;
  for(const table of OWNED)await request().input('school',db.sql.Int,school).query(`UPDATE dbo.${quote(table)} SET school_id=@school;`);
  let actor;let membership;
  for(const identity of identities){stage='identity-mapping';
   const result=await request().input('school',db.sql.Int,school).input('id',db.sql.Int,identity.id).input('key',db.sql.NVarChar(255),canonicalKey(identity.table,identity.id))
   .input('status',db.sql.VarChar(20),identity.state.account).input('membershipStatus',db.sql.VarChar(20),identity.state.membership).input('role',db.sql.VarChar(30),identity.state.role)
   .input('table',db.sql.VarChar(20),identity.table).query(`
    INSERT dbo.accounts(login_key,password_hash,status) SELECT @key,password,@status FROM dbo.${quote(identity.table)} WHERE id=@id;
    DECLARE @account INT=SCOPE_IDENTITY();
    INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@account,@membershipStatus);
    DECLARE @membership INT=SCOPE_IDENTITY();
    INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@membership,@role);
    INSERT dbo.legacy_account_map(source_table,legacy_id,account_id,school_id,membership_id,reconciliation_status) VALUES(@table,@id,@account,@school,@membership,'verified');
    SELECT @account account_id,@membership membership_id;`);
   if(identity.operator){actor=result.recordset[0].account_id;membership=result.recordset[0].membership_id;}
  }
  stage='operator-and-provenance';
  await request().input('actor',db.sql.Int,actor).input('school',db.sql.Int,school).input('membership',db.sql.Int,membership).query(`
   INSERT dbo.platform_role_grants(account_id,permission,granted_by) VALUES(@actor,'platform_operator',@actor);
   INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id)
   VALUES(@school,@actor,@membership,'legacy_database_adopted','school',CONVERT(nvarchar(100),@school),'owner-approved-2026-10-26');`);
  await request().query(`CREATE TABLE dbo.schema_migrations(version NVARCHAR(128) NOT NULL PRIMARY KEY,checksum CHAR(64) NOT NULL,applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
   CREATE TABLE dbo.legacy_adoption_runs(id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,source_fingerprint CHAR(64) NOT NULL,school_id INT NOT NULL REFERENCES dbo.schools(id),
    actor_account_id INT NOT NULL REFERENCES dbo.accounts(id),attestation_ref NVARCHAR(100) NOT NULL,baseline_mode VARCHAR(30) NOT NULL,
    compatibility_notes NVARCHAR(1000) NOT NULL,exceptions_json NVARCHAR(MAX) NOT NULL,completed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());`);
  for(const file of files)await request().input('name',db.sql.NVarChar(128),file.name).input('checksum',db.sql.Char(64),file.checksum).query('INSERT dbo.schema_migrations(version,checksum) VALUES(@name,@checksum)');
  await request().input('fingerprint',db.sql.Char(64),snapshot.fingerprint).input('school',db.sql.Int,school).input('actor',db.sql.Int,actor)
   .input('exceptions',db.sql.NVarChar(db.sql.MAX),JSON.stringify(exceptions)).query(`INSERT dbo.legacy_adoption_runs(id,source_fingerprint,school_id,actor_account_id,attestation_ref,baseline_mode,compatibility_notes,exceptions_json)
   VALUES(NEWID(),@fingerprint,@school,@actor,N'owner-all-schooldb-2026-10-26','adopted_not_executed',N'001 adopted, not replayed. Legacy teacher matricule and offering coefficient remain NULL where unknown. No teaching-year or actor inference.',@exceptions)`);
  stage='preservation';await checkOriginal(request,snapshot);
  const untrusted=(await request().query('SELECT COUNT(*) count FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1')).recordset[0].count;
  if(untrusted)throw new Error('Untrusted constraints');
  for(const table of OWNED){const unresolved=(await request().input('school',db.sql.Int,school).query(`SELECT COUNT(*) count FROM dbo.${quote(table)} WHERE school_id IS NULL OR school_id<>@school`)).recordset[0].count;if(unresolved)throw new Error('Unresolved ownership');}
  const credentials=[];for(const table of ['Admins','teachers','students'])credentials.push((await request().input('table',db.sql.VarChar(20),table).query(`SELECT COUNT(*) count FROM dbo.legacy_account_map m JOIN dbo.accounts a ON a.id=m.account_id JOIN dbo.${quote(table)} p ON p.id=m.legacy_id WHERE m.source_table=@table AND a.password_hash<>p.password`)).recordset[0].count);
  if(credentials.some(Boolean))throw new Error('Credential preservation failed');
  const report={target,passed:true,committed:commit,sourceFingerprint:snapshot.fingerprint,sourceCounts:snapshot.counts,schoolId:school,mappedAccounts:identities.length,inactiveAccounts:identities.filter(i=>i.state.account!=='active').length,exceptions,originalFieldsPreserved:true,credentialsPreserved:true,trustedConstraints:true,migrations:files.map(f=>f.name)};
  if(commit)await tx.commit();else await tx.rollback();return report;
 }catch(error){await tx.rollback().catch(()=>{});const safe=new Error(`Adoption stopped at ${stage}; no changes committed`);safe.stage=stage;safe.sqlNumber=error.number||null;safe.reason=/^(Source differs|Already adopted|Designated operator|Unexpected instance|Missing legacy|Reconciliation refused|Original field)/.test(error.message)?error.message:undefined;throw safe;}
}
if(require.main===module){
 const args=process.argv.slice(2);const target=args.includes('--original')?'schooldb':COPY;const commit=args.includes('--apply');
 const evidence=path.join(__dirname,'../backups/legacy-migration/adoption-rehearsal.json');
 let expectedFingerprint;
 if(target==='schooldb'){
  const prior=fs.existsSync(evidence)?JSON.parse(fs.readFileSync(evidence,'utf8')):null;
  const verificationFile=path.join(__dirname,'../backups/legacy-migration/verification-rehearsal.json');
  const verification=fs.existsSync(verificationFile)?JSON.parse(fs.readFileSync(verificationFile,'utf8')):null;
  if(!prior?.passed||!prior.committed||prior.target!==COPY||!verification?.passed||!verification.integrity||verification.target!==COPY){console.error('Successful committed and independently verified rehearsal required');process.exitCode=1;}
  else expectedFingerprint=prior.sourceFingerprint;
 }
 if(!process.exitCode)adopt({target,commit,expectedFingerprint}).then(report=>{
  const output=path.join(__dirname,`../backups/legacy-migration/${target==='schooldb'?'adoption-original':commit?'adoption-rehearsal':'adoption-dry-run'}.json`);
  fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({target:report.target,passed:report.passed,committed:report.committed,mappedAccounts:report.mappedAccounts,inactiveAccounts:report.inactiveAccounts,exceptions:report.exceptions,originalFieldsPreserved:report.originalFieldsPreserved,credentialsPreserved:report.credentialsPreserved,trustedConstraints:report.trustedConstraints,evidence:output},null,2));
 }).catch(error=>{console.error(JSON.stringify({error:error.message,stage:error.stage,sqlNumber:error.sqlNumber,reason:error.reason}));process.exitCode=1;}).finally(()=>db.close());
}
module.exports={adopt,targetName,sourceSnapshot,checkOriginal,rowDigest};
