const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase,sql,withDatabase}=require('../../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const {createLegacySchoolAccess}=require('../../model/identity/legacySchoolAccess');
const {createLegacyReferenceReads}=require('../../model/identity/legacyReferenceReads');
const generateToken=require('../../utils/generateToken');
test('retained reference and academic metadata routes isolate two schools and authorize shared geography',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
 const query=text=>db.getPool().request().query(text),prefix='RREAD_'+crypto.randomBytes(5).toString('hex').toUpperCase();let ids;
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
  const extra=(await query(`UPDATE dbo.academic_years SET isCurrent=1 WHERE id IN(${ids.ya},${ids.yb});
   INSERT dbo.auxiliary_staff(name,firstName,lastName,email,role,status,school_id) VALUES('Synthetic A','Synthetic','A','${prefix}AX@example.invalid','Librarian','active',${ids.a});DECLARE @axa INT=SCOPE_IDENTITY();
   INSERT dbo.auxiliary_staff(name,firstName,lastName,email,role,status,school_id) VALUES('Synthetic B','Synthetic','B','${prefix}BX@example.invalid','Librarian','active',${ids.b});DECLARE @axb INT=SCOPE_IDENTITY();
   INSERT dbo.class_subjects(class_id,subject_id,coefficient,school_id) SELECT ${ids.ca},id,2,school_id FROM dbo.subjects WHERE school_id=${ids.a};DECLARE @csa INT=SCOPE_IDENTITY();
   INSERT dbo.class_subjects(class_id,subject_id,coefficient,school_id) SELECT ${ids.cb},id,3,school_id FROM dbo.subjects WHERE school_id=${ids.b};
   INSERT dbo.academic_year_students(academic_year_id,student_id,school_id) VALUES(${ids.ya},${ids.pa},${ids.a}),(${ids.yb},${ids.pb},${ids.b});
   INSERT dbo.time_slots(slot_number,start_time,end_time,is_break,sort_order,school_id) VALUES(1,'08:00','09:00',0,1,${ids.a}),(1,'09:00','10:00',0,1,${ids.b});
   INSERT dbo.regions(name) VALUES('${prefix}');DECLARE @region INT=SCOPE_IDENTITY();INSERT dbo.divisions(name,region_id) VALUES('${prefix}',@region);DECLARE @division INT=SCOPE_IDENTITY();INSERT dbo.subdivisions(name,division_id) VALUES('${prefix}',@division);
   SELECT @axa axa,@axb axb,@csa csa,@region region,@division division;`)).recordset[0];
  await query(`INSERT dbo.subject_scores(student_id,class_subject_id,academic_year_id,term,sequence,score,max_score,school_id,created_by) VALUES(${ids.pa},${extra.csa},${ids.ya},'First',1,40,50,${ids.a},${ids.da}),(${ids.pa},${extra.csa},${ids.ya},'First',2,45,50,${ids.a},${ids.da});`);
  for(const [source,id,school,label,role]of [['teachers',ids.ta,ids.a,'TA','teacher'],['teachers',ids.tb,ids.b,'TB','teacher'],['students',ids.pa,ids.a,'PA','student'],['students',ids.pb,ids.b,'PB','student']]){
    await query(`INSERT dbo.accounts(login_key,password_hash,status) VALUES('${prefix}${label}','unusable-fixture-hash','active');DECLARE @account INT=SCOPE_IDENTITY();INSERT dbo.school_memberships(school_id,account_id,status) VALUES(${school},@account,'active');DECLARE @member INT=SCOPE_IDENTITY();INSERT dbo.membership_roles VALUES(${school},@member,'${role}');INSERT dbo.legacy_account_map VALUES('${source}',${id},@account,${school},@member,'verified',SYSUTCDATETIME());`);
  }
  const access=createLegacySchoolAccess(db),service=createLegacyReferenceReads(access,db);
  const a=await access.resolve('Bearer '+generateToken(ids.da,'admin')),b=await access.resolve('Bearer '+generateToken(ids.db,'admin'));
  for(const [kind,own,foreign]of [['classes',ids.ca,ids.cb],['years',ids.ya,ids.yb],['auxiliary',extra.axa,extra.axb]]){
    assert.deepEqual((await service.records(a,kind)).map(r=>r.id),[own]);assert.equal((await service.records(a,kind,own)).id,own);
    await assert.rejects(service.records(a,kind,foreign),e=>e.statusCode===404);
  }
  const sa=(await service.records(a,'subjects'))[0],sb=(await service.records(b,'subjects'))[0];
  await assert.rejects(service.records(a,'subjects',sb.id),e=>e.statusCode===404);
  assert.equal((await service.records(a,'years',ids.ya)).numberOfStudents,1);
  assert.equal((await service.classSubjects(a,ids.ca))[0].classSubjectId,extra.csa);
  await assert.rejects(service.classSubjects(a,ids.cb),e=>e.statusCode===404);
  const context=await service.context(a);assert.equal(context.currentYear.id,ids.ya);assert.equal(context.slots.length,1);
  assert.notEqual(context.slots[0].id,(await service.context(b)).slots[0].id);
  assert.equal((await service.geography(a,'divisions',extra.region))[0].name,prefix);
  assert.equal((await service.geography(b,'subdivisions',extra.division))[0].name,prefix);
  const {serve}=require('../helpers/http'),{createApp}=require('../../app/app');
  const base=await serve(t,createApp({logging:false,legacyScopedReferencesEnabled:true,legacyScopedReportsEnabled:true,legacyScopedSelfEnabled:true,legacyCredentialVersionsEnabled:true,
    legacyPersonnelReadOnly:true,legacyAcademicLinksReadOnly:true,requestContext:(_req,_res,next)=>withDatabase(db,next)}));
  const headers={Authorization:'Bearer '+generateToken(ids.da,'admin'),Accept:'application/json'};
  const paths=['/academic-context','/academic-years','/academic-years/'+ids.ya,'/classes','/classes/'+ids.ca,'/classes/'+ids.ca+'/subjects','/classes/with-fees','/subjects','/subjects/'+sa.id,'/auxiliary','/auxiliary/'+extra.axa,'/locations/regions','/locations/regions/'+extra.region+'/divisions','/locations/divisions/'+extra.division+'/subdivisions'];
  for(const path of paths){const response=await fetch(base+'/api/v1'+path+'?schoolId='+ids.b,{headers});assert.equal(response.status,200,path);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-lms-scoped-references'),'1');const text=await response.text();assert.equal(text.includes('Synthetic B'),false);assert.equal(text.includes('unusable-fixture-hash'),false);}
  for(const path of ['/academic-years/'+ids.yb,'/classes/'+ids.cb,'/classes/'+ids.cb+'/subjects','/subjects/'+sb.id,'/auxiliary/'+extra.axb])assert.equal((await fetch(base+'/api/v1'+path,{headers})).status,404,path);


  for(const [role,id,path]of [['teacher',ids.ta,'teachers'],['student',ids.pa,'students']]){
    const response=await fetch(base+'/api/v1/'+path+'/profile?id='+ids.pb+'&schoolId='+ids.b,{headers:{Authorization:'Bearer '+generateToken(id,role)}});
    assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('x-lms-scoped-self'),'1');
    const data=(await response.json()).data;assert.equal(data.id,id);assert.equal(data.lastName,'A');assert.equal(Object.hasOwn(data,'password'),false);
    assert.equal((await fetch(base+'/api/v1/'+path+'/profile',{headers:{Authorization:'Bearer '+generateToken(id,role==='teacher'?'student':'teacher')}})).status,401);
  }
  const reportPath='/api/v1/report-cards/'+ids.ca+'/First/'+ids.ya;
  const reportResponse=await fetch(base+reportPath,{headers});assert.equal(reportResponse.status,200);
  assert.equal(reportResponse.headers.get('cache-control'),'no-store');assert.equal(reportResponse.headers.get('x-lms-scoped-reports'),'1');
  const report=await reportResponse.json();assert.equal(report.data.totalEnrolled,1);assert.equal(report.data.students[0].studentId,ids.pa);
  assert.equal(report.data.students[0].overallAvg,42.5);assert.equal(report.data.students[0].subjects[0].grade,'B');
  assert.equal(report.data.students[0].subjects[0].passmark,50);
  assert.equal(report.data.classGeneralAvg,42.5);assert.equal(report.data.students[0].position,1);
  for(const path of ['/api/v1/report-cards/'+ids.cb+'/First/'+ids.ya,'/api/v1/report-cards/'+ids.ca+'/First/'+ids.yb])assert.equal((await fetch(base+path,{headers})).status,404);
  assert.equal((await fetch(base+'/api/v1/report-cards/'+ids.ca+'/Invalid/'+ids.ya,{headers})).status,422);
  assert.equal((await fetch(base+reportPath,{headers:{Authorization:'Bearer '+generateToken(ids.ta,'teacher')}})).status,409);
  assert.equal((await fetch(base+'/api/v1/classes/0',{headers})).status,422);
  assert.equal((await fetch(base+'/api/v1/locations/regions')).status,401);
  await query(`UPDATE dbo.accounts SET security_version=security_version+1 WHERE id IN(SELECT account_id FROM dbo.legacy_account_map WHERE source_table='teachers' AND legacy_id=${ids.ta});`);
  assert.equal((await fetch(base+'/api/v1/teachers/profile',{headers:{Authorization:'Bearer '+generateToken(ids.ta,'teacher')}})).status,401);
  await query(`UPDATE dbo.students SET isWithdrawn=1 WHERE id=${ids.pa}`);
  assert.equal((await fetch(base+'/api/v1/students/profile',{headers:{Authorization:'Bearer '+generateToken(ids.pa,'student')}})).status,403);
  await query(`UPDATE dbo.accounts SET security_version=security_version+1 WHERE id=${ids.aa}`);
  await assert.rejects(service.geography(a,'regions'),e=>e.statusCode===401);await assert.rejects(service.context(a),e=>e.statusCode===401);
  assert.equal((await service.records(b,'subjects')).length,1);
 }finally{if(ids)await query(`DELETE dbo.subdivisions WHERE division_id IN(SELECT id FROM dbo.divisions WHERE region_id IN(SELECT id FROM dbo.regions WHERE name='${prefix}'));DELETE dbo.divisions WHERE region_id IN(SELECT id FROM dbo.regions WHERE name='${prefix}');DELETE dbo.regions WHERE name='${prefix}';DELETE dbo.time_slots WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.auxiliary_staff WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.subject_scores WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.class_subject_teachers WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.class_subjects WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.subject_allocations WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.student_fees WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.academic_year_students WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.students WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.subjects WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.academic_years WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.classes WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.teachers WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.legacy_account_map WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.membership_roles WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.accounts WHERE id IN(${ids.aa},${ids.ab}) OR login_key LIKE '${prefix}%';DELETE dbo.Admins WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.schools WHERE id IN(${ids.a},${ids.b});`);}
});
