const test=require('node:test');const assert=require('node:assert/strict');const express=require('express');const vm=require('node:vm');const fs=require('node:fs');const {createApp}=require('../app/app');const {createSchoolApp}=require('../scripts/canonicalSchool');const {serve}=require('./helpers/http');
test('auxiliary activation protects pages and mutations and closes all old auxiliary writers',async t=>{
 const router=express.Router();router.use((_req,res)=>res.status(204).end());const old=await serve(t,createApp({routes:[['/',router]],logging:false,legacyAuxiliaryReadOnly:true}));
 for(const [method,path]of [['POST','register'],['PUT','1'],['DELETE','1'],['PUT','set-status/1']])assert.equal((await fetch(old+'/api/v1/auxiliary/'+path,{method})).status,409);
 assert.equal((await fetch(old+'/api/v1/auxiliary')).status,204);
 const identity={resolveSession:async token=>token==='admin'?{accountId:1,schoolId:1,membershipId:1,roles:['admin']}:token==='teacher'?{accountId:2,schoolId:1,membershipId:2,roles:['teacher']}:null,validateCsrf:async(_token,csrf)=>csrf==='valid'};
 const db={connect(){throw Error('Must not access SQL');}};const base=await serve(t,createSchoolApp(db,{identityService:identity,personnelWrites:true,auxiliaryWrites:true}));
 assert.equal((await fetch(base+'/auxiliary',{redirect:'manual'})).status,302);assert.equal((await fetch(base+'/auxiliary',{headers:{Cookie:'__Host-lms_session=teacher'}})).status,403);
 const page=await fetch(base+'/auxiliary',{headers:{Cookie:'__Host-lms_session=admin'}});assert.equal(page.status,200);assert.match(await page.text(),/Job title/);
 assert.equal((await fetch(base+'/api/auxiliary',{headers:{Cookie:'__Host-lms_session=teacher'}})).status,403);
 const body={firstName:'Synthetic',lastName:'Staff',email:'staff@example.invalid',jobTitle:'Librarian'};
 const headers={Origin:'https://localhost:2027',Cookie:'__Host-lms_session=admin','Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/auxiliary',{method:'POST',headers,body:JSON.stringify(body)})).status,403);
 assert.equal((await fetch(base+'/api/auxiliary',{method:'POST',headers:{...headers,'X-CSRF-Token':'valid'},body:JSON.stringify({...body,permission:'platform_operator'})})).status,422);
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(require.resolve('../public/js/canonical-auxiliary.js'),'utf8')));
});
