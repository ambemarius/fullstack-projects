const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function settle(){for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));}
async function launch(role,{enabled=true,next='courses'}={}){
 const elements=new Map(),navigations=[],handlers={};let deny=false;
 const document={getElementById(id){if(id==='course-nav'&&!enabled)return null;if(!elements.has(id))elements.set(id,{hidden:true,elements:{accountType:{},password:{}},replaceChildren(){},addEventListener(name,handler){handlers[id+':'+name]=handler;}});return elements.get(id);},createElement(){return{append(){}};}};
 const fetch=async path=>({status:deny?403:200,ok:!deny,json:async()=>deny?{message:'Denied'}:path.endsWith('/session')?{identity:{roles:[role]}}:{csrfToken:'synthetic'}});
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/canonical-school.js'),'utf8'),{document,fetch,URLSearchParams,window:{location:{search:'?next='+next,assign:path=>navigations.push(path)}}});await settle();
 return{elements,navigations,handlers,deny(){deny=true;}};
}
test('course return is fixed and available to each school role only when the feature is rendered',async()=>{
 for(const role of ['admin','teacher','student'])assert.deepEqual((await launch(role)).navigations,['/courses']);
 assert.deepEqual((await launch('teacher',{enabled:false})).navigations,[]);assert.deepEqual((await launch('observer')).navigations,[]);
 assert.deepEqual((await launch('teacher',{next:'https://example.invalid'})).navigations,[]);
});
test('course navigation is hidden again when the session loses authority',async()=>{
 const f=await launch('student',{next:''});assert.equal(f.elements.get('course-nav').hidden,false);f.deny();await f.handlers['logout:click']();assert.equal(f.elements.get('course-nav').hidden,true);
});
