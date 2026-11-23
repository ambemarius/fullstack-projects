const test=require('node:test'),assert=require('node:assert/strict');
const {liveHub,practiceHub}=require('../utils/schoolHub');
const {createSchoolApp}=require('../scripts/canonicalSchool');
const {createSchoolHubService}=require('../model/identity/schoolHubService');
const {serve}=require('./helpers/http');
const enabled={personnelWrites:true,academicWrites:true,auxiliaryWrites:true,membershipInvitations:true,academicLinks:true,staffAccounts:true};
const items=hub=>hub.groups.flatMap(g=>g.items.map(i=>i[2]));
test('hub navigation honours backend roles and enabled workflows without presenting practice as live',()=>{
 const urls={practiceUrls:{modules:'https://modules.example.test',attendance:'https://attendance.example.test'}};
 const hub=roles=>liveHub({roles},{name:'Verified school'},[{name:'2026/27'}],enabled,urls);
 assert.deepEqual(liveHub({roles:['bursar']},{name:'S'},[],enabled).modules,[],'modules without a configured server are not linked');
 assert.equal(items(hub(['admin'])).length,8);
 assert.deepEqual(items(hub(['teacher'])),['/courses','/invitations']);
 assert.deepEqual(items(hub(['student'])),['/courses']);
 for(const [role,module] of [['bursar','finance'],['librarian','library'],['lab_attendant','laboratory'],['discipline_master','attendance']]){
  assert.deepEqual(hub([role]).modules.map(m=>m.id),[module]);assert.deepEqual(items(hub([role])),[]);
 }
 assert.deepEqual(hub(['student']).modules,[]);
 assert.deepEqual(hub(['teacher','librarian']).modules.map(m=>m.id),['library','laboratory']);
 assert.equal(liveHub({roles:['student']},{name:'B'},[],{}).yearLabel,'No current academic year set');
 assert.equal(liveHub({roles:['student']},{name:'B'},[{name:'A'},{name:'B'}],{}).yearLabel,'Academic year needs review');
 assert.deepEqual(items(liveHub({roles:['teacher']},{name:'B'},[],{})),[]);
 const practice=practiceHub({library:{}});assert.equal(practice.practice,true);assert.deepEqual(practice.groups,[]);
 assert.equal(practice.modules.some(m=>m.id==='finance'),false);assert.equal(practice.roleLabel,'Practice visitor');
});
test('school hub redirects anonymous users, escapes context and ignores client school/role claims',async t=>{
 let signed=false;const inputs={};const actor={accountId:1,membershipId:2,schoolId:3,roles:['teacher']};
 const identity={resolveSession:async token=>signed&&token==='test-session'?actor:null};
 const database={connect:async()=>{},getPool:()=>({request:()=>({input(name,_type,value){inputs[name]=value;return this;},async query(){return {recordsets:[[{name:'School <script>alert(1)</script>'}],[{name:'2026/27'}]]};}})})};
 const base=await serve(t,createSchoolApp(database,{identityService:identity,...enabled}));
 const anonymous=await fetch(base+'/school',{redirect:'manual'});assert.equal(anonymous.status,302);assert.equal(anonymous.headers.get('location'),'/?next=school');
 signed=true;const response=await fetch(base+'/school?school=999&role=admin',{headers:{Cookie:'__Host-lms_session=test-session'}});
 assert.equal(response.status,200);const html=await response.text();assert.equal(inputs.school,3);
 assert.match(html,/School &lt;script&gt;/);assert.match(html,/Academic year 2026\/27/);
 assert.match(html,/href="\/courses"/);assert.doesNotMatch(html,/href="\/registration"|href="\/academic"|href="\/auxiliary"|href="\/staff-accounts"/);
 assert.match(html,/School dashboard/);
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal((await fetch(base+'/registration',{headers:{Cookie:'__Host-lms_session=test-session'}})).status,403);
 assert.equal((await fetch(base+'/school',{headers:{Cookie:'__Host-lms_session=test-session; __Host-lms_session=other'},redirect:'manual'})).status,302);
});
test('hub context fails closed when membership is revoked or switched during reads',async()=>{
 const actor={accountId:1,membershipId:2,schoolId:3,roles:['admin']};
 for(const fresh of [null,{...actor,schoolId:9}]){
  let calls=0;const identity={resolveSession:async()=>++calls===1?actor:fresh};
  const database={connect:async()=>{},getPool:()=>({request:()=>({input(){return this;},query:async()=>({recordsets:[[{name:'School'}],[]]})})})};
  assert.equal(await createSchoolHubService(database,identity,enabled)('synthetic-token'),null);
 }
});
