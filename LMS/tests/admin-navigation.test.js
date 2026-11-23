const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
// Execute the actual navigation controller shipped to the administrator page.
const navigation=fs.readFileSync(require.resolve('../public/js/admin-layout.js'),'utf8');
function harness(saved={},hash=''){
 const nodes=new Map(),store=new Map(Object.entries(saved)),location={hash};
 function element(id,data={}){const classes=new Set();const listeners={};const attributes={};const el={id,dataset:data,textContent:'',tabIndex:0,
  setAttribute(name,value){attributes[name]=String(value);},getAttribute(name){return attributes[name]??null;},focus(){},
  classList:{toggle(name,on){if(on===undefined)on=!classes.has(name);if(on)classes.add(name);else classes.delete(name);},remove(name){classes.delete(name);},add(name){classes.add(name);},contains(name){return classes.has(name);}},
  addEventListener(type,fn){(listeners[type]??=[]).push(fn);},click(){for(const fn of listeners.click||[])fn();}};nodes.set(id,el);return el;}
 const tabs=['home','registration','finance','evaluation','personnel'].map(tab=>{element('tab-'+tab);return element('button-'+tab,{tab});});
 const reg=['student','teacher','subject','classes','auxiliary','academic-years'].map(sub=>{element('sub-'+sub);return element('reg-'+sub,{sub});});
 const evaluation=['marks','course-review','report-cards'].map(sub=>{element('sub-'+sub);return element('eval-'+sub,{sub});});element('panelTitle');
 element('sidebar');element('menuToggle');const window={addEventListener(){}};
 const document={addEventListener(){},getElementById:id=>nodes.get(id),querySelectorAll:selector=>selector==='.sidebar-tab'||selector==='.sidebar-tab[role="tab"]'?tabs:selector==='#tab-registration .reg-subtab'?reg:selector==='#tab-evaluation .reg-subtab'?evaluation:selector==='.reg-subtab'?[...reg,...evaluation]:[]};
 element('adminInfo');element('welcomeMsg');
 const context=vm.createContext({document,window,location,sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},localStorage:{getItem:k=>k==='role'?'admin':'synthetic'},api:async()=>({ok:false})});
 vm.runInContext(navigation,context);
 vm.runInContext(fs.readFileSync(require.resolve('../public/js/admin-core.js'),'utf8'),context);
 return {nodes,store,location};
}
test('evaluation navigation does not clear registration selection or store a registration route',()=>{
 const h=harness({adminTab:'registration',adminSubTab:'teacher'});
 h.nodes.get('button-evaluation').click();h.nodes.get('eval-report-cards').click();
 assert.equal(h.store.get('adminTab'),'evaluation');assert.equal(h.store.get('adminSubTab'),'teacher');
 assert.equal(h.location.hash,'evaluation/report-cards');
 assert.ok(h.nodes.get('sub-report-cards').classList.contains('active'));
 assert.ok(h.nodes.get('sub-teacher').classList.contains('active'));
 h.nodes.get('button-registration').click();assert.ok(h.nodes.get('reg-teacher').classList.contains('active'));
});
test('saved evaluation selection restores after handlers are bound without changing its group',()=>{
 const h=harness({adminTab:'evaluation',evalSubTab:'course-review',adminSubTab:'teacher'});
 assert.ok(h.nodes.get('tab-evaluation').classList.contains('active'));
 assert.ok(h.nodes.get('sub-course-review').classList.contains('active'));
 assert.equal(h.store.get('adminTab'),'evaluation');assert.equal(h.store.get('adminSubTab'),'teacher');
 assert.equal(h.location.hash,'evaluation/course-review');
});


test('a bookmarked report route overrides an unrelated saved tab',()=>{
 const h=harness({adminTab:'home'},'#evaluation/report-cards');
 assert.ok(h.nodes.get('sub-report-cards').classList.contains('active'));
 assert.equal(h.store.get('adminTab'),'evaluation');
});
test('mobile menu opens on one click and closes on the next',()=>{
 const h=harness();h.nodes.get('menuToggle').click();
 assert.ok(h.nodes.get('sidebar').classList.contains('open'));
 h.nodes.get('menuToggle').click();assert.equal(h.nodes.get('sidebar').classList.contains('open'),false);
});
