const {test}=require('node:test');const assert=require('node:assert/strict');const express=require('express');const fs=require('node:fs');const vm=require('node:vm');
const {createApp}=require('../app/app');const {createSchoolApp}=require('../scripts/canonicalSchool');const {serve}=require('./helpers/http');const {personnelActivationReadiness}=require('../scripts/personnelActivationReadiness');
test('legacy personnel gate blocks every old identity writer while retaining login, reads and academic routes',async t=>{
 const router=express.Router();router.use((_req,res)=>res.status(204).end());const base=await serve(t,createApp({logging:false,routes:[['/',router]],legacyPersonnelReadOnly:true}));
 for(const [method,path]of [['POST','students/register'],['PUT','students/profile'],['POST','students/promote/1'],['DELETE','teachers/2'],['PUT','teachers/profile'],['POST','teachers/2/assign'],['POST','admin/register'],['PUT','admin/set-status/teacher/2'],['PUT','admin/%37'],['DELETE','ADMIN/7']]){
  const response=await fetch(`${base}/api/v1/${path}`,{method});assert.equal(response.status,409,method+' '+path);assert.equal((await response.json()).workspace,'https://localhost:2027/registration');
 }
 for(const [method,path]of [['POST','students/login'],['POST','teachers/login/'],['POST','admin/login'],['GET','teachers'],['PUT','admin/publish/exam/1'],['POST','classes']])assert.equal((await fetch(`${base}/api/v1/${path}`,{method})).status,204);
});
test('real canonical registration preserves original forms and requires school admin, Origin and CSRF',async t=>{
 const db={connect(){throw new Error('Unexpected SQL');}};
 const service={resolveSession:async token=>token==='admin'?{accountId:1,schoolId:1,membershipId:1,roles:['admin']}:token==='teacher'?{accountId:2,schoolId:1,membershipId:2,roles:['teacher']}:null,validateCsrf:async(_token,value)=>value==='valid'};
 const base=await serve(t,createSchoolApp(db,{identityService:service,personnelWrites:true}));
 assert.equal((await fetch(base+'/registration',{redirect:'manual'})).status,302);
 assert.equal((await fetch(base+'/registration',{headers:{Cookie:'__Host-lms_session=teacher'}})).status,403);
 const page=await fetch(base+'/registration',{headers:{Cookie:'__Host-lms_session=admin'}});assert.equal(page.status,200);const html=await page.text();assert.match(html,/reg-student-layout/);assert.match(html,/teacher-split-form/);assert.match(html,/LYCEE BATOURI · Student and teacher registration/);assert.doesNotMatch(html,/Fictional records/);
 const endpoint=base+'/api/personnel/students';
 assert.equal((await fetch(endpoint,{method:'POST',headers:{Origin:'https://localhost:2027',Cookie:'__Host-lms_session=admin','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(endpoint,{method:'POST',headers:{Origin:'https://attacker.invalid',Cookie:'__Host-lms_session=admin','X-CSRF-Token':'valid','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(endpoint,{method:'POST',headers:{Origin:'https://localhost:2027',Cookie:'__Host-lms_session=teacher','X-CSRF-Token':'valid','Content-Type':'application/json'},body:JSON.stringify({firstName:'Synthetic',lastName:'Pupil',matricule:'ONLY-TEST',section:'Anglophone',sex:'Female',password:'Synthetic-only-password'})})).status,403);
 assert.equal((await fetch(base+'/api/personnel/students/1',{method:'PATCH',headers:{Origin:'https://localhost:2027',Cookie:'__Host-lms_session=admin','X-CSRF-Token':'valid','Content-Type':'application/json'},body:JSON.stringify({version:1,school_id:2})})).status,422);
 assert.equal((await fetch(base+'/api/setup/classes',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 for(const file of ['m1-original-registration.js','legacy-personnel-handoff.js'])assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(require.resolve('../public/js/'+file),'utf8')));
});
test('activation preflight refuses any unresolved personnel drift and never performs repairs',async()=>{
 const clean={unownedProfiles:0,unmappedProfiles:0,credentialDrift:0,membershipDrift:0,roleDrift:0,nativeProfileDrift:0};
 const db=value=>({getPool:()=>({request:()=>({input(){return this;},query:async text=>{assert.doesNotMatch(text,/\b(UPDATE|INSERT|DELETE|ALTER)\b/i);return {recordset:[value]};}})})});
 assert.deepEqual(await personnelActivationReadiness(db(clean)),clean);
 for(const key of Object.keys(clean))await assert.rejects(personnelActivationReadiness(db({...clean,[key]:1})),/drift requires review/);
});
