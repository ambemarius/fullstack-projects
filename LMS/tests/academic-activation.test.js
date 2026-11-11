const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const express=require('express');
const {createApp}=require('../app/app');const {createSchoolApp}=require('../scripts/canonicalSchool');const {serve}=require('./helpers/http');
test('retired year delete handler refuses every identifier even if the outer write lock is absent',async t=>{
 const router=express.Router();
 router.delete('/:id',require('../controllers/academic/academicYearCtrl').deleteAcademicYearCtrl);
 const base=await serve(t,createApp({logging:false,routes:[['/years',router]]}));
 for(const id of ['1','999999','unknown']){
     const response=await fetch(base+'/years/'+id,{method:'DELETE'});
     assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET, HEAD');
 }
});
test('academic activation closes old academic writers and retains reads and other modules',async t=>{
 const router=express.Router();router.use((_req,res)=>res.status(204).end());const base=await serve(t,createApp({logging:false,routes:[['/',router]],legacyAcademicReadOnly:true}));
 for(const [method,path]of [['PUT','classes/1'],['POST','subjects'],['DELETE','subjects/1'],['POST','academic-years'],['PUT','academic-years/1/current'],['DELETE','ACADEMIC-YEARS/1']])assert.equal((await fetch(base+'/api/v1/'+path,{method})).status,409);
 for(const [method,path]of [['GET','classes'],['GET','subjects/1'],['POST','auxiliary/register']])assert.equal((await fetch(base+'/api/v1/'+path,{method})).status,204);
});
test('academic workspace requires administrator and protects actual academic write routes',async t=>{
 const identity={resolveSession:async token=>token==='admin'?{accountId:1,schoolId:1,membershipId:1,roles:['admin']}:token==='teacher'?{accountId:2,schoolId:1,membershipId:2,roles:['teacher']}:null,validateCsrf:async(_t,value)=>value==='valid'};
 const database={connect(){throw new Error('Unexpected database access');}};const base=await serve(t,createSchoolApp(database,{identityService:identity,personnelWrites:true,academicWrites:true}));
 const redirect=await fetch(base+'/academic?kind=subject',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/?next=academic&kind=subject');
 assert.equal((await fetch(base+'/academic',{headers:{Cookie:'__Host-lms_session=teacher'}})).status,403);
 const page=await fetch(base+'/academic',{headers:{Cookie:'__Host-lms_session=admin'}});assert.equal(page.status,200);assert.match(await page.text(),/Classes|Academic years/);
 for(const path of ['classes','subjects','academic-years'])assert.equal((await fetch(base+'/api/setup/'+path,{method:'POST',headers:{Origin:'https://localhost:2027',Cookie:'__Host-lms_session=admin','Content-Type':'application/json'},body:'{}'})).status,403);
 const invalid=await fetch(base+'/api/setup/classes',{method:'POST',headers:{Origin:'https://localhost:2027',Cookie:'__Host-lms_session=admin','X-CSRF-Token':'valid','Content-Type':'application/json'},body:JSON.stringify({name:'Synthetic',section:'Anglophone',rank:1,school_id:2})});assert.equal(invalid.status,422);
 const teacher=await fetch(base+'/api/setup/subjects',{method:'POST',headers:{Origin:'https://localhost:2027',Cookie:'__Host-lms_session=teacher','X-CSRF-Token':'valid','Content-Type':'application/json'},body:JSON.stringify({name:'Synthetic',code:'SYN'})});assert.equal(teacher.status,403);
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(require.resolve('../public/js/canonical-academic.js'),'utf8')));
});
