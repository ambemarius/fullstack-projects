const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../public/js/canonical-staff-accounts.js'),'utf8');
async function settle(){for(let n=0;n<20;n++)await new Promise(resolve=>setImmediate(resolve));}
async function harness(){
 let mode='normal',issued=false;const nodes=new Map(),requests=[];
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},querySelectorAll:()=>[],createElement:tag=>new Element(tag)};
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.value='';this.hidden=false;this.isConnected=true;this.attrs={};this.classes=new Set();this.dataset={};}
  get classList(){return {toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),contains:name=>this.classes.has(name)};}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(key,value){this.attrs[key]=value;}
  focus(){document.activeElement=this;}getClientRects(){return [{}];}
 }
 document.body=new Element('body');document.body.dataset.schoolAdministration='true';document.activeElement=document.body;
 document.getElementById('purpose').value='activate';document.getElementById('operator').hidden=true;document.getElementById('secret-note').hidden=true;
 for(const id of ['issued-token','admin-name','admin-email'])document.getElementById(id);
 const response=(data,status=200)=>({status,ok:status<400,json:async()=>data});
 const fetch=async(path,options)=>{
  requests.push(path);
  if(mode==='denied'&&path.includes('/directory'))return response({message:'Access denied'},403);
  if(mode==='refresh-failed'&&issued&&options.method==='GET')return response({message:'List unavailable'},500);
  if(path.endsWith('/session'))return response({identity:{schoolId:3,roles:['admin'],platformPermissions:[]}});
  if(path.endsWith('/csrf'))return response({csrfToken:'mock'});
  if(path.endsWith('/context'))return response({data:{schoolId:3,schoolName:'Synthetic A',roleLabel:'School Super Administrator'}});
  if(path.endsWith('/administrators')&&options.method==='POST')return response({message:'Unable to save this profile'},422);
  if(path.endsWith('/invite')){issued=true;return response({data:{invitationToken:'FICTIONAL-TEST-TOKEN'}},201);}
  if(path.includes('/administrators?'))return response({data:[{profileType:'admin',profileId:1,name:'Synthetic Admin',email:'admin@example.invalid',status:'active',linked:false,profileVersion:'a'.repeat(64)}]});
  return response({data:[]});
 };
 vm.runInNewContext(source,{document,Node:Element,fetch,window:{confirm:()=>true,location:{replace(){}}}});await settle();
 return {nodes,document,requests,setMode(value){mode=value;},button(text){const walk=n=>n.textContent===text?n:n.children.map(walk).find(Boolean);return walk(nodes.get('profiles'));}};
}
test('school manager sees local account tools and an honest empty token state',async()=>{
 const h=await harness();assert.equal(h.nodes.get('operator').hidden,false);assert.equal(h.nodes.get('accept-panel').hidden,true);
 assert.match(h.nodes.get('school-context').textContent,/Synthetic A/);assert.equal(h.requests.some(p=>p.includes('existing-accounts')),false);
 assert.match(h.nodes.get('tokens').children[0].children[0].textContent,/No invitations/);
});
test('a failed refresh cannot lose an already issued private token',async()=>{
 const h=await harness();h.setMode('refresh-failed');h.button('Issue invitation').onclick();await settle();
 assert.equal(h.nodes.get('issued-token').textContent,'FICTIONAL-TEST-TOKEN');assert.equal(h.nodes.get('secret-note').hidden,false);
 assert.match(h.nodes.get('message').textContent,/Token issued successfully/);
});
test('access denial clears private state and restores the account setup view',async()=>{
 const h=await harness();h.nodes.get('issued-token').textContent='PRIVATE';h.setMode('denied');h.nodes.get('refresh').onclick();await settle();
 assert.equal(h.nodes.get('operator').hidden,true);assert.equal(h.nodes.get('accept-panel').hidden,false);
 assert.equal(h.nodes.get('school-context').textContent,'');assert.equal(h.nodes.get('issued-token').textContent,'');assert.equal(h.nodes.get('secret-note').hidden,true);
});
test('validation failure preserves the draft and focuses the visible error',async()=>{
 const h=await harness();h.nodes.get('admin-name').value='Draft name';h.nodes.get('admin-email').value='draft@example.invalid';
 h.nodes.get('create-admin').onsubmit({preventDefault(){}});await settle();
 assert.equal(h.nodes.get('admin-name').value,'Draft name');assert.equal(h.nodes.get('admin-email').value,'draft@example.invalid');
 assert.equal(h.nodes.get('message').classList.contains('error'),true);assert.equal(h.document.activeElement,h.nodes.get('message'));
});
