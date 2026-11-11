const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync(require.resolve('../public/js/finance-workspace.js'),'utf8');
function setup(fetch){
 const handlers={},button={disabled:false},attrs=new Map([['method','post']]);let location,cleared=false;
 class Form{
  constructor(){this.values={amount:'10000',method:'mobile',action:'pay'};}
  get action(){throw Error('Named action control shadows property');}get method(){throw Error('Named method control shadows property');}
  getAttribute(key){return attrs.get(key)||null;}setAttribute(key,value){attrs.set(key,value);}removeAttribute(key){attrs.delete(key);}
  querySelector(){return null;}querySelectorAll(){return [button];}prepend(el){this.error=el;}
 }
 const form=new Form();
 const context={HTMLFormElement:Form,URLSearchParams,
  FormData:class{constructor(f){this.values=f.values;}*[Symbol.iterator](){yield* Object.entries(this.values);}},
  DOMParser:class{parseFromString(){return {querySelector:()=>({textContent:'Enter a transaction reference.'})};}},
  document:{body:{dataset:{}},getElementById:id=>id==='finance-main'?{replaceChildren:()=>cleared=true}:null,
   querySelectorAll:()=>[],addEventListener:(name,handler)=>handlers[name]=handler,
   createElement:()=>({setAttribute(){},focus(){this.focused=true;}})},
  window:{location:{href:'https://localhost:2030/workspace/finance?charge=1',assign:url=>location=url}},fetch};
 vm.runInNewContext(script,context);
 return {form,button,attrs,submit:()=>handlers.submit({target:form,preventDefault(){}}),get location(){return location;},get cleared(){return cleared;}};
}
test('finance submission uses form attributes despite named controls and preserves draft on validation failure',async()=>{
 let sent;const h=setup(async(url,options)=>{sent={url,options};return {ok:false,status:422,text:async()=>''};});
 await h.submit();assert.equal(sent.url,'https://localhost:2030/workspace/finance?charge=1');assert.equal(sent.options.body.get('method'),'mobile');
 assert.equal(h.form.values.amount,'10000');assert.equal(h.form.error.textContent,'Enter a transaction reference.');assert.ok(h.form.error.focused);
 assert.equal(h.button.disabled,false);assert.equal(h.attrs.has('aria-busy'),false);
});
test('finance pending submissions cannot double-submit and network failure retains draft',async()=>{
 let reject,count=0;const h=setup(()=>{count++;return new Promise((_resolve,r)=>reject=r);});
 const pending=h.submit();await h.submit();assert.equal(count,1);assert.equal(h.button.disabled,true);
 reject(Error('offline'));await pending;assert.match(h.form.error.textContent,/Check the records before retrying/);assert.equal(h.form.values.amount,'10000');assert.equal(h.button.disabled,false);
});
test('finance denial clears private content and returns to workspace sign-in',async()=>{
 const h=setup(async()=>({ok:false,status:403,text:async()=>''}));await h.submit();assert.equal(h.cleared,true);assert.equal(h.location,'/');
});
test('finance successful redirect opens the verified server destination',async()=>{
 const h=setup(async()=>({ok:true,redirected:true,url:'https://localhost:2030/workspace/finance/receipt/12'}));
 await h.submit();assert.equal(h.location,'https://localhost:2030/workspace/finance/receipt/12');
});
