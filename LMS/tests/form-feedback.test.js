const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync(require.resolve('../public/js/form-feedback.js'),'utf8');
function harness(){
 const handlers={},tasks=[],nodes=[];
 class Element{
  constructor(){this.attrs=new Map();this.children=[];this.classes=new Set();this.isConnected=true;this.listeners={};nodes.push(this);}
  get classList(){return {contains:n=>this.classes.has(n),add:n=>this.classes.add(n),remove:n=>this.classes.delete(n)};}
  getAttribute(n){return this.attrs.get(n)??null;} setAttribute(n,v){this.attrs.set(n,v);} removeAttribute(n){this.attrs.delete(n);}
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
  prepend(item){item.parent=this;this.children.unshift(item);} replaceChildren(...items){this.children=[];this.append(...items);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);this.isConnected=false;}
  closest(){return this.label;} after(item){this.parent.append(item);} focus(){this.focused=true;}
  addEventListener(name,fn){this.listeners[name]=fn;}
 }
 const body=new Element();body.classes.add('lms-ui');const form=new Element();
 const document={body,getElementById:id=>nodes.find(n=>n.id===id),createElement:()=>new Element(),addEventListener:(name,fn)=>handlers[name]=fn};
 vm.runInNewContext(script,{document,queueMicrotask:fn=>tasks.push(fn)});
 function field(name){const field=new Element(),label=new Element();label.childNodes=[{nodeType:3,textContent:name}];label.append(field);form.append(label);
  Object.assign(field,{form,label,labels:[label],willValidate:true,validity:{valid:false},validationMessage:'Please fill in this field.'});
  Object.defineProperty(field,'value',{get(){throw Error('Feedback must not read a draft or credential');},set(){throw Error('Feedback must not change a draft or credential');}});return field;}
 return {form,field,handlers,flush(){while(tasks.length)tasks.shift()();},fire(name,target){handlers[name]({target,preventDefault(){throw Error('Native validation must remain enabled');}});}};
}
test('native errors are linked without cancelling validation or reading field values',()=>{
 const h=harness(),first=h.field('First name'),email=h.field('Email');first.setAttribute('aria-describedby','existing-help');
 h.fire('invalid',first);h.fire('invalid',email);h.flush();
 assert.equal(h.form.children[0].children[0].textContent,'Please check 2 fields before continuing.');
 assert.match(first.getAttribute('aria-describedby'),/^existing-help lms-field-error-/);assert.equal(first.getAttribute('aria-invalid'),'true');
 const link=h.form.children[0].children[1].children[1].children[0];let prevented=false;link.listeners.click({preventDefault(){prevented=true;}});
 assert.ok(prevented&&email.focused);assert.match(link.textContent,/^Email:/);
 assert.deepEqual(Object.keys(h.handlers).sort(),['change','input','invalid','reset']);
});
test('correcting a field removes only its own error and retains other invalid fields',()=>{
 const h=harness(),first=h.field('First name'),email=h.field('Email');first.setAttribute('aria-describedby','existing-help');
 h.fire('invalid',first);h.fire('invalid',email);h.flush();first.validity.valid=true;h.fire('input',first);
 assert.equal(first.getAttribute('aria-invalid'),null);assert.equal(first.getAttribute('aria-describedby'),'existing-help');
 assert.equal(h.form.children[0].children[0].textContent,'Please check 1 field before continuing.');
 email.validity.valid=true;h.fire('change',email);assert.equal(h.form.children.length,2);assert.equal(email.label.children.length,1);
});
test('reset restores existing accessibility state and removes feedback',()=>{
 const h=harness(),field=h.field('Name');field.setAttribute('aria-invalid','false');field.setAttribute('aria-describedby','help');
 h.fire('invalid',field);h.flush();h.fire('reset',h.form);
 assert.equal(field.getAttribute('aria-invalid'),'false');assert.equal(field.getAttribute('aria-describedby'),'help');assert.equal(h.form.children.length,1);
});
test('disabled or removed fields no longer appear in the error summary',()=>{
 const h=harness(),first=h.field('Name'),second=h.field('Email');h.fire('invalid',first);h.fire('invalid',second);h.flush();
 first.willValidate=false;second.isConnected=false;h.fire('input',second);assert.equal(h.form.children.length,2);
 assert.equal(first.getAttribute('aria-invalid'),null);assert.equal(second.getAttribute('aria-invalid'),null);
});
