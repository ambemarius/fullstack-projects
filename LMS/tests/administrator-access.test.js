const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createMembershipInvitationService}=require('../model/identity/membershipInvitationService');
test('administrator removal refuses injected fields and non-operator authority before database access',async()=>{
 const service=createMembershipInvitationService({resolveSession:async()=>({accountId:1,platformPermissions:[]})},{connect(){throw Error('Unexpected SQL');}});
 await assert.rejects(service.removeAdministrator('T'.repeat(43),{schoolId:1,accountId:2,version:1,role:'platform_operator'}),e=>e.statusCode===422);
 await assert.rejects(service.removeAdministrator('T'.repeat(43),{schoolId:1,accountId:2,version:1}),e=>e.statusCode===403);
 await assert.rejects(service.administrators('T'.repeat(43),1),e=>e.statusCode===403);
});
class Element{constructor(){this.children=[];this.hidden=false;this.value='';}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}}
async function settle(){for(let i=0;i<15;i++)await new Promise(resolve=>setImmediate(resolve));}
test('operator review confirms role removal, sends the reviewed version, refreshes and clears private data on denial',async()=>{
 const elements=new Map(),requests=[];let confirmed=false,removed=false,deny=false;
 const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:()=>new Element(),querySelectorAll(){return[];}};
 const fetch=async(path,options)=>{requests.push({path,options});let data={};if(path.endsWith('/session'))data={identity:{schoolId:1,roles:['admin'],platformPermissions:['platform_operator']}};else if(path.endsWith('/csrf'))data={csrfToken:'fictional'};else if(path.includes('/administrators?'))data={data:removed?[]:[{accountId:2,name:'Synthetic Teacher',email:'fixture@example.invalid',profileType:'teacher',version:4,canRemove:1},{accountId:1,name:'Protected Admin',email:'protected@example.invalid',profileType:'admin',version:1,canRemove:0}]};else if(path.endsWith('/remove-administrator')){removed=true;data={data:{removed:true}};}else data={data:[]};return{status:deny?403:200,ok:!deny,json:async()=>deny?{message:'Denied'}:data};};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/canonical-invitations.js'),'utf8'),{document,fetch,window:{confirm:()=>confirmed}});await settle();
 const rows=elements.get('administrators').children;assert.equal(rows.length,2);assert.equal(rows[1].children[2].children[0].textContent,'Protected; separate review required');const button=rows[0].children[2].children[0];button.onclick();await settle();assert.equal(requests.some(r=>r.path.endsWith('/remove-administrator')),false);
 confirmed=true;button.onclick();await settle();const request=requests.find(r=>r.path.endsWith('/remove-administrator'));assert.deepEqual(JSON.parse(request.options.body),{schoolId:1,accountId:2,version:4});assert.equal(elements.get('administrators').children.length,0);assert.match(elements.get('message').textContent,/Teacher access and password preserved/);
 deny=true;elements.get('refresh').onclick();await settle();assert.equal(elements.get('operator').hidden,true);assert.equal(elements.get('administrators').children.length,0);
});
