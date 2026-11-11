const test=require('node:test'),assert=require('node:assert/strict');
const {createAuxiliaryInvitationService}=require('../model/identity/auxiliaryInvitationService');
test('auxiliary invitations reject implicit authority, caller credential fields and non-operators before SQL',async()=>{
 const database={connect(){throw Error('Unexpected SQL');}},service=createAuxiliaryInvitationService({resolveSession:async()=>({accountId:1,platformPermissions:[]})},database);
 const input={schoolId:2,accountId:3,profileId:4,role:'librarian',profileVersion:'a'.repeat(64)};
 for(const role of ['admin','teacher','student','platform_operator','school_onboarding','Librarian'])await assert.rejects(service.issue('T'.repeat(43),{...input,role}),e=>e.statusCode===422);
 await assert.rejects(service.issue('T'.repeat(43),{...input,password:'Never-use-password-fields'}),e=>e.statusCode===422);
 await assert.rejects(service.issue('T'.repeat(43),input),e=>e.statusCode===403);
 await assert.rejects(service.accept('T'.repeat(43),'invalid'),e=>e.statusCode===403);
 await assert.rejects(service.revoke('T'.repeat(43),'bad-id'),e=>e.statusCode===422);
});
test('pending-school bootstrap cannot issue a staff-profile namespace invitation',async()=>{
 const identity=require('../model/identity/identityService').createIdentityService({connect(){throw Error('Unexpected SQL');}});
 await assert.rejects(identity.inviteSchool('T'.repeat(43),{code:'SYNTHETIC',name:'Synthetic',educationSystem:'Bilingual',intendedLoginKey:'STAFF-PROFILE:1:2:librarian:reserved',requestId:'synthetic'}),e=>e.statusCode===403);
});
test('unmounted auxiliary invitation factory enforces session, Origin, CSRF and token-only acceptance before SQL',async t=>{
 const {createAuxiliaryInvitationRouter}=require('../routes/identity/auxiliaryInvitationRouter'),{createApp}=require('../app/app'),{serve}=require('./helpers/http');
 const identity={resolveSession:async token=>token==='T'.repeat(43)?{accountId:1,schoolId:1,roles:['teacher'],platformPermissions:[]}:null,validateCsrf:async(_token,value)=>value==='valid'};
 const database={connect(){throw Error('Unexpected SQL');}},origin='https://school.example';
 const base=await serve(t,createApp({logging:false,routes:[['/staff-invitations',createAuxiliaryInvitationRouter({identityService:identity,database,publicOrigin:origin})]]}));
 const headers={Origin:origin,Cookie:'__Host-lms_session='+'T'.repeat(43),'Content-Type':'application/json','X-CSRF-Token':'valid'};
 for(const missing of ['Cookie','X-CSRF-Token','Origin']){const bad={...headers};delete bad[missing];assert.equal((await fetch(base+'/staff-invitations/accept',{method:'POST',headers:bad,body:'{}'})).status,403);}
 const injected=await fetch(base+'/staff-invitations/accept',{method:'POST',headers,body:JSON.stringify({invitationToken:'A'.repeat(43),accountId:2})});assert.equal(injected.status,422);assert.equal(injected.headers.get('set-cookie'),null);
 const denied=await fetch(base+'/staff-invitations',{method:'POST',headers,body:JSON.stringify({schoolId:2,accountId:3,profileId:4,role:'librarian',profileVersion:'a'.repeat(64)})});assert.equal(denied.status,403);assert.equal(denied.headers.get('cache-control'),'no-store');
 const app=await serve(t,require('../scripts/canonicalSchool').createSchoolApp(database,{identityService:identity,membershipInvitations:true}));assert.equal((await fetch(app+'/api/auxiliary-invitations')).status,404);
});
