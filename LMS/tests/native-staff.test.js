const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createNativeStaffService}=require('../model/identity/nativeStaffService');
test('staff schema activation refuses other database or server targets',()=>{const {approvedTarget}=require('../scripts/activateStaffSchema');assert.doesNotThrow(()=>approvedTarget({name:'schooldb',server:'MARIUS\\DEV'}));for(const state of [{name:'master',server:'MARIUS\\DEV'},{name:'schooldb',server:'MARIUS'},{name:'lms_test_codex',server:'MARIUS'}])assert.throws(()=>approvedTarget(state));});
test('native staff endpoints reject privilege/credential injection and invalid private passwords before SQL',async()=>{
 const service=createNativeStaffService({resolveSession:async()=>({accountId:1,platformPermissions:[]})},{connect(){throw Error('Unexpected SQL');}});
 await assert.rejects(service.issue('T'.repeat(43),{schoolId:1,profileId:2,profileVersion:'a'.repeat(64),role:'platform_operator'}),e=>e.statusCode===422);
 await assert.rejects(service.issue('T'.repeat(43),{schoolId:1,profileId:2,profileVersion:'a'.repeat(64),role:'librarian',password:'hidden'}),e=>e.statusCode===422);
 await assert.rejects(service.issue('T'.repeat(43),{schoolId:1,profileId:2,profileVersion:'a'.repeat(64),role:'librarian'}),e=>e.statusCode===403);
 for(const password of ['short','é'.repeat(37)])await assert.rejects(service.accept('T'.repeat(43),password),e=>e.statusCode===422);
});
function element(){return{focus(){this.focused=true;},value:'',hidden:false,children:[],append(...rows){this.children.push(...rows);},replaceChildren(...rows){this.children=rows;}};}
async function settle(){for(let i=0;i<15;i++)await new Promise(resolve=>setImmediate(resolve));}
async function fixture(accountType='staff'){const elements=new Map(),calls=[],locations=[];const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return[];},createElement:element};document.getElementById('purpose').value='activate';
 const fetch=async(path,options)=>{calls.push({path,options});return path.endsWith('/session')?{status:403,ok:false,json:async()=>({message:'Sign in'})}:{status:200,ok:true,json:async()=>({data:{created:true,signedOut:true,accountType}})};};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/canonical-staff-accounts.js'),'utf8'),{document,fetch,window:{location:{replace:path=>locations.push(path)}},Node:Object});await settle();return{elements,calls,locations};}
test('native account acceptance clears private inputs and returns directly to staff sign-in',async()=>{
 const f=await fixture();for(const id of ['password','confirm'])f.elements.get(id).value='Fictional-private-password';f.elements.get('token').value='T'.repeat(43);f.elements.get('accept').onsubmit({preventDefault(){}});await settle();
 assert.deepEqual(f.locations,['/?staff=ready&accountType=staff']);for(const id of ['password','confirm','token'])assert.equal(f.elements.get(id).value,'');const request=f.calls.find(r=>r.path.endsWith('/activate'));assert.equal(JSON.parse(request.options.body).password,'Fictional-private-password');assert.equal(f.locations[0].includes('Fictional'),false);
});
test('mismatched passwords do not submit or navigate',async()=>{const f=await fixture();f.elements.get('password').value='Fictional-private-password';f.elements.get('confirm').value='Different';f.elements.get('accept').onsubmit({preventDefault(){}});await settle();assert.equal(f.locations.length,0);assert.equal(f.calls.some(r=>r.path.endsWith('/activate')),false);assert.equal(f.elements.get('message').textContent,'Passwords do not match.');});
test('standalone administrator activation returns to the Administrator login selection',async()=>{const f=await fixture('admin');for(const id of ['password','confirm'])f.elements.get(id).value='Fictional-private-password';f.elements.get('token').value='T'.repeat(43);f.elements.get('accept').onsubmit({preventDefault(){}});await settle();assert.deepEqual(f.locations,['/?staff=ready&accountType=admin']);});
test('staff account HTTP boundary exposes private setup but protects operator actions and real-school scope',async t=>{
 const {serve}=require('./helpers/http'),{createSchoolApp}=require('../scripts/canonicalSchool');const identity={resolveSession:async token=>token==='T'.repeat(43)?{accountId:1,schoolId:1,membershipId:1,roles:['teacher'],platformPermissions:[]}:null,validateCsrf:async()=>false},database={connect(){throw Error('Unexpected SQL');}};
 const base=await serve(t,createSchoolApp(database,{identityService:identity,staffAccounts:true}));assert.equal((await fetch(base+'/staff-accounts')).status,200);
 assert.equal((await fetch(base+'/api/staff-accounts/directory?schoolId=1')).status,403);assert.equal((await fetch(base+'/api/staff-accounts/directory?schoolId=1',{headers:{Cookie:'__Host-lms_session='+'T'.repeat(43)}})).status,403);
 const headers={Origin:'https://localhost:2027','Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/staff-accounts/activate',{method:'POST',headers,body:JSON.stringify({invitationToken:'T'.repeat(43),password:'short',role:'admin'})})).status,422);
 assert.equal((await fetch(base+'/api/staff-accounts/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/staff-accounts/invite',{method:'POST',headers,body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/identity/switch-school',{method:'POST',headers,body:JSON.stringify({schoolCode:'ANOTHER_SCHOOL'})})).status,422);
});
