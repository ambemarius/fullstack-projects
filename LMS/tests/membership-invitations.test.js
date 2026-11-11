const test=require('node:test');const assert=require('node:assert/strict');const {existingAccountBinding,createMembershipInvitationService}=require('../model/identity/membershipInvitationService');const {createIdentityService}=require('../model/identity/identityService');const {createMembershipInvitationRouter}=require('../routes/identity/membershipInvitationRouter');const {createApp}=require('../app/app');const {serve}=require('./helpers/http');
const {createSchoolApp}=require('../scripts/canonicalSchool');const vm=require('node:vm');const fs=require('node:fs');
test('existing administrator invitations bind exact immutable account ID and current canonical key, without email merging',()=>{
 const a=existingAccountBinding(1,'legacy:teachers:1');assert.match(a,/^existing-admin:1:[a-f0-9]{64}$/);assert.notEqual(a,existingAccountBinding(2,'legacy:teachers:1'));assert.notEqual(a,existingAccountBinding(1,'other-key'));assert.throws(()=>existingAccountBinding(0,'key'));assert.equal(a.includes('legacy:teachers'),false);
});
test('existing-account invitation validation rejects caller roles, credentials and absent platform authority before SQL',async()=>{
 const database={connect(){throw Error('Must not query SQL');}};const service=createMembershipInvitationService({resolveSession:async()=>({accountId:1,platformPermissions:[]})},database);
 await assert.rejects(service.issue('A'.repeat(43),{schoolId:1,accountId:2,role:'platform_operator'}),e=>e.statusCode===422);
 await assert.rejects(service.issue('A'.repeat(43),{schoolId:1,accountId:2}),e=>e.statusCode===403);await assert.rejects(service.accept('A'.repeat(43),'not-token'),e=>e.statusCode===403);
 const identity=createIdentityService(database);await assert.rejects(identity.inviteSchool('A'.repeat(43),{code:'RESERVED',name:'Synthetic',educationSystem:'Bilingual',intendedLoginKey:'EXISTING-ADMIN:reserved',requestId:'synthetic'}),e=>e.statusCode===403);
});
test('membership invitation HTTP factory enforces authenticated Origin/CSRF and cannot accept account/role injection',async t=>{
 const identity={resolveSession:async token=>token==='A'.repeat(43)?{accountId:1,platformPermissions:[]}:null,validateCsrf:async(_t,value)=>value==='valid'};const db={connect(){throw Error('Must not query');}};const base=await serve(t,createApp({logging:false,routes:[['/invitations',createMembershipInvitationRouter({identityService:identity,database:db,publicOrigin:'https://school.example'})]]}));
 const endpoint=base+'/invitations/accept-existing-admin';const headers={Origin:'https://school.example','Content-Type':'application/json',Cookie:'__Host-lms_session='+'A'.repeat(43)};
 assert.equal((await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(endpoint,{method:'POST',headers,body:'{}'})).status,403);
 assert.equal((await fetch(endpoint,{method:'POST',headers:{...headers,'X-CSRF-Token':'valid'},body:JSON.stringify({invitationToken:'B'.repeat(43),accountId:3})})).status,422);
});
test('real invitation mounting exposes protected staff acceptance while platform discovery stays privileged',async t=>{
 const service={resolveSession:async token=>token==='A'.repeat(43)?{accountId:1,schoolId:1,membershipId:1,roles:['teacher'],platformPermissions:[]}:token==='S'.repeat(43)?{accountId:2,schoolId:1,membershipId:2,roles:['student'],platformPermissions:[]}:null,validateCsrf:async(_t,value)=>value==='valid'};
 const database={connect(){throw Error('Unexpected SQL');}};const base=await serve(t,createSchoolApp(database,{identityService:service,personnelWrites:true,membershipInvitations:true}));
 const path='/api/membership-invitations';assert.equal((await fetch(base+path+'/existing-admin',{method:'POST',headers:{Origin:'https://localhost:2027','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/invitations',{redirect:'manual'})).status,302);
 const page=await fetch(base+'/invitations',{headers:{Cookie:'__Host-lms_session='+'A'.repeat(43)}});assert.equal(page.status,200);assert.match(await page.text(),/Accept administrator invitation/);
 assert.equal((await fetch(base+'/invitations',{headers:{Cookie:'__Host-lms_session='+'S'.repeat(43)}})).status,403);
 assert.equal((await fetch(base+path+'/eligible-accounts?schoolId=1',{headers:{Cookie:'__Host-lms_session='+'A'.repeat(43)}})).status,403);
 assert.equal((await fetch(base+path+'/accept-existing-admin',{method:'POST',headers:{Origin:'https://localhost:2027',Cookie:'__Host-lms_session='+'A'.repeat(43),'Content-Type':'application/json'},body:'{}'})).status,403);
 for(const file of ['canonical-invitations.js','canonical-school.js'])assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(require.resolve('../public/js/'+file),'utf8')));
});
