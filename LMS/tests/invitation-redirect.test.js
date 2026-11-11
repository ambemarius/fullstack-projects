const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function element(){return {value:'',textContent:'',hidden:false,elements:{accountType:{value:'admin'},password:{value:''}},replaceChildren(){},append(){},addEventListener(){}};}
async function settle(){for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));}
function documentStub(){const elements=new Map();return {elements,document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return[];},createElement(){return element();}}};}
test('successful invitation acceptance clears secrets and replaces invitation page with teacher login',async()=>{
 const {elements,document}=documentStub(),calls=[],navigations=[];
 const fetch=async(path,options)=>{calls.push(path);const payload=path.endsWith('/session')?{identity:{schoolId:1,roles:['teacher'],platformPermissions:[]}}:path.endsWith('/csrf')?{csrfToken:'synthetic-csrf'}:{status:'success',data:{signedOut:true}};return {ok:true,status:200,json:async()=>payload};};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/canonical-invitations.js'),'utf8'),{document,fetch,window:{location:{replace:url=>navigations.push(url)}}});await settle();
 document.getElementById('token').value='T'.repeat(43);elements.get('accept').onsubmit({preventDefault(){}});await settle();
 assert.deepEqual(navigations,['/?invitation=accepted&accountType=teacher']);assert.equal(elements.get('token').value,'');assert.equal(elements.get('workspace').hidden,true);assert.match(elements.get('message').textContent,/accepted successfully/);assert.equal(calls.some(path=>path.includes('logout')),false);assert.equal(navigations[0].includes('T'.repeat(43)),false);
});
test('rejected invitation does not redirect or show a false success',async()=>{
 const {elements,document}=documentStub(),navigations=[];
 const fetch=async path=>({ok:!path.includes('accept-existing-admin'),status:path.includes('accept-existing-admin')?403:200,json:async()=>path.endsWith('/session')?{identity:{schoolId:1,roles:['teacher'],platformPermissions:[]}}:path.endsWith('/csrf')?{csrfToken:'synthetic-csrf'}:{message:'Invitation rejected'}});
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/canonical-invitations.js'),'utf8'),{document,fetch,window:{location:{replace:url=>navigations.push(url)}}});await settle();document.getElementById('token').value='T'.repeat(43);elements.get('accept').onsubmit({preventDefault(){}});await settle();assert.equal(navigations.length,0);assert.equal(elements.get('message').textContent,'Invitation rejected');
});
test('staff who already have administrator access are not shown the acceptance form again',async()=>{
 const {elements,document}=documentStub();const fetch=async path=>({ok:true,status:200,json:async()=>path.endsWith('/session')?{identity:{schoolId:1,roles:['teacher','admin'],platformPermissions:[]}}:{csrfToken:'synthetic-csrf'}});
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/canonical-invitations.js'),'utf8'),{document,fetch,window:{location:{replace(){throw Error('Unexpected navigation');}}}});await settle();assert.equal(elements.get('accept-panel').hidden,true);assert.equal(elements.get('already-admin').hidden,false);
});
test('login arrival preserves success feedback, selects Teacher and removes the one-time message URL',async()=>{
 const {elements,document}=documentStub(),history=[];
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/canonical-school.js'),'utf8'),{document,URLSearchParams,window:{location:{search:'?invitation=accepted&accountType=teacher'},history:{replaceState:(_state,_title,path)=>history.push(path)}},fetch:async()=>({status:403,ok:false,json:async()=>({message:'Sign in'})})});await settle();
 assert.equal(elements.get('login-form').elements.accountType.value,'teacher');assert.equal(elements.get('login-view').hidden,false);assert.match(elements.get('message').textContent,/Invitation accepted successfully/);assert.deepEqual(history,['/']);
});
