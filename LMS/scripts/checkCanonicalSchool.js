// Public HTTP checks only; never requests or uses a real user's password.
const https=require('node:https');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const ca=fs.readFileSync(path.join(__dirname,'../backups/runtime/tls/localhost.crt'));
function request(route,method='GET',body){return new Promise((resolve,reject)=>{
 const text=body?JSON.stringify(body):null;const req=https.request({hostname:'localhost',family:4,port:2027,path:route,method,ca,headers:{Origin:'https://localhost:2027',...(text?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(text)}:{})}},res=>{let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:data}));});req.on('error',reject);if(text)req.write(text);req.end();
});}
async function main(){for(const [flag,path,header]of [['legacyScopedReferences','/api/v1/classes','x-lms-scoped-references'],['legacyScopedReports','/api/v1/report-cards/1/First/1','x-lms-scoped-reports'],['legacyScopedSelf','/api/v1/teachers/profile','x-lms-scoped-self']])if(require('../config/runtimePolicy.json')[flag]){const r=await fetch('http://localhost:2026'+path);assert.equal(r.status,401);assert.equal(r.headers.get(header),'1');}if(require('../config/runtimePolicy.json').legacyScopedAllocations){const r=await fetch('http://localhost:2026/api/v1/allocations');assert.equal(r.status,401);assert.equal(r.headers.get('x-lms-scoped-allocations'),'1');}const page=await request('/');assert.equal(page.status,200);assert.match(page.text,/value="LYCEE_BATOURI"/);assert.doesNotMatch(page.text,/sample-accounts|M1_DEMO/);
 assert.equal((await request('/preview/catalog')).status,404);assert.equal((await request('/api/v1/students')).status,404);assert.equal((await request('/api/identity/session')).status,403);
 const hub=await request('/school');assert.equal(hub.status,302);assert.equal(hub.headers.location,'/?next=school');
 assert.equal((await request('/css/school-hub.css')).status,200);assert.equal((await request('/js/school-hub.js')).status,200);
 const personnelEnabled=require('../config/runtimePolicy.json').canonicalPersonnelWrites===true;
 if(require('../config/runtimePolicy.json').legacyScopedTimetables===true){const legacy=await fetch('http://localhost:2026/login');assert.equal(legacy.headers.get('x-lms-scoped-timetables'),'1');assert.equal((await fetch('http://localhost:2026/api/v1/timetables/form-data')).status,401);assert.equal((await fetch('http://localhost:2026/api/v1/timetables',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);}
 if(require('../config/runtimePolicy.json').legacyScopedPersonnelReads===true){const legacy=await fetch('http://localhost:2026/login');assert.equal(legacy.headers.get('x-lms-scoped-personnel-reads'),'1');for(const route of ['/api/v1/admin/stats','/api/v1/teachers','/api/v1/students'])assert.equal((await fetch('http://localhost:2026'+route)).status,401);}
 if(require('../config/runtimePolicy.json').legacyScopedExamResults===true){const legacy=await fetch('http://localhost:2026/login');assert.equal(legacy.headers.get('x-lms-scoped-exam-results'),'1');assert.equal((await fetch('http://localhost:2026/api/v1/exam-results/exam/1')).status,401);assert.equal((await fetch('http://localhost:2026/api/v1/admin/publish/exam/1',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);}
 if(require('../config/runtimePolicy.json').canonicalStaffAccounts===true){assert.match(page.text,/value="staff"/);assert.equal((await request('/staff-accounts')).status,200);for(const route of ['directory?schoolId=1','tokens?schoolId=1','existing-accounts?schoolId=1','administrators?schoolId=1'])assert.equal((await request('/api/staff-accounts/'+route)).status,403);assert.equal((await request('/api/staff-accounts/invite','POST',{})).status,403);for(const route of ['administrators','administrators/disable'])assert.equal((await request('/api/staff-accounts/'+route,'POST',{})).status,403);for(const route of ['activate','reset'])assert.equal((await request('/api/staff-accounts/'+route,'POST',{})).status,422);const staffDenied=await request('/api/identity/login','POST',{schoolCode:'LYCEE_BATOURI',accountType:'staff',identifier:'missing-'+crypto.randomUUID()+'@example.invalid',password:crypto.randomBytes(24).toString('base64url')});assert.equal(staffDenied.status,403);assert.equal(staffDenied.headers['set-cookie'],undefined);}
 const coursesEnabled=require('../config/runtimePolicy.json').canonicalAcademicLinks===true;
 if(coursesEnabled){
  const client=await request('/js/canonical-courses.js');
  assert.equal(client.status,200);
  assert.match(client.text,/Save changed scores/);
  assert.match(client.text,/links\/my-timetable/);
  assert.match(client.text,/Download CSV/);
  for(const format of ['csv','print']){
   assert.equal((await request('/api/links/my-timetable?yearId=1&term=First&format='+format)).status,403);
  }
  assert.equal((await request('/css/timetable-print.css')).status,200);
  assert.equal((await request('/js/timetable-print.js')).status,200);
  assert.equal((await request('/api/links/my-timetable?yearId=1&term=First')).status,403);
  for(const role of ['teacher','student']){
   const old=await fetch('http://localhost:2026/timetable-'+role,{redirect:'manual'});
   assert.equal(old.status,302);assert.equal(old.headers.get('location'),'https://localhost:2027/courses');
  }
 }
 if(coursesEnabled){assert.match(page.text,/id="course-nav"/);assert.equal((await request('/courses')).status,302);for(const route of ['/api/links/offerings','/api/marks/sheet?offeringId=1&yearId=1&term=First'])assert.equal((await request(route)).status,403);for(const route of ['/api/links/assignments','/api/marks/scores'])assert.equal((await request(route,'POST',{})).status,403);for(const route of ['/api/v1/marks','/api/v1/class-subject-students/1/1'])assert.equal((await fetch('http://localhost:2026'+route)).status,409);assert.equal((await fetch('http://localhost:2026/api/v1/allocations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,409);}
 else assert.equal((await request('/courses')).status,404);
 assert.equal((await request('/api/personnel/students','POST',{})).status,personnelEnabled?403:405);
 if(personnelEnabled){assert.equal((await request('/registration')).status,302);assert.equal((await request('/api/setup/classes')).status,403);assert.equal((await request('/api/reference/regions')).status,403);}
 if(require('../config/runtimePolicy.json').canonicalAcademicHistoryReview===true){
  for(const route of ['students/1','teachers/1','placement-review'])assert.equal((await request('/api/academic-history/'+route+'?yearId=1')).status,403);
  const client=await request('/js/m1-original-registration.js');assert.equal(client.status,200);assert.match(client.text,/api\/academic-history\/placement-review/);
 }
 if(require('../config/runtimePolicy.json').canonicalAcademicWrites===true){assert.equal((await request('/academic?kind=subject')).status,302);assert.equal((await request('/api/setup/subjects','POST',{})).status,403);}
 if(require('../config/runtimePolicy.json').canonicalAuxiliaryWrites===true){assert.equal((await request('/auxiliary')).status,302);assert.equal((await request('/api/auxiliary')).status,403);assert.equal((await request('/api/auxiliary','POST',{})).status,403);}
 if(require('../config/runtimePolicy.json').canonicalMembershipInvitations===true){assert.equal((await request('/invitations')).status,302);assert.equal((await request('/api/membership-invitations/existing-admin?schoolId=1')).status,403);assert.equal((await request('/api/membership-invitations/existing-admin','POST',{})).status,403);assert.equal((await request('/api/membership-invitations/eligible-accounts?schoolId=1')).status,403);assert.equal((await request('/api/membership-invitations/administrators?schoolId=1')).status,403);assert.equal((await request('/api/membership-invitations/remove-administrator','POST',{})).status,403);}
 const denied=await request('/api/identity/login','POST',{schoolCode:'LYCEE_BATOURI',accountType:'admin',identifier:`missing-${crypto.randomUUID()}@example.invalid`,password:crypto.randomBytes(24).toString('base64url')});assert.equal(denied.status,403);assert.equal(denied.headers['set-cookie'],undefined);
 console.log('LYCEE BATOURI HTTPS checks passed: real-school shell, TLS certificate verified, no sample/legacy bypass, unauthorised writes blocked and invalid credentials denied. No real password used.');}
if(require.main===module)main().catch(()=>{console.error('Real-school HTTPS check failed; credentials withheld');process.exitCode=1;});
module.exports={request};
