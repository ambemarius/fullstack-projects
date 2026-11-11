const {sql}=require('../../config/database');
const crypto=require('node:crypto');
const {authoritySql}=require('./schoolAccess');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function text(v,max,optional=false){
 if(typeof v!=='string'||v.length>max||(!optional&&!v.trim()))throw fail(422,'Complete the text fields within their limits.');
 return v.trim();
}
function id(v){if(!/^[1-9]\d{0,9}$/.test(String(v))||Number(v)>2147483647)throw fail(422,'Choose a record.');return Number(v);}
function amount(v){if(!/^[1-9]\d{0,11}$/.test(String(v)))throw fail(422,'Enter a positive amount in whole CFA francs (up to 12 digits).');return String(v);}
function date(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'0001-01-01'||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw fail(422,'Enter a valid date.');
 return v;
}
const formatMoney=v=>new Intl.NumberFormat('en-CM').format(BigInt(v))+' XAF';
const chargesSql=`SELECT c.id,c.student_id,c.year_id,c.description,CONVERT(varchar(30),c.amount) amount,c.currency,
 CONVERT(char(10),c.due_date,23) dueDate,p.firstName+' '+p.lastName pupil,p.matricule,y.name year,
 CONVERT(varchar(30),COALESCE(paid.total,0)) paid,CONVERT(varchar(30),c.amount-COALESCE(paid.total,0)) balance,
 x.reason cancelled,c.created_at createdAt
 FROM dbo.finance_charges c JOIN dbo.students p ON p.school_id=c.school_id AND p.id=c.student_id
 JOIN dbo.academic_years y ON y.school_id=c.school_id AND y.id=c.year_id
 LEFT JOIN dbo.finance_cancellations x ON x.school_id=c.school_id AND x.charge_id=c.id
 OUTER APPLY(SELECT SUM(CONVERT(decimal(38,0),f.amount)) total FROM dbo.finance_payments f
 WHERE f.school_id=c.school_id AND f.charge_id=c.id AND NOT EXISTS(SELECT 1 FROM dbo.finance_reversals r WHERE r.school_id=f.school_id AND r.payment_id=f.id)) paid
 WHERE c.school_id=@school`;
const paymentsSql=`SELECT f.id,f.charge_id,CONVERT(varchar(30),f.amount) amount,CONVERT(char(10),f.paid_on,23) paidOn,
 f.method,f.reference,f.created_at recordedAt,r.reason reversed,a.login_key recordedBy
 FROM dbo.finance_payments f LEFT JOIN dbo.finance_reversals r ON r.school_id=f.school_id AND r.payment_id=f.id
 JOIN dbo.school_memberships m ON m.school_id=f.school_id AND m.id=f.actor_id JOIN dbo.accounts a ON a.id=m.account_id
 WHERE f.school_id=@school`;
