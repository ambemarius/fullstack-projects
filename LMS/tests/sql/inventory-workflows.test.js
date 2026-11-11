const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase,sql}=require('../../config/database');
const {loadTestEnvironment}=require('../../scripts/testEnvironment');
const {prepareInventorySample}=require('../../scripts/inventorySample');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createInventoryService}=require('../../model/identity/inventoryService');
const {createPracticeApp}=require('../../scripts/schoolPractice');
const {serve}=require('../helpers/http');
test('library and laboratory retain history, isolate schools and serialize competing circulation and stock writes',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());const fixtures=[];
 const sample=async()=>{const f=await prepareInventorySample(db,'ATT_SAMPLE_'+crypto.randomBytes(5).toString('hex').toUpperCase());fixtures.push(f);return f;};
 try{
  const a=await sample(),b=await sample(),identity=createIdentityService(db),access=createSchoolAccess(identity),service=createInventoryService(db,access);
  // Dashboard context is read from the signed-in membership, never query parameters or a global year.
  const {createSchoolHubService}=require('../../model/identity/schoolHubService');
  const hub=createSchoolHubService(db,identity,{academicLinks:true});
  for(const [label,fixture]of [['North',a],['South',b]]){
   await db.getPool().request().input('school',sql.Int,fixture.school.schoolId).input('label',sql.NVarChar(200),label).query(`
    UPDATE dbo.schools SET name=@label WHERE id=@school;
    UPDATE dbo.academic_years SET name=@label+' year',isCurrent=1 WHERE school_id=@school;`);
   const account=fixture.accounts.library,session=await identity.createSession(account.accountId,account.membershipId);
   const model=await hub(session.token);assert.equal(model.schoolName,label);assert.equal(model.yearLabel,'Academic year '+label+' year');
   assert.deepEqual(model.modules.map(m=>m.id),['library']);assert.deepEqual(model.groups,[]);
   await identity.revokeSession(session.token);assert.equal(await hub(session.token),null);
  }
  const contexts={};
  for(const [name,f]of [['a',a],['b',b]])for(const [area,account]of Object.entries(f.accounts)){
   const session=await identity.createSession(account.accountId,account.membershipId);
   contexts[name+area]=await access.resolve(session.token);
  }
  const save=(area,input,school='a')=>service.save(contexts[school+area],area,{operation:crypto.randomUUID(),...input});
  const library=school=>service.list(contexts[school+'library'],'library');
  const inventory=()=>service.list(contexts.alaboratory,'laboratory');
  const initial=await library('a'),foreign=await library('b'),copy=initial.copies[0],borrower='pupil:'+initial.pupils[0].id;
  assert.deepEqual((await service.list(contexts.alibrary,'library','BIO-01')).copies.map(c=>c.id),[copy.id]);
  assert.equal((await service.list(contexts.alibrary,'library',"' OR 1=1 --")).copies.length,0);
  await assert.rejects(service.list(contexts.alibrary,'library',[]),e=>e.statusCode===422);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await assert.rejects(save('library',{action:'checkout',copy:copy.id,version:0,borrower:'pupil:'+foreign.pupils[0].id,due:today}),e=>e.statusCode===404);
  await assert.rejects(save('library',{action:'checkout',copy:foreign.copies[0].id,version:0,borrower,due:today}),e=>e.statusCode===404);
  const checkout={action:'checkout',copy:copy.id,version:0,borrower,due:today};
  const attempts=await Promise.allSettled([save('library',checkout),save('library',checkout)]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(attempts.find(x=>x.status==='rejected').reason.statusCode,409);
  let current=(await library('a')).copies[0];assert.equal(current.action,'checkout');
  await save('library',{action:'renew',copy:copy.id,version:current.version,due:'2099-12-31'});
  current=(await library('a')).copies[0];
  await save('library',{action:'return',copy:copy.id,version:current.version});
  await assert.rejects(save('library',{action:'return',copy:copy.id,version:current.version}),e=>e.statusCode===409);
  current=(await library('a')).copies[0];
  await save('library',{action:'damaged',copy:copy.id,version:current.version});
  current=(await library('a')).copies[0];
  await assert.rejects(save('library',{...checkout,version:current.version}),e=>e.statusCode===409);
  await save('library',{action:'repair',copy:copy.id,version:current.version});
  assert.equal((await library('a')).history.length,5);
  assert.equal((await library('b')).history.length,0);
  const stock=(await inventory()).items[0];
  const request={action:'request',item:stock.id,quantity:'3',needed:today,purpose:'Microscopy lesson'};
  await save('requests',request);await save('requests',request);
  let requests=(await inventory()).requests;
  for(const r of requests)await save('laboratory',{action:'approve',request:r.id});
  const issues=await Promise.allSettled(requests.map(r=>save('laboratory',{action:'issue',request:r.id})));
  assert.equal(issues.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(issues.find(x=>x.status==='rejected').reason.statusCode,409);
  let issued=(await inventory()).requests.find(r=>r.status==='issued');
  assert.equal((await inventory()).items[0].available,1);
  await save('laboratory',{action:'damage',request:issued.id});
  assert.equal((await inventory()).items[0].available,1);
  const receive={action:'receive',item:stock.id,quantity:'2',operation:crypto.randomUUID()};
  await save('laboratory',receive);await assert.rejects(save('laboratory',receive),e=>e.statusCode===409);
  const remaining=(await inventory()).requests.find(r=>r.status==='approved');
  await save('laboratory',{action:'issue',request:remaining.id});
  await save('laboratory',{action:'return',request:remaining.id});
  assert.equal((await inventory()).items[0].available,3);
  const movements=(await inventory()).movements;
  assert.equal(movements.reduce((sum,m)=>sum+Number(m.delta),0),3);
  assert.ok(movements.some(m=>m.action==='damage'&&m.delta===0));
  assert.deepEqual((await service.list(contexts.arequests,'requests')).movements,[]);
  assert.equal((await service.list(contexts.blaboratory,'laboratory')).movements.length,1);
  await assert.rejects(save('requests',{...request,quantity:'1.5'}),e=>e.statusCode===422);
  await assert.rejects(save('requests',{action:'issue',request:remaining.id}),e=>e.statusCode===403);
  await assert.rejects(service.list(contexts.arequests,'library'),e=>e.statusCode===403);
  const foreignStock=(await service.list(contexts.blaboratory,'laboratory')).items[0];
  await assert.rejects(save('requests',{...request,item:foreignStock.id}),e=>e.statusCode===404);
  await save('laboratory',{action:'add',name:'Expired solution',category:'Chemistry',kind:'reagent',unit:'mL',location:'A',batch:'test',minimum:'1',expiry:'2000-01-01'});
  const expired=(await inventory()).items.find(i=>i.name==='Expired solution');
  await assert.rejects(save('requests',{...request,item:expired.id,quantity:'0.5'}),e=>e.statusCode===409);
  await save('laboratory',{action:'add',name:'Restricted solution',category:'Chemistry',kind:'reagent',unit:'mL',location:'A',batch:'test',minimum:'1',restricted:'on'});
  assert.equal((await service.list(contexts.arequests,'requests')).items.some(i=>i.name==='Restricted solution'),false);
  const base=await serve(t,createPracticeApp(db,a.accounts));
  assert.equal((await fetch(base+'/workspace/library')).status,403);
  assert.equal((await fetch(base+'/open/library',{method:'POST',headers:{Origin:'https://wrong.invalid'},redirect:'manual'})).status,403);
  for(const area of ['library','laboratory','requests']){
   const signed=await fetch(base+'/open/'+area,{method:'POST',headers:{Origin:'https://localhost:2030'},redirect:'manual'});
   assert.equal(signed.status,303);
   const cookies=signed.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
   const page=await fetch(base+'/workspace/'+area,{headers:{Cookie:cookies}});
   assert.equal(page.status,200);const html=await page.text();assert.match(html,/name="operation"/);assert.match(html,/Practice records/);
   if(area==='library'){
    const filtered=await fetch(base+'/workspace/library?search=BIO-01',{headers:{Cookie:cookies}});
    assert.equal(filtered.status,200);const body=await filtered.text();
    assert.match(body,/Search catalogue/);assert.doesNotMatch(body,/value="BIO-02"/);
   }
   if(area==='laboratory')assert.match(html,/Recent stock movements/);
   assert.equal((await fetch(base+'/workspace/'+area,{method:'POST',headers:{Cookie:cookies,Origin:'https://localhost:2030','Content-Type':'application/x-www-form-urlencoded'},body:'csrf=wrong',redirect:'manual'})).status,403);
  }
 }finally{
  for(const f of fixtures)await db.getPool().request().input('s',sql.Int,f.school.schoolId).query(`
   SET XACT_ABORT ON;BEGIN TRANSACTION;
   DECLARE @accounts TABLE(id int);INSERT @accounts SELECT account_id FROM dbo.school_memberships WHERE school_id=@s;
   DELETE dbo.library_events WHERE school_id=@s;DELETE dbo.library_copies WHERE school_id=@s;
   DELETE dbo.lab_movements WHERE school_id=@s;DELETE dbo.lab_requests WHERE school_id=@s;DELETE dbo.lab_items WHERE school_id=@s;
   DELETE dbo.inventory_operations WHERE school_id=@s;DELETE dbo.attendance_revisions WHERE school_id=@s;DELETE dbo.attendance_roster WHERE school_id=@s;
   DELETE dbo.attendance_sessions WHERE school_id=@s;DELETE dbo.students WHERE school_id=@s;DELETE dbo.classes WHERE school_id=@s;DELETE dbo.academic_years WHERE school_id=@s;
   DELETE dbo.account_sessions WHERE account_id IN(SELECT id FROM @accounts);DELETE dbo.membership_roles WHERE school_id=@s;DELETE dbo.school_memberships WHERE school_id=@s;
   DELETE dbo.accounts WHERE id IN(SELECT id FROM @accounts);DELETE dbo.schools WHERE id=@s;COMMIT;`);
 }
});
