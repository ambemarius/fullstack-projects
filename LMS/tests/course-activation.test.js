const {test}=require('node:test');const assert=require('node:assert/strict');const express=require('express');
const {createApp}=require('../app/app');const {createSchoolApp}=require('../scripts/canonicalSchool');const {serve}=require('./helpers/http');const generateToken=require('../utils/generateToken');
test('staged course lock closes retired routes and teacher academic bypasses while preserving unrelated modules',async t=>{
 const router=express.Router();router.use((_req,res)=>res.status(204).end());const base=await serve(t,createApp({logging:false,routes:[['/',router]],legacyAcademicLinksReadOnly:true}));
 for(const [method,path]of [['GET','marks'],['POST','marks'],['GET','class-subject-students/1/1'],['GET','teachers/my-students'],['POST','allocations/set']])assert.equal((await fetch(base+'/api/v1/'+path,{method})).status,409);
 for(const role of ['teacher','student'])for(const path of ['subjects','classes','academic-years','academic-context','report-cards','timetables','exams','exam-results','allocations'])assert.equal((await fetch(base+'/api/v1/'+path,{headers:{Authorization:'Bearer '+generateToken(1,role)}})).status,409);
 assert.equal((await fetch(base+'/api/v1/allocations',{headers:{Authorization:'Bearer '+generateToken(1,'admin')}})).status,204);
 assert.equal((await fetch(base+'/api/v1/auxiliary')).status,204);
});
test('course workspace is opt-in and both scoped API mounts reject anonymous or missing CSRF before SQL',async t=>{
 const database={connect(){throw Error('Unexpected SQL');}};const identity={resolveSession:async token=>token==='teacher'?{accountId:1,schoolId:1,membershipId:1,roles:['teacher']}:null,validateCsrf:async()=>false};
 assert.throws(()=>createSchoolApp(database,{academicLinks:true}),/requires/);
 const disabled=await serve(t,createSchoolApp(database,{identityService:identity}));assert.equal((await fetch(disabled+'/courses')).status,404);assert.equal((await fetch(disabled+'/api/links/offerings')).status,404);
 const base=await serve(t,createSchoolApp(database,{identityService:identity,personnelWrites:true,academicWrites:true,academicLinks:true}));
 const redirect=await fetch(base+'/courses',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/?next=courses');
 assert.equal((await fetch(base+'/courses',{headers:{Cookie:'__Host-lms_session=teacher'}})).status,200);
 for(const path of ['links/offerings','links/my-timetable?yearId=1&term=First','marks/sheet?offeringId=1&yearId=1&term=First'])assert.equal((await fetch(base+'/api/'+path)).status,403);
 for(const path of ['links/enrolments','marks/scores'])assert.equal((await fetch(base+'/api/'+path,{method:'POST',headers:{Origin:'https://localhost:2027',Cookie:'__Host-lms_session=teacher','Content-Type':'application/json'},body:'{}'})).status,403);
});

test('original self timetable bookmarks lead to Courses while the school course workspace is active',async t=>{
 const base=await serve(t,createApp({logging:false,legacyAcademicLinksReadOnly:true}));
 for(const role of ['teacher','student']){
  const response=await fetch(base+'/timetable-'+role,{redirect:'manual'});
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),'https://localhost:2027/courses');
 }
});