function createFinanceService(db,access){
 const bulkReviews=new Map();
 async function scoped(context,roles,work){
  const actor=await access.authorize(context,roles);await db.connect();
  // Keep balances and their payment history consistent, including concurrent inserts.
  const tx=new sql.Transaction(db.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const query=(statement,params={})=>{
   const r=new sql.Request(tx).input('school',sql.Int,actor.schoolId).input('actor',sql.Int,actor.membershipId);
   for(const [name,[type,value]]of Object.entries(params))r.input(name,type,value);
   return r.query(statement);
  };
  try{
   const authorized=await query('SELECT 1 ok WHERE '+authoritySql,{account:[sql.Int,actor.accountId],membership:[sql.Int,actor.membershipId],
    session_hash:[sql.Char(64),actor.tokenHash],role_one:[sql.VarChar(30),roles[0]],role_two:[sql.VarChar(30),roles[1]||null]});
   if(!authorized.recordset.length)throw fail(403,'Access denied');
   const result=await work(query,actor);await tx.commit();return result;
  }catch(error){await tx.rollback().catch(()=>{});if([2601,2627,1205].includes(error.number))throw fail(409,'This entry changed or was already saved. Reopen it before retrying.');throw error;}
 }
 async function list(context,search=''){
  search=text(search,120,true);
  return scoped(context,['admin','bursar'],async(query,actor)=>{
   const sets=(await query(chargesSql+` AND (@search='' OR CHARINDEX(@search,CONCAT(p.firstName,' ',p.lastName,' ',p.matricule,' ',y.name,' ',c.description))>0) ORDER BY c.id DESC;
    SELECT id,firstName+' '+lastName+' · '+matricule label FROM dbo.students WHERE school_id=@school AND isWithdrawn=0 ORDER BY lastName,firstName;
    SELECT id,name label FROM dbo.academic_years WHERE school_id=@school ORDER BY fromYear DESC;`,{search:[sql.NVarChar(120),search]})).recordsets;
   const totals={charged:0n,paid:0n,balance:0n};
   for(const c of sets[0])if(!c.cancelled){totals.charged+=BigInt(c.amount);totals.paid+=BigInt(c.paid);totals.balance+=BigInt(c.balance);}
   return {charges:sets[0],pupils:sets[1],years:sets[2],totals,admin:actor.authorizedRole==='admin'};
  });
 }
 async function detail(context,chargeId){
  return scoped(context,['admin','bursar'],async(query,actor)=>{
   const params={charge:[sql.Int,id(chargeId)]};
   const charge=(await query(chargesSql+' AND c.id=@charge',params)).recordset[0];
   if(!charge)throw fail(404,'Charge not found.');
   return {charge,payments:(await query(paymentsSql+' AND f.charge_id=@charge ORDER BY f.id DESC',params)).recordset,admin:actor.authorizedRole==='admin'};
  });
 }
 async function receipt(context,paymentId){
  return scoped(context,['admin','bursar'],async query=>{
   const payment=(await query(paymentsSql+' AND f.id=@payment',{payment:[sql.Int,id(paymentId)]})).recordset[0];
   if(!payment)throw fail(404,'Receipt not found.');
   const charge=(await query(chargesSql+' AND c.id=@charge',{charge:[sql.Int,payment.charge_id]})).recordset[0];
   const school=(await query('SELECT id,name FROM dbo.schools WHERE id=@school')).recordset[0];
   return {payment,charge,school,receiptNumber:'PAY-'+school.id+'-'+payment.id};
  });
 }
 async function collections(context,filters={}){
  const from=date(filters.from),to=date(filters.to),method=filters.method??'',operator=filters.operator? id(filters.operator):null;
  if(from>to||(Date.parse(to)-Date.parse(from))/86400000>365)throw fail(422,'Choose an inclusive date range of up to 366 days.');
  if(!['','cash','bank','mobile','other'].includes(method))throw fail(422,'Choose a payment method.');
  return scoped(context,['admin','bursar'],async query=>{
   const operators=(await query(`SELECT DISTINCT m.id,a.login_key label FROM dbo.finance_payments f
    JOIN dbo.school_memberships m ON m.school_id=f.school_id AND m.id=f.actor_id JOIN dbo.accounts a ON a.id=m.account_id
    WHERE f.school_id=@school ORDER BY a.login_key`)).recordset;
   if(operator&&!operators.some(o=>o.id===operator))throw fail(404,'Payment operator not found in this school.');
   const rows=(await query(`SELECT TOP(5001) f.id,f.actor_id operatorId,CONVERT(varchar(30),f.amount) amount,
    CONVERT(char(10),f.paid_on,23) paidOn,f.method,f.reference,f.created_at recordedAt,
    p.firstName+' '+p.lastName pupil,p.matricule,y.name year,c.description,a.login_key recordedBy,
    r.reason reversed,r.created_at reversedAt
    FROM dbo.finance_payments f JOIN dbo.finance_charges c ON c.school_id=f.school_id AND c.id=f.charge_id
    JOIN dbo.students p ON p.school_id=c.school_id AND p.id=c.student_id
    JOIN dbo.academic_years y ON y.school_id=c.school_id AND y.id=c.year_id
    JOIN dbo.school_memberships m ON m.school_id=f.school_id AND m.id=f.actor_id JOIN dbo.accounts a ON a.id=m.account_id
    LEFT JOIN dbo.finance_reversals r ON r.school_id=f.school_id AND r.payment_id=f.id
    WHERE f.school_id=@school AND f.paid_on BETWEEN @from AND @to
      AND (@method='' OR f.method=@method) AND (@operator IS NULL OR f.actor_id=@operator)
    ORDER BY f.paid_on,f.id`,{from:[sql.Date,from],to:[sql.Date,to],method:[sql.VarChar(12),method],operator:[sql.Int,operator]})).recordset;
   if(rows.length>5000)throw fail(422,'This report exceeds 5,000 payments. Narrow the dates, method or cashier. No partial totals were returned.');
   const school=(await query('SELECT id,name FROM dbo.schools WHERE id=@school')).recordset[0];
   const empty=()=>({count:0,recorded:0n,reversed:0n,net:0n});
   const totals=empty(),methods=new Map(),cashiers=new Map();
   for(const row of rows){
    row.receiptNumber='PAY-'+school.id+'-'+row.id;
    if(!methods.has(row.method))methods.set(row.method,{label:row.method,...empty()});
    if(!cashiers.has(row.operatorId))cashiers.set(row.operatorId,{label:row.recordedBy,...empty()});
    for(const group of [totals,methods.get(row.method),cashiers.get(row.operatorId)]){
     group.count++;group.recorded+=BigInt(row.amount);group.reversed+=row.reversed?BigInt(row.amount):0n;group.net+=row.reversed?0n:BigInt(row.amount);
    }
   }
   return {from,to,method,operator,operators,rows,school,totals,methods:[...methods.values()],cashiers:[...cashiers.values()],generatedAt:new Date()};
  });
 }
 async function pupilStatement(context,options={}){
  const pupilId=options.pupil?id(options.pupil):null,yearId=options.year?id(options.year):null,search=text(options.search??'',120,true);
  return scoped(context,['admin','bursar'],async query=>{
   const school=(await query('SELECT id,name FROM dbo.schools WHERE id=@school')).recordset[0];
   const years=(await query('SELECT id,name FROM dbo.academic_years WHERE school_id=@school ORDER BY fromYear DESC')).recordset;
   if(yearId&&!years.some(y=>y.id===yearId))throw fail(404,'Academic year not found in this school.');
   if(!pupilId){
    const pupils=(await query(`SELECT TOP(201) id,firstName+' '+lastName name,matricule,isWithdrawn FROM dbo.students
     WHERE school_id=@school AND (@search='' OR CHARINDEX(@search,CONCAT(firstName,' ',lastName,' ',matricule))>0)
     ORDER BY lastName,firstName,id`,{search:[sql.NVarChar(120),search]})).recordset;
    return {school,years,yearId,search,pupils:pupils.slice(0,200),morePupils:pupils.length>200,pupil:null};
   }
   const params={pupil:[sql.Int,pupilId],year:[sql.Int,yearId]};
   const pupil=(await query('SELECT id,firstName+\' \'+lastName name,matricule,isWithdrawn FROM dbo.students WHERE school_id=@school AND id=@pupil',params)).recordset[0];
   if(!pupil)throw fail(404,'Pupil not found in this school.');
   const charges=(await query('SELECT TOP(501) * FROM ('+chargesSql+' AND c.student_id=@pupil AND (@year IS NULL OR c.year_id=@year)) selectedCharges ORDER BY id',params)).recordset;
   const payments=(await query('SELECT TOP(5001) * FROM ('+paymentsSql+` AND EXISTS(SELECT 1 FROM dbo.finance_charges c
    WHERE c.school_id=f.school_id AND c.id=f.charge_id AND c.student_id=@pupil AND (@year IS NULL OR c.year_id=@year))) selectedPayments ORDER BY paidOn,id`,params)).recordset;
   if(charges.length>500||payments.length>5000)throw fail(422,'This statement is too large. Select a narrower academic year or request a reviewed export. No partial totals were returned.');
   const asOf=today(),totals={charged:0n,paid:0n,balance:0n,overdue:0n};
   for(const c of charges)if(!c.cancelled){totals.charged+=BigInt(c.amount);totals.paid+=BigInt(c.paid);totals.balance+=BigInt(c.balance);
    if(c.dueDate&&c.dueDate<asOf)totals.overdue+=BigInt(c.balance);}
   for(const p of payments)p.receiptNumber='PAY-'+school.id+'-'+p.id;
   return {school,years,yearId,search,pupil,charges,payments,totals,asOf,generatedAt:new Date()};
  });
 }
 async function bulkFacts(query,definition){
  const params={year:[sql.Int,definition.year],description:[sql.NVarChar(120),definition.description]};
  definition.pupils.forEach((p,i)=>params['p'+i]=[sql.Int,p]);
  const year=(await query('SELECT id,name,fromYear,toYear FROM dbo.academic_years WHERE school_id=@school AND id=@year',params)).recordset[0];
  if(!year)throw fail(404,'Academic year not found in this school.');
  const pupils=(await query(`SELECT p.id,p.firstName,p.lastName,p.matricule,
    (SELECT COUNT(*) FROM dbo.finance_charges c WHERE c.school_id=p.school_id AND c.student_id=p.id AND c.year_id=@year AND c.description=@description
      AND NOT EXISTS(SELECT 1 FROM dbo.finance_cancellations x WHERE x.school_id=c.school_id AND x.charge_id=c.id)) existing
    FROM dbo.students p WHERE p.school_id=@school AND p.isWithdrawn=0 AND p.id IN (${definition.pupils.map((_,i)=>'@p'+i).join(',')}) ORDER BY p.id`,params)).recordset;
  if(pupils.length!==definition.pupils.length)throw fail(409,'A selected pupil is unavailable in this school. Review the selection again.');
  if(pupils.some(p=>p.existing>0))throw fail(409,'A selected pupil already has an active charge with this fee description for this year. Review existing charges; use a distinct description for a different instalment.');
  return {year,pupils};
 }
 async function reviewBulk(context,b){
  const selected=Array.isArray(b.pupils)?b.pupils:b.pupils?[b.pupils]:[];
  if(!selected.length||selected.length>200)throw fail(422,'Select between 1 and 200 pupils.');
  const pupils=selected.map(id).sort((a,b)=>a-b);
  if(new Set(pupils).size!==pupils.length)throw fail(422,'Each pupil must appear only once.');
  const definition={pupils,year:id(b.year),description:text(b.description,120),amount:amount(b.amount),due:b.due?date(b.due):null};
  const review=await scoped(context,['admin'],async(query,actor)=>({
   ...await bulkFacts(query,definition),definition,scope:actor.tokenHash,schoolId:actor.schoolId,
   token:crypto.randomBytes(32).toString('hex'),expires:Date.now()+15*60*1000,operations:pupils.map(()=>crypto.randomUUID())
  }));
  for(const [key,old]of bulkReviews)if(old.expires<Date.now())bulkReviews.delete(key);
  if(bulkReviews.size>=256&&!bulkReviews.has(review.scope))throw fail(409,'Too many pending reviews. Try again after existing reviews expire.');
  bulkReviews.set(review.scope,review);
  return structuredClone({token:review.token,year:review.year,pupils:review.pupils,description:definition.description,
   amount:definition.amount,due:definition.due,total:(BigInt(definition.amount)*BigInt(pupils.length)).toString()});
 }
 async function confirmBulk(context,token){
  let completedScope;
  const result=await scoped(context,['admin'],async(query,actor)=>{
   const review=bulkReviews.get(actor.tokenHash);
   if(typeof token!=='string'||!review||review.token!==token||review.expires<Date.now()||review.schoolId!==actor.schoolId)
    throw fail(409,'This review expired, was replaced or was already saved. Prepare a new review.');
   const facts=await bulkFacts(query,review.definition);
   if(JSON.stringify(facts)!==JSON.stringify({year:review.year,pupils:review.pupils}))throw fail(409,'Pupil or year details changed. Prepare a new review before saving.');
   const charges=[];
   for(const [index,pupil]of review.pupils.entries()){
    const charge=(await query(`INSERT dbo.finance_charges(school_id,student_id,year_id,description,amount,currency,due_date,actor_id,operation_id)
      OUTPUT inserted.id VALUES(@school,@pupil,@year,@description,@amount,'XAF',@due,@actor,@operation)`,{
      pupil:[sql.Int,pupil.id],year:[sql.Int,review.definition.year],description:[sql.NVarChar(120),review.definition.description],amount:[sql.BigInt,review.definition.amount],
      due:[sql.Date,review.definition.due],operation:[sql.UniqueIdentifier,review.operations[index]]})).recordset[0];
    charges.push({id:charge.id,pupil:pupil.firstName+' '+pupil.lastName,matricule:pupil.matricule});
   }
   completedScope=actor.tokenHash;
   return {charges,description:review.definition.description,year:review.year.name,total:(BigInt(review.definition.amount)*BigInt(charges.length)).toString()};
  });
  if(bulkReviews.get(completedScope)?.token===token)bulkReviews.delete(completedScope);
  return result;
 }
 async function save(context,b){
  const actions=['charge','pay','reverse','cancel'];if(!actions.includes(b.action))throw fail(422,'Choose a finance action.');
  return scoped(context,b.action==='pay'?['admin','bursar']:['admin'],async query=>{
   if(['charge','pay'].includes(b.action)&&! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.operation||''))throw fail(422,'Reopen the form before saving.');
   if(b.action==='charge'){
    const params={pupil:[sql.Int,id(b.pupil)],year:[sql.Int,id(b.year)],description:[sql.NVarChar(120),text(b.description,120)],
     amount:[sql.BigInt,amount(b.amount)],due:[sql.Date,b.due?date(b.due):null],op:[sql.UniqueIdentifier,b.operation]};
    const valid=(await query(`SELECT 1 ok FROM dbo.students p JOIN dbo.academic_years y ON y.school_id=p.school_id
     WHERE p.school_id=@school AND p.id=@pupil AND p.isWithdrawn=0 AND y.id=@year`,params)).recordset.length;
    if(!valid)throw fail(404,'Pupil or academic year not found.');
    return (await query(`INSERT dbo.finance_charges(school_id,student_id,year_id,description,amount,currency,due_date,actor_id,operation_id)
     OUTPUT inserted.id VALUES(@school,@pupil,@year,@description,@amount,'XAF',@due,@actor,@op)`,params)).recordset[0];
   }
   const chargeId=id(b.charge),params={charge:[sql.Int,chargeId]};
   // A single charge lock serializes payment, reversal and cancellation decisions.
   if(!(await query('SELECT id FROM dbo.finance_charges WITH(UPDLOCK,HOLDLOCK) WHERE school_id=@school AND id=@charge',params)).recordset.length)throw fail(404,'Charge not found.');
   const charge=(await query(chargesSql+' AND c.id=@charge',params)).recordset[0];
   if(charge.cancelled)throw fail(409,'This charge has been cancelled.');
   if(b.action==='pay'){
    const value=amount(b.amount),paidOn=date(b.paidOn);
    if(paidOn>today())throw fail(422,'Payment dates cannot be in the future.');
    if(BigInt(value)>BigInt(charge.balance))throw fail(409,'The payment exceeds the outstanding balance.');
    if(!['cash','bank','mobile','other'].includes(b.method))throw fail(422,'Choose a payment method.');
    const reference=text(b.reference||'',100,true);
    if(b.method!=='cash'&&!reference)throw fail(422,'Enter a transaction reference for this payment method.');
    const payment=(await query(`INSERT dbo.finance_payments(school_id,charge_id,amount,paid_on,method,reference,actor_id,operation_id)
     OUTPUT inserted.id VALUES(@school,@charge,@amount,@paid,@method,@reference,@actor,@op)`,{...params,amount:[sql.BigInt,value],paid:[sql.Date,paidOn],
     method:[sql.VarChar(12),b.method],reference:[sql.NVarChar(100),reference],op:[sql.UniqueIdentifier,b.operation]})).recordset[0];
    return {id:chargeId,paymentId:payment.id};
   }
   const reason=[sql.NVarChar(300),text(b.reason,300)];
   if(b.action==='reverse'){
    const payment=[sql.Int,id(b.payment)];
    if(!(await query('SELECT id FROM dbo.finance_payments WHERE school_id=@school AND charge_id=@charge AND id=@payment',{...params,payment})).recordset.length)throw fail(404,'Payment not found.');
    await query('INSERT dbo.finance_reversals(school_id,payment_id,reason,actor_id) VALUES(@school,@payment,@reason,@actor)',{payment,reason});
   }else{
    if(BigInt(charge.paid)!==0n)throw fail(409,'Reverse recorded payments before cancelling this charge.');
    await query('INSERT dbo.finance_cancellations(school_id,charge_id,reason,actor_id) VALUES(@school,@charge,@reason,@actor)',{...params,reason});
   }
   return {id:chargeId};
  });
 }
 return {list,detail,receipt,collections,pupilStatement,reviewBulk,confirmBulk,save};
}
module.exports={createFinanceService,formatMoney,today};
