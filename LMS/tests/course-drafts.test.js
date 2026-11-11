const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.value='';this.hidden=false;}
 append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
 replaceChildren(...children){this.children=[];this.append(...children);}
 setAttribute(){}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
 querySelector(selector){return walk(this).find(child=>selector==='[data-marks]'?child.dataset.marks:child.dataset.roster);}
}
function walk(root){return root.children.flatMap(child=>[child,...walk(child)]);}
async function settle(){for(let n=0;n<16;n++)await new Promise(resolve=>setImmediate(resolve));}
async function fixture(){
 const elements=new Map(),root=new Element(),calls=[],events={},pending=[];let denied=false,conflict=false,confirm=false;
 const document={getElementById(id){if(!elements.has(id)){const element=new Element();elements.set(id,element);root.append(element);}return elements.get(id);},createElement:tag=>new Element(tag),querySelectorAll:()=>walk(root).filter(e=>['button','select','input'].includes(e.tag))};
 document.getElementById('term').value='First';
 const fetch=async(path,options)=>{calls.push({path,options});let data={};
 if(path.endsWith('/session'))data={identity:{roles:['teacher']}};
 else if(path.endsWith('/csrf'))data={csrfToken:'fictional'};
 else if(path.endsWith('/context'))data={data:{currentYear:{id:1,name:'Synthetic'}}};
 else if(path.includes('my-timetable'))data={data:[]};
 else if(path.includes('my-assignments'))data={data:[{offeringId:1,className:'Class',subjectName:'Subject'}]};
 else if(path.includes('marks/sheet'))data={data:[{studentId:1,firstName:'Fictional',sequence:1,score:5,maxScore:10,version:2}]};
 else if(path.endsWith('/scores')){await new Promise(resolve=>pending.push(resolve));
  if(conflict)return{status:409,ok:false,json:async()=>({message:'Review the latest sheet'})};
  data={data:JSON.parse(options.body).scores.reverse().map(r=>({studentId:r.studentId,sequence:r.sequence,version:r.version+1}))};}
 return{status:denied?404:200,ok:!denied,json:async()=>denied?{message:'Scope unavailable'}:data};};
 const window={confirm:()=>confirm,addEventListener:(name,handler)=>events[name]=handler,location:{assign(){}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/canonical-courses.js'),'utf8'),{document,window,fetch,Node:Element});await settle();
 walk(root).find(e=>e.textContent==='Raw marks').onclick();await settle();
 return{root,elements,calls,events,pending,setDenied(){denied=true;},setConflict(value){conflict=value;},setConfirm(value){confirm=value;}};
}
test('saving a score preserves other drafts, locks inputs in flight, and uses the returned version on repeat save',async()=>{
 const f=await fixture(),inputs=walk(f.root).filter(e=>e.tag==='input'),save=walk(f.root).find(e=>e.textContent==='Save score');
 inputs[2].value='7';inputs[2].oninput();inputs[3].value='10';inputs[3].oninput();inputs[0].value='6';inputs[0].oninput();
 save.onclick();await settle();assert.equal(inputs[0].disabled,true);f.pending.shift()();await settle();
 assert.equal(inputs[2].value,'7');assert.equal(inputs[0].disabled,false);assert.equal(f.calls.filter(c=>c.path.includes('marks/sheet')).length,1);
 const event={preventDefault(){this.prevented=true;}};f.events.beforeunload(event);assert.equal(event.prevented,true);
 save.onclick();await settle();assert.equal(JSON.parse(f.calls.at(-1).options.body).scores[0].version,3);f.pending.shift()();await settle();
});
test('cancelled term change preserves draft scope; confirmed change discards it',async()=>{
 const f=await fixture(),input=walk(f.root).find(e=>e.tag==='input'),term=f.elements.get('term');input.value='8';input.oninput();term.onfocus();term.value='Second';term.onchange();await settle();
 assert.equal(term.value,'First');assert.ok(f.elements.get('details').querySelector('[data-marks]'));
 f.setConfirm(true);term.value='Second';term.onchange();await settle();assert.equal(f.elements.get('details').querySelector('[data-marks]'),undefined);
});
test('a revoked scope clears cached private marks and workspace on 404',async()=>{
 const f=await fixture();assert.ok(f.elements.get('details').querySelector('[data-marks]'));f.setDenied();f.elements.get('refresh').onclick();await settle();
 assert.equal(f.elements.get('workspace').hidden,true);assert.equal(f.elements.get('details').children.length,0);assert.equal(f.elements.get('message').textContent,'Scope unavailable');
});
test('batch save retains all entries on conflict, accepts zero and matches returned versions by identity',async()=>{
 const f=await fixture(),inputs=walk(f.root).filter(e=>e.tag==='input');
 const batch=walk(f.root).find(e=>String(e.textContent).startsWith('Save changed scores'));
 const set=(index,value)=>{inputs[index].value=value;inputs[index].oninput();};
 set(0,'0');set(2,'12');await batch.onclick();
 assert.equal(f.calls.filter(c=>c.path.endsWith('/scores')).length,0);
 set(3,'20');assert.equal(batch.textContent,'Save changed scores (2)');f.setConflict(true);
 const rejected=batch.onclick();await settle();f.pending.shift()();await rejected;
 assert.equal(batch.hidden,false);assert.equal(inputs[0].value,'0');assert.equal(inputs[2].value,'12');
 f.setConflict(false);const success=batch.onclick();await settle();
 assert.deepEqual(JSON.parse(f.calls.at(-1).options.body).scores.map(r=>[r.sequence,r.score,r.maxScore,r.version]),[[1,0,10,2],[2,12,20,0]]);
 f.pending.shift()();await success;assert.equal(batch.hidden,true);
 set(2,'13');const again=batch.onclick();await settle();
 assert.deepEqual(JSON.parse(f.calls.at(-1).options.body).scores.map(r=>[r.sequence,r.version]),[[2,1]]);
 f.pending.shift()();await again;
});
