const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const {createSchoolApp,readiness}=require('../scripts/canonicalSchool');const {serve}=require('./helpers/http');
test('real-school shell has no demo bypass and blocks unreviewed writes and legacy APIs',async t=>{
 const database={connect(){throw new Error('Unexpected SQL');}};
 const service={resolveSession:async()=>null};const base=await serve(t,createSchoolApp(database,{identityService:service}));
 const response=await fetch(base+'/');assert.equal(response.status,200);const html=await response.text();assert.match(html,/value="LYCEE_BATOURI"/);assert.doesNotMatch(html,/sample-accounts|M1_DEMO/);
 for(const url of ['/preview/catalog','/preview/sign-in','/api/v1/students','/registration'])assert.equal((await fetch(base+url)).status,404);
 assert.equal((await fetch(base+'/api/personnel/students',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 assert.equal((await fetch(base+'/api/identity/school-invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
 assert.equal((await fetch(base+'/api/identity/login',{method:'POST',headers:{Origin:'https://localhost:2027','Content-Type':'application/json'},body:JSON.stringify({schoolCode:'M1_DEMO_A',accountType:'admin'})})).status,422);
 assert.equal((await fetch(base+'/api/personnel/students',{headers:{Origin:'https://localhost:2027'}})).status,403);
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(require.resolve('../public/js/canonical-school.js'),'utf8')));
});
test('canonical real sign-in forwards school credentials and issues only a secure opaque cookie',async t=>{
 let received;const service={loginSchoolIdentity:async(...args)=>{received=args;return {token:'opaque-test-token',csrfToken:'test-csrf',expiresAt:new Date(Date.now()+10000)};},revokeSession:async()=>{}};
 const base=await serve(t,createSchoolApp({}, {identityService:service}));
 const response=await fetch(base+'/api/identity/login',{method:'POST',headers:{Origin:'https://localhost:2027','Content-Type':'application/json'},body:JSON.stringify({schoolCode:'LYCEE_BATOURI',accountType:'admin',identifier:'admin@example.invalid',password:'synthetic-test-only'})});
 assert.equal(response.status,200);assert.deepEqual(received,['LYCEE_BATOURI','admin','admin@example.invalid','synthetic-test-only']);assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/Secure/);
 const body=await response.text();assert.doesNotMatch(body,/synthetic-test-only|opaque-test-token/);
});
test('real-school startup refuses a synthetic or wrong-instance database before adoption queries',async()=>{
 const database={connect:async()=>{},getPool:()=>({request:()=>({query:async()=>({recordset:[{name:'lms_test_codex',server:'MARIUS'}]})})})};
 await assert.rejects(readiness(database),/Wrong real-school database/);
});
