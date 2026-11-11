const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase,sql}=require('../../config/database');
const {loadTestEnvironment}=require('../../scripts/testEnvironment');
const {prepareAttendanceSample}=require('../../scripts/attendanceSample');
const {prepareFinanceSample}=require('../../scripts/financeSample');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createFinanceService,today}=require('../../model/identity/financeService');
const {createPracticeApp}=require('../../scripts/schoolPractice');
const {serve}=require('../helpers/http');
test('finance isolates schools and cashier authority; receipts, partial payments, retries, races and reversals retain balances',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());const fixtures=[];
 const identity=createIdentityService(db),access=createSchoolAccess(identity),service=createFinanceService(db,access);
 async function sample(){
  const school=await prepareAttendanceSample(db,'ATT_SAMPLE_'+crypto.randomBytes(5).toString('hex').toUpperCase());
  const f={school,accounts:{},contexts:{},sessions:{}};fixtures.push(f);
  f.accounts.finance=await prepareFinanceSample(db,school);f.accounts.cashier=await prepareFinanceSample(db,school,'bursar');f.accounts.discipline=school;
  for(const [role,a]of Object.entries(f.accounts)){const session=await identity.createSession(a.accountId,a.membershipId);f.sessions[role]=session;f.contexts[role]=await access.resolve(session.token);}
  return f;
 }
 try{
  const a=await sample(),b=await sample();
  const list=()=>service.list(a.contexts.finance);
  const save=(input,context=a.contexts.finance)=>service.save(context,{operation:crypto.randomUUID(),...input});
  const first=await list(),other=await service.list(b.contexts.finance);
  const chargeInput={action:'charge',pupil:first.pupils[0].id,year:first.years[0].id,description:'Tuition <script>alert(1)</script>',amount:'1000',due:today()};
  await assert.rejects(save(chargeInput,a.contexts.cashier),e=>e.statusCode===403);
  await assert.rejects(service.list(a.contexts.discipline),e=>e.statusCode===403);
  await assert.rejects(save({...chargeInput,pupil:other.pupils[0].id}),e=>e.statusCode===404);
  await assert.rejects(save({...chargeInput,year:other.years[0].id}),e=>e.statusCode===404);
  for(const amount of ['0','-1','1.5','1e3','1000000000000'])await assert.rejects(save({...chargeInput,amount}),e=>e.statusCode===422);
  const op={...chargeInput,operation:crypto.randomUUID()},charge=await save(op);
  await assert.rejects(save(op),e=>e.statusCode===409);
  assert.equal((await list()).charges.length,1);
  const payment={action:'pay',charge:charge.id,amount:'700',paidOn:today(),method:'cash',reference:''};
  await assert.rejects(save(payment,b.contexts.cashier),e=>e.statusCode===404);
  await assert.rejects(save({...payment,method:'mobile'}),e=>e.statusCode===422);
  await assert.rejects(save({...payment,paidOn:'2099-01-01'}),e=>e.statusCode===422);
  const attempts=await Promise.allSettled([save(payment,a.contexts.cashier),save(payment,a.contexts.cashier)]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(attempts.find(r=>r.status==='rejected').reason.statusCode,409);
  const paid=attempts.find(r=>r.status==='fulfilled').value;
  assert.equal((await service.detail(a.contexts.finance,charge.id)).charge.balance,'300');
  const receipt=await service.receipt(a.contexts.cashier,paid.paymentId);assert.equal(receipt.payment.amount,'700');assert.match(receipt.receiptNumber,/^PAY-\d+-\d+$/);
  await assert.rejects(service.receipt(b.contexts.finance,paid.paymentId),e=>e.statusCode===404);
  await assert.rejects(save({action:'cancel',charge:charge.id,reason:'Mistake'}),e=>e.statusCode===409);
  const reversal={action:'reverse',charge:charge.id,payment:paid.paymentId,reason:'Wrong payment entry'};
  await assert.rejects(save(reversal,a.contexts.cashier),e=>e.statusCode===403);
  await save(reversal);await assert.rejects(save(reversal),e=>e.statusCode===409);
  assert.equal((await service.receipt(a.contexts.finance,paid.paymentId)).payment.reversed,'Wrong payment entry');
  assert.equal((await list()).totals.balance,1000n);
  const retry={...payment,amount:'300',operation:crypto.randomUUID()};await save(retry);await assert.rejects(save(retry),e=>e.statusCode===409);
  assert.equal((await list()).totals.paid,300n);
  const foreignCharge=await save({...chargeInput,pupil:other.pupils[0].id,year:other.years[0].id},b.contexts.finance);
  await assert.rejects(save({...reversal,charge:foreignCharge.id}),e=>e.statusCode===404);
  assert.equal((await service.list(b.contexts.finance)).totals.paid,0n);
  const cancelCharge=await save({...chargeInput,description:'Cancelled example'});
  await save({action:'cancel',charge:cancelCharge.id,reason:'Duplicate charge'});
  await assert.rejects(save({...payment,charge:cancelCharge.id}),e=>e.statusCode===409);
  assert.equal((await list()).totals.charged,1000n);
  assert.equal((await service.list(a.contexts.finance,'Cancelled')).charges.length,1);
  assert.equal((await service.list(a.contexts.finance,"' OR 1=1 --")).charges.length,0);
  const range={from:today(),to:today()};
  const report=await service.collections(a.contexts.cashier,range);
  assert.deepEqual(report.totals,{count:2,recorded:1000n,reversed:700n,net:300n});
  assert.equal(report.methods[0].net,300n);assert.equal(report.cashiers.length,2);
  assert.equal((await service.collections(a.contexts.finance,{...range,operator:String(a.accounts.cashier.membershipId)})).totals.net,0n);
  assert.equal((await service.collections(a.contexts.finance,{...range,method:'bank'})).rows.length,0);
  assert.equal((await service.collections(b.contexts.finance,range)).rows.length,0);
  await assert.rejects(service.collections(a.contexts.discipline,range),e=>e.statusCode===403);
  await assert.rejects(service.collections(a.contexts.finance,{...range,operator:b.accounts.finance.membershipId}),e=>e.statusCode===404);
  for(const bad of [{from:'2026-02-30'},{from:'2000-01-01'},{from:'2099-01-01'},{method:'cash OR 1=1'},{to:[]}])
   await assert.rejects(service.collections(a.contexts.finance,{...range,...bad}),e=>e.statusCode===422);
  const dated=await save({...chargeInput,amount:'500',description:'Report boundary example'});
  await save({...payment,charge:dated.id,amount:'123',paidOn:'2000-01-01',method:'bank',reference:'=1+1'});
  await save({...payment,charge:dated.id,amount:'77',paidOn:'2000-01-02',method:'bank',reference:'Transfer two'},a.contexts.cashier);
  const datedReport=await service.collections(a.contexts.finance,{from:'2000-01-01',to:'2000-01-02'});
  assert.equal(datedReport.totals.net,200n);assert.equal(datedReport.rows.length,2);
  assert.equal((await service.collections(a.contexts.finance,{from:'2000-01-01',to:'2000-01-01'})).totals.net,123n);
  assert.equal((await service.collections(a.contexts.finance,{from:'2000-01-02',to:'2000-01-02'})).totals.net,77n);
  const secondYear=(await db.getPool().request().input('s',sql.Int,a.school.schoolId).input('a',sql.Int,a.accounts.finance.accountId).query(`
   INSERT dbo.academic_years(name,fromYear,toYear,school_id,created_by_account_id) OUTPUT inserted.id VALUES('2025/2026',2025,2026,@s,@a)`)).recordset[0].id;
  await save({...chargeInput,year:secondYear,amount:'250',due:'2000-01-01',description:'Previous year fee'});
  await save({...chargeInput,pupil:first.pupils[1].id,amount:'999',description:'Other pupil fee'});
  const directory=await service.pupilStatement(a.contexts.cashier,{search:first.pupils[0].label.split(' · ')[1]});
  assert.deepEqual(directory.pupils.map(p=>p.id),[first.pupils[0].id]);
  const statement=await service.pupilStatement(a.contexts.cashier,{pupil:first.pupils[0].id});
  assert.deepEqual(statement.totals,{charged:1750n,paid:500n,balance:1250n,overdue:250n});
  assert.equal(statement.charges.length,4);assert.equal(statement.payments.length,4);
  assert.equal(statement.charges.some(c=>c.cancelled==='Duplicate charge'),true);
  assert.equal(statement.payments.some(p=>p.reversed==='Wrong payment entry'),true);
  const currentYear=await service.pupilStatement(a.contexts.finance,{pupil:first.pupils[0].id,year:first.years[0].id});
  assert.deepEqual(currentYear.totals,{charged:1500n,paid:500n,balance:1000n,overdue:0n});
  const previousYear=await service.pupilStatement(a.contexts.finance,{pupil:first.pupils[0].id,year:secondYear});
  assert.deepEqual(previousYear.totals,{charged:250n,paid:0n,balance:250n,overdue:250n});assert.equal(previousYear.payments.length,0);
  assert.equal((await service.pupilStatement(a.contexts.finance,{pupil:first.pupils[2].id})).charges.length,0);
  await assert.rejects(service.pupilStatement(a.contexts.finance,{pupil:other.pupils[0].id}),e=>e.statusCode===404);
  await assert.rejects(service.pupilStatement(a.contexts.finance,{pupil:first.pupils[0].id,year:other.years[0].id}),e=>e.statusCode===404);
  await assert.rejects(service.pupilStatement(a.contexts.discipline,{pupil:first.pupils[0].id}),e=>e.statusCode===403);
  await db.getPool().request().input('s',sql.Int,a.school.schoolId).input('p',sql.Int,first.pupils[1].id).query('UPDATE dbo.students SET isWithdrawn=1 WHERE school_id=@s AND id=@p');
  const withdrawn=await service.pupilStatement(a.contexts.finance,{pupil:first.pupils[1].id});assert.ok(withdrawn.pupil.isWithdrawn);assert.equal(withdrawn.totals.balance,999n);
  const base=await serve(t,createPracticeApp(db,a.accounts));
  assert.equal((await fetch(base+'/workspace/finance')).status,403);
  assert.equal((await fetch(base+'/workspace/finance/collections?format=csv')).status,403);
  assert.equal((await fetch(base+'/workspace/finance/statements?pupil='+first.pupils[0].id+'&format=csv')).status,403);
  for(const area of ['finance','cashier']){
   const opened=await fetch(base+'/open/'+area,{method:'POST',headers:{Origin:'https://localhost:2030'},redirect:'manual'});assert.equal(opened.status,303);
   const cookies=opened.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
   const get=path=>fetch(base+path,{headers:{Cookie:cookies}});
   const page=await get('/workspace/'+area);assert.equal(page.status,200);const html=await page.text();assert.match(html,/Financial management/);assert.doesNotMatch(html,/<script>alert/);
   if(area==='cashier')assert.doesNotMatch(html,/Create a pupil charge/);
   assert.match(html,/Collection reports and exports/);
   assert.match(html,/Pupil statements/);
   const statementPage=await get('/workspace/'+area+'/statements?pupil='+first.pupils[0].id+'&year='+secondYear);
   assert.equal(statementPage.status,200);const statementHtml=await statementPage.text();assert.match(statementHtml,/Previous year fee/);assert.doesNotMatch(statementHtml,/Other pupil fee|Report boundary example/);
   const fullStatement=await get('/workspace/'+area+'/statements?pupil='+first.pupils[0].id);
   const fullStatementHtml=await fullStatement.text();assert.match(fullStatementHtml,/zero balance does not confirm/);assert.doesNotMatch(fullStatementHtml,/<script>alert/);
   const statementCsv=await get('/workspace/'+area+'/statements?pupil='+first.pupils[0].id+'&year='+secondYear+'&format=csv');
   assert.equal(statementCsv.status,200);assert.match(statementCsv.headers.get('content-disposition'),/practice-statement-\d+.csv/);
   const statementText=await statementCsv.text();assert.match(statementText,/"250","0","250"/);assert.doesNotMatch(statementText,/Other pupil fee|Report boundary example/);
   const allCsv=await get('/workspace/'+area+'/statements?pupil='+first.pupils[0].id+'&format=csv');assert.match(await allCsv.text(),/"'=1\+1"/);
   assert.equal((await get('/workspace/'+area+'/statements?format=csv')).status,422);
   assert.equal((await get('/workspace/'+area+'/statements?pupil='+other.pupils[0].id+'&format=csv')).status,404);
   const collectionPage=await get('/workspace/'+area+'/collections');assert.equal(collectionPage.status,200);
   const collectionHtml=await collectionPage.text();assert.match(collectionHtml,/By cashier \/ administrator/);assert.doesNotMatch(collectionHtml,/<script>alert/);
   const download=await get('/workspace/'+area+'/collections?from=2000-01-01&to=2000-01-02&method=bank&format=csv');
   assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/practice-collections-2000-01-01-2000-01-02.csv/);
   const csv=await download.text();assert.match(csv,/"'=1\+1"/);assert.match(csv,/"123","0","123"/);assert.match(csv,/"77","0","77"/);
   assert.equal((await get('/workspace/'+area+'/collections?from=invalid')).status,422);
   assert.equal((await get('/workspace/'+area+'/collections?operator='+b.accounts.finance.membershipId)).status,404);
   const detail=await get('/workspace/'+area+'?charge='+charge.id);assert.equal(detail.status,200);const detailHtml=await detail.text();assert.match(detailHtml,/Receive a payment/);
   const printed=await get('/workspace/'+area+'/receipt/'+paid.paymentId);assert.equal(printed.status,200);const receiptHtml=await printed.text();assert.match(receiptHtml,/REVERSED/);assert.match(receiptHtml,/700 XAF/);assert.doesNotMatch(receiptHtml,/<script>alert/);
   assert.equal((await get('/workspace/'+area+'?charge='+foreignCharge.id)).status,404);
   const post=(body,origin='https://localhost:2030')=>fetch(base+'/workspace/'+area,{method:'POST',headers:{Cookie:cookies,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'manual'});
   assert.equal((await post({csrf:'wrong'})).status,403);
   const csrf=detailHtml.match(/name="csrf" value="([^"]+)"/)[1];
   assert.equal((await post({csrf},'https://foreign.invalid')).status,403);
   if(area==='cashier'){
    assert.equal((await post({...reversal,csrf})).status,403);
    const successful=await post({...payment,amount:'100',csrf,operation:crypto.randomUUID()});assert.equal(successful.status,303);assert.match(successful.headers.get('location'),/\/receipt\/\d+$/);
   }
  }
  const large=await save({...chargeInput,amount:'999999999999'});await save({...payment,charge:large.id,amount:'999999999998'});
  assert.equal((await service.detail(a.contexts.cashier,large.id)).charge.balance,'1');
  const bounded=await save({...chargeInput,amount:'10000',description:'Report row limit'});
  await db.getPool().request().input('s',sql.Int,a.school.schoolId).input('c',sql.Int,bounded.id).input('m',sql.Int,a.accounts.finance.membershipId).query(`
   INSERT dbo.finance_payments(school_id,charge_id,amount,paid_on,method,reference,actor_id,operation_id)
   SELECT TOP(5001) @s,@c,1,'20010101','other','Report limit fixture',@m,NEWID() FROM sys.all_objects a CROSS JOIN sys.all_objects b;`);
  await assert.rejects(service.collections(a.contexts.finance,{from:'2001-01-01',to:'2001-01-01'}),e=>e.statusCode===422&&e.message.includes('No partial totals'));
  await assert.rejects(service.pupilStatement(a.contexts.finance,{pupil:first.pupils[0].id}),e=>e.statusCode===422&&e.message.includes('No partial totals'));
  await db.getPool().request().input('m',sql.Int,a.accounts.cashier.membershipId).query("UPDATE dbo.school_memberships SET status='revoked' WHERE id=@m");
  await assert.rejects(service.list(a.contexts.cashier),e=>e.statusCode===403);
  await assert.rejects(service.collections(a.contexts.cashier,range),e=>e.statusCode===403);
  await assert.rejects(service.pupilStatement(a.contexts.cashier,{pupil:first.pupils[0].id}),e=>e.statusCode===403);
 }finally{
  const installed=(await db.getPool().request().query("SELECT OBJECT_ID('dbo.finance_charges') id")).recordset[0].id;
  for(const f of fixtures)await db.getPool().request().input('s',sql.Int,f.school.schoolId).query(`
   SET XACT_ABORT ON;BEGIN TRANSACTION;
   DECLARE @accounts TABLE(id int);INSERT @accounts SELECT account_id FROM dbo.school_memberships WHERE school_id=@s;
   ${installed?'DELETE dbo.finance_reversals WHERE school_id=@s;DELETE dbo.finance_cancellations WHERE school_id=@s;DELETE dbo.finance_payments WHERE school_id=@s;DELETE dbo.finance_charges WHERE school_id=@s;':''}
   DELETE dbo.attendance_revisions WHERE school_id=@s;DELETE dbo.attendance_roster WHERE school_id=@s;DELETE dbo.attendance_sessions WHERE school_id=@s;
   DELETE dbo.students WHERE school_id=@s;DELETE dbo.classes WHERE school_id=@s;DELETE dbo.academic_years WHERE school_id=@s;
   DELETE dbo.account_sessions WHERE account_id IN(SELECT id FROM @accounts);DELETE dbo.membership_roles WHERE school_id=@s;DELETE dbo.school_memberships WHERE school_id=@s;
   DELETE dbo.accounts WHERE id IN(SELECT id FROM @accounts);DELETE dbo.schools WHERE id=@s;COMMIT;`);
 }
});
