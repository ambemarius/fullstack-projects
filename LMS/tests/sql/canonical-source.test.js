const test=require('node:test');const assert=require('node:assert/strict');const bcrypt=require('bcrypt');
const {createDatabase,sql}=require('../../config/database');const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');const {guardedIdentity}=require('../../scripts/canonicalSchool');
test('real-school identity adapter rejects legacy password, role and status drift without granting new authority',async t=>{
 loadTestEnvironment();const database=createDatabase();t.after(()=>database.close());await assertSyntheticDatabase(database);
 const tx=new sql.Transaction(database.getPool());await tx.begin();
 const request=()=>new sql.Request(tx);const secret='Synthetic-only-guard-password';const hash=await bcrypt.hash(secret,4);
 try{
  const ids=(await request().input('hash',sql.NVarChar(255),hash).query(`
   INSERT dbo.schools(code,name,education_system,status) VALUES('GUARD_SOURCE_A','Synthetic source guard','Bilingual','active');DECLARE @school INT=SCOPE_IDENTITY();
   INSERT dbo.Admins(name,email,password,role,school_id) VALUES('Synthetic admin','guard@example.invalid',@hash,'Admin',@school);DECLARE @profile INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES('guard:admin',@hash,'active');DECLARE @account INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@account,'active');DECLARE @membership INT=SCOPE_IDENTITY();
   INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@membership,'admin');
   INSERT dbo.legacy_account_map VALUES('Admins',@profile,@account,@school,@membership,'verified',SYSUTCDATETIME());
   INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,status,school_id) VALUES('Synthetic teacher','Synthetic','Teacher','guard.teacher@example.invalid',@hash,'Part-time','Anglophone','active',@school);DECLARE @teacher INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES('guard:teacher',@hash,'active');DECLARE @ta INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@ta,'active');DECLARE @tm INT=SCOPE_IDENTITY();
   INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@tm,'teacher');
   INSERT dbo.legacy_account_map VALUES('teachers',@teacher,@ta,@school,@tm,'verified',SYSUTCDATETIME());
   INSERT dbo.students(firstName,lastName,matricule,password,section,sex,school_id) VALUES('Synthetic','Pupil','GUARD-STUDENT',@hash,'Anglophone','Female',@school);DECLARE @pupil INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES('guard:pupil',@hash,'active');DECLARE @pa INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@pa,'active');DECLARE @pm INT=SCOPE_IDENTITY();
   INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@pm,'student');
   INSERT dbo.legacy_account_map VALUES('students',@pupil,@pa,@school,@pm,'verified',SYSUTCDATETIME());
   SELECT @profile profile,@teacher teacher,@ta teacherAccount,@tm teacherMembership,@pupil pupil;`)).recordset[0];
  const identity=guardedIdentity({connect:async()=>{},getPool:()=>({request})});
  await assert.rejects(identity.loginSchoolIdentity('GUARD_SOURCE_A','admin','guard@example.invalid','incorrect-password'),e=>e.statusCode===403);
  const session=await identity.loginSchoolIdentity('GUARD_SOURCE_A','admin','guard@example.invalid',secret);assert.ok(await identity.resolveSession(session.token));
  await request().input('id',sql.Int,ids.profile).query("UPDATE dbo.Admins SET role='teacher' WHERE id=@id");assert.equal(await identity.resolveSession(session.token),null);
  await request().input('id',sql.Int,ids.profile).query("UPDATE dbo.Admins SET role='Admin',password=N'changed-in-synthetic-transaction' WHERE id=@id");assert.equal(await identity.resolveSession(session.token),null);
  await assert.rejects(identity.loginSchoolIdentity('GUARD_SOURCE_A','admin','guard@example.invalid',secret),e=>e.statusCode===403);
  const teacherSession=await identity.createSession(ids.teacherAccount,ids.teacherMembership);assert.ok(await identity.resolveSession(teacherSession.token));
  await request().input('id',sql.Int,ids.teacher).query("UPDATE dbo.teachers SET status='suspended' WHERE id=@id");assert.equal(await identity.resolveSession(teacherSession.token),null);
  const pupilSession=await identity.loginSchoolIdentity('GUARD_SOURCE_A','student','GUARD-STUDENT',secret);assert.ok(await identity.resolveSession(pupilSession.token));
  await request().input('id',sql.Int,ids.pupil).query('UPDATE dbo.students SET isWithdrawn=1 WHERE id=@id');assert.equal(await identity.resolveSession(pupilSession.token),null);
 }finally{await tx.rollback();}
});
