const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');const {createDatabase,sql}=require('../../config/database');const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');const {createIdentityService}=require('../../model/identity/identityService');const {createSchoolAccess}=require('../../model/identity/schoolAccess');const {createAuxiliaryService}=require('../../model/identity/auxiliaryService');
test('auxiliary profiles isolate schools, reject stale edits, audit atomically and never grant account authority',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);const prefix='AUX_'+crypto.randomBytes(6).toString('hex');let ids;const trigger='aux_audit_'+crypto.randomBytes(6).toString('hex');let installed=false;
 try{
  ids=(await db.getPool().request().input('prefix',sql.NVarChar(50),prefix).query(`
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'A','Synthetic A','Bilingual','active');DECLARE @a INT=SCOPE_IDENTITY();
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'B','Synthetic B','Bilingual','active');DECLARE @b INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'A','unusable-fixture-hash','active');DECLARE @aa INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'B','unusable-fixture-hash','active');DECLARE @ab INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'T','unusable-fixture-hash','active');DECLARE @at INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@aa,'active');DECLARE @ma INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@ab,'active');DECLARE @mb INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@at,'active');DECLARE @mt INT=SCOPE_IDENTITY();
   INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@b,@mb,'admin'),(@a,@mt,'teacher');SELECT @a a,@b b,@aa aa,@ab ab,@at at,@ma ma,@mb mb,@mt mt;`)).recordset[0];
  const identity=createIdentityService(db),access=createSchoolAccess(identity),service=createAuxiliaryService(access,db);
  const a=await access.resolve((await identity.createSession(ids.aa,ids.ma)).token),b=await access.resolve((await identity.createSession(ids.ab,ids.mb)).token),teacher=await access.resolve((await identity.createSession(ids.at,ids.mt)).token);
  const authority=async()=>(await db.getPool().request().query('SELECT (SELECT COUNT(*) FROM dbo.accounts) accounts,(SELECT COUNT(*) FROM dbo.platform_role_grants) grants,(SELECT COUNT(*) FROM dbo.membership_roles) roles')).recordset[0];const before=await authority();
  const input={firstName:'Synthetic',lastName:'Auxiliary',email:prefix+'@example.invalid',jobTitle:'Platform operator (job label only)',phone:null};const created=await service.create(a,input);assert.equal(created.status,'pending');assert.equal(created.version.length,64);
  assert.equal((await service.list(b)).data.length,0);await assert.rejects(service.list(teacher),e=>e.statusCode===403);await assert.rejects(service.update(b,created.id,created.version,{phone:'123'}),e=>e.statusCode===404);
  const edited=await service.update(a,created.id,created.version,{phone:'123',middleName:null});await assert.rejects(service.update(a,created.id,created.version,{phone:'456'}),e=>e.statusCode===409);
  const race=await Promise.allSettled([service.update(a,created.id,edited.version,{phone:'111'}),service.update(a,created.id,edited.version,{phone:'222'})]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.statusCode,409);
  const latest=(await service.list(a)).data[0];const withdrawn=await service.setStatus(a,created.id,latest.version,'withdrawn');assert.equal(withdrawn.status,'withdrawn');assert.deepEqual(await authority(),before);
  await db.getPool().request().input('id',sql.Int,created.id).query("UPDATE dbo.auxiliary_staff SET name=N'Original legacy name' WHERE id=@id");
  const renamed=(await service.list(a)).data[0];assert.notEqual(renamed.version,withdrawn.version);await service.update(a,created.id,renamed.version,{phone:'333'});
  assert.equal((await db.getPool().request().input('id',sql.Int,created.id).query('SELECT name FROM dbo.auxiliary_staff WHERE id=@id')).recordset[0].name,'Original legacy name');
  const second=await service.create(b,input);assert.notEqual(second.id,created.id); // same email is allowed in a different school
  const countBefore=(await service.list(a)).total;
  await db.getPool().request().query(`CREATE TRIGGER dbo.[${trigger}] ON dbo.identity_audit_events AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE school_id=${ids.a} AND resource_type='auxiliary_staff') THROW 50000,'Synthetic audit failure',1; END`);installed=true;
  await assert.rejects(service.create(a,{...input,email:prefix+'-rollback@example.invalid'}),e=>e.statusCode===500);assert.equal((await service.list(a)).total,countBefore);
  await db.getPool().request().query(`DROP TRIGGER dbo.[${trigger}]`);installed=false;
  const audit=(await db.getPool().request().query(`SELECT changed_fields,reason_code FROM dbo.identity_audit_events WHERE school_id=${ids.a}`)).recordset;assert.ok(audit.some(r=>r.reason_code==='registration'));assert.ok(audit.some(r=>r.changed_fields==='status'));
 }finally{if(installed)await db.getPool().request().query(`DROP TRIGGER dbo.[${trigger}]`);if(ids)await db.getPool().request().query(`
  DELETE dbo.identity_audit_events WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.auxiliary_staff WHERE school_id IN(${ids.a},${ids.b});
  DELETE dbo.account_sessions WHERE account_id IN(${ids.aa},${ids.ab},${ids.at});DELETE dbo.membership_roles WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.accounts WHERE id IN(${ids.aa},${ids.ab},${ids.at});DELETE dbo.schools WHERE id IN(${ids.a},${ids.b});`);}
});
