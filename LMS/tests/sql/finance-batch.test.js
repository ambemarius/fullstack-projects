const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase,sql}=require('../../config/database');
const {loadTestEnvironment}=require('../../scripts/testEnvironment');
const {prepareAttendanceSample}=require('../../scripts/attendanceSample');
const {prepareFinanceSample}=require('../../scripts/financeSample');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createFinanceService}=require('../../model/identity/financeService');
const {createPracticeApp}=require('../../scripts/schoolPractice');
const {serve}=require('../helpers/http');
test('reviewed batch charges are atomic, session-bound, admin-only and resist stale and duplicate confirmations',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());const fixtures=[];
 const identity=createIdentityService(db),access=createSchoolAccess(identity),service=createFinanceService(db,access);
 async function fixture(){
  const school=await prepareAttendanceSample(db,'ATT_SAMPLE_'+crypto.randomBytes(5).toString('hex').toUpperCase());
  const f={school,accounts:{},contexts:{}};fixtures.push(f);
  for(const [area,role]of [['finance','admin'],['cashier','bursar']]){
   const a=await prepareFinanceSample(db,school,role);f.accounts[area]=a;
   const session=await identity.createSession(a.accountId,a.membershipId);f.contexts[area]=await access.resolve(session.token);
  }
  return f;
 }
 try{
  const a=await fixture(),b=await fixture(),initial=await service.list(a.contexts.finance),foreign=await service.list(b.contexts.finance);
  const ids=initial.pupils.map(p=>p.id).sort((a,b)=>a-b);
  const input={pupils:ids,year:initial.years[0].id,description:'Term 1 tuition',amount:'250',due:'2026-12-01'};
  const review=b=>service.reviewBulk(a.contexts.finance,{...input,...b});
  const count=async()=> (await service.list(a.contexts.finance)).charges.length;
  await assert.rejects(service.reviewBulk(a.contexts.cashier,input),e=>e.statusCode===403);
  for(const pupils of [[],[ids[0],ids[0]],Array(201).fill(ids[0])])await assert.rejects(review({pupils}),e=>e.statusCode===422);
  await assert.rejects(review({pupils:[ids[0],foreign.pupils[0].id]}),e=>e.statusCode===409);
  await assert.rejects(review({year:foreign.years[0].id}),e=>e.statusCode===404);
  const first=await review({});assert.equal(first.total,'750');assert.equal(await count(),0);
  first.amount='1';first.pupils[0].firstName='Tampered public copy';
  await assert.rejects(service.confirmBulk(b.contexts.finance,first.token),e=>e.statusCode===409);
  await assert.rejects(service.confirmBulk(a.contexts.cashier,first.token),e=>e.statusCode===403);
  const otherSession=await identity.createSession(a.accounts.finance.accountId,a.accounts.finance.membershipId);
  await assert.rejects(service.confirmBulk(await access.resolve(otherSession.token),first.token),e=>e.statusCode===409);
  const saved=await service.confirmBulk(a.contexts.finance,first.token);assert.equal(saved.charges.length,3);assert.equal(saved.total,'750');
  assert.ok((await service.list(a.contexts.finance)).charges.every(c=>c.amount==='250'));
  await assert.rejects(service.confirmBulk(a.contexts.finance,first.token),e=>e.statusCode===409);
  await assert.rejects(review({}),e=>e.statusCode===409);assert.equal(await count(),3);
  const old=await review({description:'Replaced review'}),replacement=await review({description:'Replacement'});
  await assert.rejects(service.confirmBulk(a.contexts.finance,old.token),e=>e.statusCode===409);
  const competition=await Promise.allSettled([service.confirmBulk(a.contexts.finance,replacement.token),service.confirmBulk(a.contexts.finance,replacement.token)]);
  assert.equal(competition.filter(r=>r.status==='fulfilled').length,1);assert.equal(await count(),6);
  const stale=await review({description:'Stale pupil review'});
  await db.getPool().request().input('s',sql.Int,a.school.schoolId).input('p',sql.Int,ids[0]).query("UPDATE dbo.students SET lastName='Changed synthetic name' WHERE school_id=@s AND id=@p");
  await assert.rejects(service.confirmBulk(a.contexts.finance,stale.token),e=>e.statusCode===409);assert.equal(await count(),6);
  const unavailable=await review({description:'Withdrawn review'});
  await db.getPool().request().input('s',sql.Int,a.school.schoolId).input('p',sql.Int,ids[0]).query('UPDATE dbo.students SET isWithdrawn=1 WHERE school_id=@s AND id=@p');
  await assert.rejects(service.confirmBulk(a.contexts.finance,unavailable.token),e=>e.statusCode===409);
  await db.getPool().request().input('s',sql.Int,a.school.schoolId).input('p',sql.Int,ids[0]).query('UPDATE dbo.students SET isWithdrawn=0 WHERE school_id=@s AND id=@p');
  const atomic=await review({description:'Atomic rollback'});
  const constraint='finance_batch_test_'+a.school.schoolId;
  try{
   await db.getPool().request().query(`ALTER TABLE dbo.finance_charges WITH CHECK ADD CONSTRAINT ${constraint}
     CHECK(NOT(school_id=${a.school.schoolId} AND student_id=${ids[1]} AND description='Atomic rollback'));`);
   await assert.rejects(service.confirmBulk(a.contexts.finance,atomic.token),e=>e.number===547&&e.message.includes(constraint));assert.equal(await count(),6);
  }finally{await db.getPool().request().query(`IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='${constraint}' AND parent_object_id=OBJECT_ID('dbo.finance_charges')) ALTER TABLE dbo.finance_charges DROP CONSTRAINT ${constraint};`);}
  const base=await serve(t,createPracticeApp(db,a.accounts));
  for(const area of ['finance','cashier']){
   const opened=await fetch(base+'/open/'+area,{method:'POST',headers:{Origin:'https://localhost:2030'},redirect:'manual'});
   const cookies=opened.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
   const html=await (await fetch(base+'/workspace/'+area,{headers:{Cookie:cookies}})).text();
   if(area==='cashier')assert.doesNotMatch(html,/Review batch charges/);
   const csrf=decodeURIComponent(cookies.match(new RegExp('__Host-lms_inventory_'+area+'_csrf=([^;]+)'))[1]);
   const post=(step,body,origin='https://localhost:2030')=>fetch(base+'/workspace/'+area+'/bulk/'+step,{method:'POST',headers:{Origin:origin,Cookie:cookies,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'manual'});
   const request={pupils:String(ids[0]),year:String(input.year),description:'HTTP fee',amount:'100',csrf};
   assert.equal((await post('review',{...request,csrf:'bad'})).status,403);
   assert.equal((await post('review',request,'https://wrong.invalid')).status,403);
   const response=await post('review',request);assert.equal(response.status,area==='finance'?200:403);
   if(area==='finance'){
    const body=await response.text();assert.match(body,/No charges have been saved yet/);
    const token=body.match(/name="review" value="([a-f0-9]+)"/)[1];
    const confirmation=await post('confirm',{csrf,review:token,amount:'1'});assert.equal(confirmation.status,200);
    assert.match(await confirmation.text(),/Batch charges saved/);assert.equal((await post('confirm',{csrf,review:token})).status,409);
   }
  }
  const revoked=await review({description:'Revoked review'});
  await db.getPool().request().input('m',sql.Int,a.accounts.finance.membershipId).query("UPDATE dbo.school_memberships SET status='revoked' WHERE id=@m");
  await assert.rejects(service.confirmBulk(a.contexts.finance,revoked.token),e=>e.statusCode===403);
 }finally{
  for(const f of fixtures)await db.getPool().request().input('s',sql.Int,f.school.schoolId).query(`
   SET XACT_ABORT ON;BEGIN TRANSACTION;DECLARE @accounts TABLE(id int);INSERT @accounts SELECT account_id FROM dbo.school_memberships WHERE school_id=@s;
   DELETE dbo.finance_reversals WHERE school_id=@s;DELETE dbo.finance_cancellations WHERE school_id=@s;DELETE dbo.finance_payments WHERE school_id=@s;DELETE dbo.finance_charges WHERE school_id=@s;
   DELETE dbo.attendance_revisions WHERE school_id=@s;DELETE dbo.attendance_roster WHERE school_id=@s;DELETE dbo.attendance_sessions WHERE school_id=@s;
   DELETE dbo.students WHERE school_id=@s;DELETE dbo.classes WHERE school_id=@s;DELETE dbo.academic_years WHERE school_id=@s;
   DELETE dbo.account_sessions WHERE account_id IN(SELECT id FROM @accounts);DELETE dbo.membership_roles WHERE school_id=@s;DELETE dbo.school_memberships WHERE school_id=@s;
   DELETE dbo.accounts WHERE id IN(SELECT id FROM @accounts);DELETE dbo.schools WHERE id=@s;COMMIT;`);
 }
});
