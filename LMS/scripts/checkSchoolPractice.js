const https=require('node:https'),fs=require('node:fs'),assert=require('node:assert/strict');
const ca=fs.readFileSync(require('node:path').join(__dirname,'../backups/runtime/tls/localhost.crt'));
function request(port,path,method='GET',cookie='',body=''){
 return new Promise((resolve,reject)=>{
  const req=https.request({hostname:'localhost',family:4,port,path,method,ca,headers:{Origin:'https://localhost:'+port,Cookie:cookie,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})}},res=>{
   let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
  });req.setTimeout(10000,()=>req.destroy(Error('Preview timed out')));req.on('error',reject);req.end(body);
 });
}
async function main(){
 const home=await request(2030,'/');assert.equal(home.status,200);assert.match(home.body,/School feature menu/);
 for(const area of ['library','laboratory','requests','finance','cashier']){
  assert.equal((await request(2030,'/workspace/'+area)).status,403);
  const opened=await request(2030,'/open/'+area,'POST');assert.equal(opened.status,303);
  const cookie=opened.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ');
  const page=await request(2030,'/workspace/'+area,'GET',cookie);
  assert.equal(page.status,200);assert.match(page.body,/Practice records/);if(area!=='cashier')assert.match(page.body,/name="operation"/);
  if(['finance','cashier'].includes(area)){
   assert.match(page.body,/Financial management/);assert.match(page.body,/Collection reports and exports/);
   const report=await request(2030,'/workspace/'+area+'/collections','GET',cookie);
   assert.equal(report.status,200);assert.match(report.body,/Current net collected/);
   const csv=await request(2030,'/workspace/'+area+'/collections?format=csv','GET',cookie);
   assert.equal(csv.status,200);assert.match(csv.headers['content-type'],/text\/csv/);
   assert.match(csv.body,/Current net XAF/);
   const statements=await request(2030,'/workspace/'+area+'/statements','GET',cookie);
   assert.equal(statements.status,200);assert.match(statements.body,/Find pupil by name or matricule/);
   const pupil=statements.body.match(/href="\?pupil=(\d+)"/);
   assert.ok(pupil,'Expected a fictional pupil in the practice directory');
   const statement=await request(2030,'/workspace/'+area+'/statements?pupil='+pupil[1],'GET',cookie);
   assert.equal(statement.status,200);assert.match(statement.body,/Download statement CSV/);
   const statementCsv=await request(2030,'/workspace/'+area+'/statements?pupil='+pupil[1]+'&format=csv','GET',cookie);
   assert.equal(statementCsv.status,200);assert.match(statementCsv.body,/Current totals/);
   if(area==='finance'){
    assert.match(page.body,/Charge several pupils/);
    const csrf=page.body.match(/name="csrf" value="([^"]+)"/)[1];
    const year=page.body.match(/name="year" required><option value="">Choose year<\/option><option value="(\d+)"/)[1];
    const form=new URLSearchParams({csrf,pupils:pupil[1],year,description:'Live review check only',amount:'1'}).toString();
    const review=await request(2030,'/workspace/finance/bulk/review','POST',cookie,form);
    assert.equal(review.status,200);assert.match(review.body,/No charges have been saved yet/);assert.match(review.body,/Confirm and save all charges/);
   }else assert.doesNotMatch(page.body,/Charge several pupils/);
  }
  if(area==='library')assert.match(page.body,/Search catalogue/);
  if(area==='laboratory')assert.match(page.body,/Recent stock movements/);
 }
 const attendance=await request(2029,'/');assert.equal(attendance.status,200);assert.match(attendance.body,/Attendance totals/);
 const attendanceLogin=await request(2029,'/practice/sign-in','POST');
 assert.equal(attendanceLogin.status,200);
 const attendanceCookie=attendanceLogin.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ');
 const registers=JSON.parse((await request(2029,'/api/attendance/registers','GET',attendanceCookie)).body);
 assert.ok(registers.length>0);
 const range='/api/attendance/totals?registerId='+registers[0].id+'&from='+registers[0].lessonDate+'&to='+registers[0].lessonDate;
 const totals=await request(2029,range,'GET',attendanceCookie);
 assert.equal(totals.status,200);
 assert.ok(JSON.parse(totals.body).every(row=>row.scheduled===row.attended+row.missed+row.unrecorded));
 assert.equal((await request(2028,'/')).status,200);
 assert.equal((await request(2027,'/')).status,200);
 assert.equal((await fetch('http://localhost:2026/login')).status,200);
 console.log('Feature menu, inventory and finance administrator/cashier pages, collection reports, pupil statements and CSV downloads passed verified HTTPS checks. Attendance, enrolment practice and both school servers are reachable.');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
