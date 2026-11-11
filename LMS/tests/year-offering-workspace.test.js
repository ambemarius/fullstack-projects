const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

test('year coverage clears old figures before loading and ignores a response after a school switch',async()=>{
    const source=fs.readFileSync(require.resolve('../public/js/m1-preview.js'),'utf8');
    const elements=[],requests=[],tables=[];
    function element(tag,text){
        const node={tag,text,children:[],append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}};
        elements.push(node);return node;
    }
    const content=element('main'),state={epoch:1};
    const context=vm.createContext({element,state,panel:title=>element('section',title),$:()=>content,
        action:operation=>operation(),table:(_target,headers,rows)=>tables.push({headers,rows}),
        api:path=>new Promise(resolve=>requests.push({path,resolve}))});
    vm.runInContext(source.slice(source.indexOf('async function renderCoverage'),source.indexOf('function renderPeople')),context);
    const initial=context.renderCoverage({years:[{id:1,name:'Previous'},{id:2,name:'Current'}],context:{currentYear:{id:2}}});
    assert.equal(requests[0].path,'/api/setup/academic-years/2/coverage');
    requests[0].resolve({data:{yearName:'Current',sourcePupilsWithoutPlacement:3}});await initial;
    assert.equal(tables[0].rows.find(([label])=>label==='Source pupils missing a dated placement')[1],3);
    const select=elements.find(node=>node.tag==='select'),detail=elements.find(node=>node.tag==='div');
    select.value='1';const previous=select.onchange();assert.equal(detail.children.length,0);
    assert.equal(requests[1].path,'/api/setup/academic-years/1/coverage');
    state.epoch++;requests[1].resolve({data:{yearName:'Previous'}});await previous;
    assert.equal(detail.children.length,0);assert.equal(tables.length,2);
});

test('archive form is scoped to a reviewed eligible year and displays its receipt after saving',async()=>{
    const source=fs.readFileSync(require.resolve('../public/js/m1-preview.js'),'utf8');
    const state={epoch:1},forms=[],writes=[],nodes=[];
    function element(tag,text,attrs={}){
        const node={tag,text,value:attrs.value,append(){},replaceChildren(){}};
        nodes.push(node);return node;
    }
    const current={id:2,name:'Current',version:1,isCurrent:true,archivedAt:null};
    const old={id:1,name:'Previous',version:4,isCurrent:false,archivedAt:null};
    let blocked=true,archived=false;
    const context=vm.createContext({state,element,panel:title=>element('section',title),$:()=>element('main'),action:op=>op(),table(){},message(){},
        field:()=>({}),form:(title,fields,save)=>{forms.push({title,save});return element('form');},
        api:async(path,opts)=>{
            if(opts){writes.push({path,...opts});archived=true;return {};}
            if(path==='/api/setup/academic-years')return {data:[{...old,archivedAt:archived?'2026-11-05T12:00:00Z':null},current]};
            return {data:{yearName:'Reviewed year',unfinishedPlacements:blocked?1:0,activeProjectionPupils:0}};
        }});
    vm.runInContext(source.slice(source.indexOf('async function renderCoverage'),source.indexOf('function renderPeople')),context);
    await context.renderCoverage({years:[old,current],context:{currentYear:current}});
    const select=nodes.find(n=>n.tag==='select');
    select.value='1';await select.onchange();assert.equal(forms.length,0);
    blocked=false;await select.onchange();const stale=forms[0];
    select.value='2';await select.onchange();await stale.save({reason:'Wrong year'});assert.equal(writes.length,0);
    select.value='1';await select.onchange();await forms.at(-1).save({reason:'Closing register'});
    assert.deepEqual(JSON.parse(JSON.stringify(writes)),[{path:'/api/setup/academic-years/1/archive',method:'POST',body:{version:4,reason:'Closing register'}}]);
    assert.ok(nodes.some(n=>n.text==='Archived on 2026-11-05 UTC.'));assert.equal(forms.length,2);
});

test('year workspace submits the reviewed year revision and keeps archived coefficients read-only',async()=>{
    const source=fs.readFileSync(require.resolve('../public/js/m1-preview.js'),'utf8');
    const elements=[],forms=[],writes=[],tables=[];
    function element(tag,text){
        const e={tag,text,children:[],value:'',append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}};
        elements.push(e);return e;
    }
    const data={years:[{id:1,name:'Previous'},{id:2,name:'Current'}],context:{currentYear:{id:2}},
        offerings:[{id:3,class_id:4,subject_id:5,coefficient:9}],classes:[{id:4,name:'Class'}],subjects:[{id:5,name:'Subject'}]};
    const state={epoch:1},content=element('main');
    const context=vm.createContext({element,panel:title=>element('section',title),state,$:()=>content,
        form:(title,fields,save)=>{forms.push({fields,save});return element('form',title);},field:(name,label,type,options)=>({name,...options}),
        table:(_box,headers,rows)=>tables.push({headers,rows}),action:work=>work(),message:()=>{},
        api:async(path,options)=>{
            if(options){writes.push(options.body);return {};}
            const current=path.includes('/years/2/');return {data:{revisions:current?[{version:2,coefficient:1.25,sourceReference:'Current register'}]:[],assignments:[]}};
        }});
    vm.runInContext(source.slice(source.indexOf('async function renderYearPanel'),source.indexOf('async function renderLinks')),context);
    // Native selects initially select the first option; provide that behavior for this small fixture.
    const original=element;context.element=(tag,text,attrs)=>{const e=original(tag,text);if(attrs?.value)e.value=attrs.value;
        if(tag==='select')e.append=function(child){this.children.push(child);if(!this.value)this.value=child.value;};return e;};
    await context.renderYearPanel(data);
    assert.equal(forms.length,1);assert.equal(forms[0].fields[0].value,undefined);
    await forms[0].save({coefficient:2.75,sourceReference:'Year plan'});
    assert.deepEqual(JSON.parse(JSON.stringify(writes)),[{offeringId:3,yearId:2,version:2,coefficient:2.75,sourceReference:'Year plan'}]);
    const year=elements.find(e=>e.tag==='select');year.value='1';const count=forms.length;await year.onchange();
    assert.equal(forms.length,count);assert.ok(elements.some(e=>e.text==='Coefficient unconfigured for this year.'));
    await forms[0].save({coefficient:8,sourceReference:'Stale form'});assert.equal(writes.length,1);
});
