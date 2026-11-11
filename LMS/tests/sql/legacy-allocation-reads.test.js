const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase,sql,withDatabase}=require('../../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const {createLegacySchoolAccess}=require('../../model/identity/legacySchoolAccess');
const {createLegacyAllocationReads}=require('../../model/identity/legacyAllocationReads');
const generateToken=require('../../utils/generateToken');
test('retained allocation lists and dropdowns isolate two schools through actual HTTP and SQL',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
 const query=text=>db.getPool().request().query(text),prefix='AREAD_'+crypto.randomBytes(5).toString('hex').toUpperCase();let ids;
 try{
  ids=(await db.getPool().request().input('p',sql.NVarChar(30),prefix).query(`
   INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'A','Synthetic A','Bilingual','active');DECLARE @a INT=SCOPE_IDENTITY();INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'B','Synthetic B','Bilingual','active');DECLARE @b INT=SCOPE_IDENTITY();
   INSERT dbo.Admins(name,email,password,role,school_id) VALUES('Synthetic A',@p+'A@example.invalid','unusable-fixture-hash','Admin',@a);DECLARE @da INT=SCOPE_IDENTITY();INSERT dbo.Admins(name,email,password,role,school_id) VALUES('Synthetic B',@p+'B@example.invalid','unusable-fixture-hash','Admin',@b);DECLARE @db INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'A','unusable-fixture-hash','active');DECLARE @aa INT=SCOPE_IDENTITY();INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'B','unusable-fixture-hash','active');DECLARE @ab INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@aa,'active');DECLARE @ma INT=SCOPE_IDENTITY();INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@ab,'active');DECLARE @mb INT=SCOPE_IDENTITY();INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@b,@mb,'admin');INSERT dbo.legacy_account_map VALUES('Admins',@da,@aa,@a,@ma,'verified',SYSUTCDATETIME()),('Admins',@db,@ab,@b,@mb,'verified',SYSUTCDATETIME());
   INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,status,school_id) VALUES('Synthetic A','Synthetic','A',@p+'TA@example.invalid','unusable-fixture-hash','Part-time','Anglophone','active',@a);DECLARE @ta INT=SCOPE_IDENTITY();INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,status,school_id) VALUES('Synthetic B','Synthetic','B',@p+'TB@example.invalid','unusable-fixture-hash','Part-time','Anglophone','active',@b);DECLARE @tb INT=SCOPE_IDENTITY();
   INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone',@p+'A',1,@a);DECLARE @ca INT=SCOPE_IDENTITY();INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone',@p+'B',1,@b);DECLARE @cb INT=SCOPE_IDENTITY();
   INSERT dbo.academic_years(name,fromYear,toYear,createdBy,school_id) VALUES(@p+'A',2026,2027,@da,@a);DECLARE @ya INT=SCOPE_IDENTITY();INSERT dbo.academic_years(name,fromYear,toYear,createdBy,school_id) VALUES(@p+'B',2026,2027,@db,@b);DECLARE @yb INT=SCOPE_IDENTITY();INSERT dbo.subjects(name,code,school_id) VALUES('Synthetic A',@p+'A',@a),('Synthetic B',@p+'B',@b);
   INSERT dbo.students(firstName,lastName,matricule,password,section,sex,currentClassLevel,academicYearId,medicalStatus,school_id) VALUES('Synthetic','A',@p+'A','unusable-fixture-hash','Anglophone','Male',@ca,@ya,'Synthetic own marker',@a);DECLARE @pa INT=SCOPE_IDENTITY();INSERT dbo.students(firstName,lastName,matricule,password,section,sex,currentClassLevel,academicYearId,medicalStatus,school_id) VALUES('Synthetic','B',@p+'B','unusable-fixture-hash','Anglophone','Male',@cb,@yb,'Synthetic foreign marker',@b);DECLARE @pb INT=SCOPE_IDENTITY();INSERT dbo.students(firstName,lastName,matricule,password,section,sex,currentClassLevel,academicYearId,isWithdrawn,school_id) VALUES('Synthetic','Withdrawn',@p+'W','unusable-fixture-hash','Anglophone','Male',@ca,@ya,1,@a);DECLARE @pw INT=SCOPE_IDENTITY();
   INSERT dbo.student_fees(student_id,fee_type,amount,paid,school_id) VALUES(@pa,'tuition',125,1,@a),(@pb,'tuition',999,0,@b);
   SELECT @ya ya,@yb yb,@a a,@b b,@da da,@db db,@aa aa,@ab ab,@ma ma,@mb mb,@ta ta,@tb tb,@ca ca,@cb cb,@pa pa,@pb pb,@pw pw;`)).recordset[0];
  await query(`UPDATE dbo.academic_years SET isCurrent=1 WHERE id IN(${ids.ya},${ids.yb});
   INSERT dbo.subject_allocations(class_id,subject_id,academic_year_id,periods_week,school_id)
   SELECT ${ids.ca},id,${ids.ya},3,school_id FROM dbo.subjects WHERE school_id=${ids.a};
   INSERT dbo.subject_allocations(class_id,subject_id,academic_year_id,periods_week,school_id)
   SELECT ${ids.cb},id,${ids.yb},8,school_id FROM dbo.subjects WHERE school_id=${ids.b};`);
  const access=createLegacySchoolAccess(db),service=createLegacyAllocationReads(access,db);
  const a=await access.resolve('Bearer '+generateToken(ids.da,'admin')),b=await access.resolve('Bearer '+generateToken(ids.db,'admin'));
  assert.equal((await service.list(a))[0].periods_week,3);
  assert.equal((await service.list(b))[0].periods_week,8);
  assert.equal((await service.list(a,{classId:ids.ca,yearId:ids.ya}))[0].class_id,ids.ca);
  await assert.rejects(service.list(a,{yearId:ids.yb}),e=>e.statusCode===404);
  await assert.rejects(service.list(a,{classId:ids.cb}),e=>e.statusCode===404);
  const form=await service.formData(a);
  assert.deepEqual(form.classes.map(r=>r.id),[ids.ca]);assert.equal(form.classes[0].schoolLevel,'Secondary');
  assert.equal(form.subjects.length,1);assert.equal(form.subjects[0].name,'Synthetic A');
  assert.deepEqual(form.academicYears.map(r=>r.id),[ids.ya]);assert.equal(form.academicYears[0].numberOfStudents,0);
  const {serve}=require('../helpers/http'),{createApp}=require('../../app/app');
  const base=await serve(t,createApp({logging:false,legacyScopedAllocationsEnabled:true,legacyCredentialVersionsEnabled:true,
    legacyPersonnelReadOnly:true,legacyAcademicLinksReadOnly:true,requestContext:(_req,_res,next)=>withDatabase(db,next)}));
  const headers={Authorization:'Bearer '+generateToken(ids.da,'admin'),Accept:'application/json'};
  for(const path of ['/api/v1/allocations','/api/v1/allocations/class/'+ids.ca,'/api/v1/allocations/form-data']){
    const response=await fetch(base+path+'?schoolId='+ids.b,{headers});assert.equal(response.status,200,path);
    assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-lms-scoped-allocations'),'1');
    const text=await response.text();assert.equal(text.includes('Synthetic B'),false);assert.equal(text.includes('unusable-fixture-hash'),false);
  }
  for(const path of ['/api/v1/allocations?yearId='+ids.yb,'/api/v1/allocations/class/'+ids.cb])assert.equal((await fetch(base+path,{headers})).status,404);
  assert.equal((await fetch(base+'/api/v1/allocations?yearId=1%20OR%201=1',{headers})).status,422);
  assert.equal((await fetch(base+'/api/v1/allocations')).status,401);
  assert.equal((await fetch(base+'/api/v1/allocations',{method:'POST',headers})).status,409);
  await query(`UPDATE dbo.academic_years SET isCurrent=0 WHERE id=${ids.ya}`);
  await assert.rejects(service.list(a),e=>e.statusCode===400);
  assert.equal((await service.list(a,{yearId:ids.ya})).length,1);
  await query(`DELETE dbo.subject_allocations WHERE school_id=${ids.a}`);assert.deepEqual(await service.list(a,{yearId:ids.ya}),[]);
  await query(`UPDATE dbo.accounts SET security_version=security_version+1 WHERE id=${ids.aa}`);
  await assert.rejects(service.formData(a),e=>e.statusCode===401);
  assert.equal((await service.list(b)).length,1);
 }finally{if(ids)await query(`DELETE dbo.subject_allocations WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.student_fees WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.students WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.subjects WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.academic_years WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.classes WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.teachers WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.legacy_account_map WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.membership_roles WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.accounts WHERE id IN(${ids.aa},${ids.ab});DELETE dbo.Admins WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.schools WHERE id IN(${ids.a},${ids.b});`);}
});
