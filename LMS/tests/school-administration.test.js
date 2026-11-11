const test=require('node:test'),assert=require('node:assert/strict');
const {resolveManager}=require('../model/identity/schoolAdministration');
const {createNativeStaffService}=require('../model/identity/nativeStaffService');
const token='T'.repeat(43);
test('school account authority rejects another school or a non-administrator before SQL',async()=>{
 const actor={accountId:1,membershipId:2,schoolId:3,roles:['admin'],platformPermissions:['platform_operator']};
 const identity={resolveSession:async()=>actor};
 assert.equal((await resolveManager(identity,token,3)).schoolId,3);
 await assert.rejects(resolveManager(identity,token,4),e=>e.statusCode===403);
 await assert.rejects(resolveManager({resolveSession:async()=>({...actor,roles:['teacher']})},token,3),e=>e.statusCode===403);
 const service=createNativeStaffService(identity,{connect(){throw Error('Unexpected SQL');}},{schoolAdministration:true});
 for(const method of ['directory','administrators','tokens','existingAccounts'])await assert.rejects(service[method](token,4),e=>e.statusCode===403);
 await assert.rejects(service.issue(token,{schoolId:4,profileId:2,profileVersion:'a'.repeat(64),role:'admin'}),e=>e.statusCode===403);
 await assert.rejects(service.issue(token,{schoolId:3,profileId:2,profileVersion:'a'.repeat(64),role:'school_super_admin'}),e=>e.statusCode===422);
});
test('school runtime excludes other-institution account linking even for platform holders',async t=>{
 const {createApp}=require('../app/app'),{serve}=require('./helpers/http');
 const {createStaffAccountsRouter}=require('../routes/identity/staffAccountsRouter');
 const identity={resolveSession:async()=>({accountId:1,schoolId:3,membershipId:2,roles:['admin'],platformPermissions:['platform_operator']}),validateCsrf:async()=>true};
 const base=await serve(t,createApp({logging:false,routes:[['/api/staff-accounts',createStaffAccountsRouter({identityService:identity,database:{connect(){throw Error('Unexpected SQL');}},publicOrigin:'https://localhost:2027',schoolAdministration:true})]]}));
 const headers={Cookie:'__Host-lms_session='+token,Origin:'https://localhost:2027','Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/staff-accounts/existing-accounts?schoolId=3',{headers})).status,404);
 assert.equal((await fetch(base+'/api/staff-accounts/existing',{method:'POST',headers,body:'{}'})).status,404);
 assert.equal((await fetch(base+'/api/staff-accounts/directory?schoolId=4',{headers})).status,403);
});
