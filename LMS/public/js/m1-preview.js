'use strict';
const $=id=>document.getElementById(id);
const yearOfferings=Boolean($('year-offerings-enabled'));
const state={csrf:null,identity:null,memberships:[],tab:yearOfferings?'links':'people',data:{},epoch:0};
function element(tag,text,attrs={}){const node=document.createElement(tag);if(text!==null&&text!==undefined)node.textContent=text;for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);return node;}
function message(text,error=false){$('message').textContent=text;$('message').className=error?'error':'';}
async function api(path,{method='GET',body}={}){const response=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(state.csrf?{'X-CSRF-Token':state.csrf}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const payload=response.status===204?{}:await response.json();if(!response.ok){if(response.status===403){state.csrf=null;state.identity=null;state.epoch++;$('workspace').hidden=true;$('account-bar').hidden=true;$('login-view').hidden=false;$('content').replaceChildren();}throw new Error(payload.message||'The request could not be completed');}return payload;}
async function action(operation){document.querySelectorAll('button,select').forEach(node=>node.disabled=true);try{await operation();}catch(error){message(error.message,true);}finally{document.querySelectorAll('button,select').forEach(node=>node.disabled=false);}}
function button(text,handler,small=true){const node=element('button',text,{type:'button',class:small?'small quiet':'quiet'});node.addEventListener('click',()=>action(handler));return node;}
function panel(title){const node=element('section',null,{class:'panel'});node.append(element('h2',title));return node;}
function table(container,headers,rows){if(!rows.length){container.append(element('p','No records to display.',{class:'empty'}));return;}const wrap=element('div',null,{class:'table-wrap'}),grid=element('table'),head=element('tr');for(const label of headers)head.append(element('th',label,{scope:'col'}));const thead=element('thead');thead.append(head);grid.append(thead);const body=element('tbody');for(const row of rows){const tr=element('tr');for(const value of row){const td=element('td');if(value instanceof Node)td.append(value);else td.textContent=String(value??'—');tr.append(td);}body.append(tr);}grid.append(body);wrap.append(grid);container.append(wrap);}
const choices=(rows,label,blank=false)=>[...(blank?[['','None']]:[]),...rows.map(row=>[String(row.id),label(row)])];
function field(name,label,type='text',options={}){return{name,label,type,...options};}
function form(title,fields,onSave,submit='Save'){
    const box=panel(title),node=element('form',null,{class:'form-grid'});
    for(const spec of fields){const label=element('label',spec.label),input=spec.options?element('select'):element('input');input.name=spec.name;
        if(spec.options)for(const[value,text]of spec.options)input.append(element('option',text,{value}));else input.type=spec.type;
        if(spec.required)input.required=true;if(spec.type==='number'){input.step=spec.step??'1';if(spec.min!==undefined)input.min=spec.min;}
        if(spec.value!==undefined){if(spec.type==='checkbox')input.checked=Boolean(spec.value);else input.value=spec.value??'';}
        label.append(input);node.append(label);
    }
    node.append(element('button',submit,{type:'submit'}));node.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
        const payload={};for(const spec of fields){const input=node.elements.namedItem(spec.name);const raw=input.value;
            payload[spec.name]=spec.type==='checkbox'?input.checked:spec.type==='number'?(raw===''?null:Number(raw)):spec.nullable&&raw===''?null:raw;
        }await onSave(payload,node);
    });});box.append(node);return box;
}
const sectionOptions=[['Anglophone','Anglophone'],['Francophone','Francophone']];
function names(row){return[row.firstName,row.middleName,row.lastName].filter(Boolean).join(' ');}
async function bootstrap(){const session=await api('/api/identity/session');state.identity=session.identity;state.csrf=(await api('/api/identity/csrf',{method:'POST',body:{}})).csrfToken;state.memberships=(await api('/api/identity/memberships')).data;
    $('login-view').hidden=true;$('workspace').hidden=false;$('account-bar').hidden=false;
    const select=$('school-switch');select.replaceChildren();for(const membership of state.memberships)select.append(element('option',membership.name,{value:membership.code}));
    const current=state.memberships.find(row=>row.schoolId===state.identity.schoolId);if(!current)throw new Error('No active school membership');select.value=current.code;$('school-title').textContent=current.name;
    const roles=state.identity.roles;$('role-label').textContent=roles.includes('admin')?'SCHOOL ADMINISTRATOR':roles.includes('teacher')?'TEACHER WORKSPACE':'PUPIL WORKSPACE';
    const tabs=roles.includes('admin')?[['people','People'],['setup','Academic setup'],['links','Subject memberships']]:roles.includes('teacher')?[['teaching','My teaching']]:[['subjects','My subjects']];
    if(yearOfferings && roles.includes('admin'))tabs.push(['coverage','Year coverage']);
    if(!tabs.some(([key])=>key===state.tab))state.tab=tabs[0][0];$('tabs').replaceChildren();for(const[key,label]of tabs){const tab=button(label,async()=>{state.tab=key;await load();},false);tab.dataset.tab=key;$('tabs').append(tab);}await load();
}
async function load(){const epoch=++state.epoch;const context=(await api('/api/setup/context')).data;state.data.context=context;$('year-label').textContent=context.currentYear?`Academic year ${context.currentYear.name}`:'No current academic year selected';
    let data={context};if(state.identity.roles.includes('admin')){
        const [students,teachers,years,classes,subjects,offerings]=await Promise.all([api('/api/personnel/students'),api('/api/personnel/teachers'),api('/api/setup/academic-years'),api('/api/setup/classes'),api('/api/setup/subjects'),api('/api/links/offerings')]);
        data={...data,students:students.data,teachers:teachers.data,years:years.data,classes:classes.data,subjects:subjects.data,offerings:offerings.data};
    }if(epoch!==state.epoch)return;state.data=data;document.querySelectorAll('#tabs button').forEach(node=>node.setAttribute('aria-selected',String(node.dataset.tab===state.tab)));$('content').replaceChildren();
    if(state.tab==='people')renderPeople();else if(state.tab==='setup')renderSetup();else if(state.tab==='coverage')await renderCoverage(data);else if(state.tab==='links')await renderLinks();else if(state.tab==='teaching')await renderTeaching();else await renderSubjects();
}
async function renderCoverage(data){
    const box=panel('Year coverage'),detail=element('div'),epoch=state.epoch;
    $('content').append(box);
    if(!data.years.length){box.append(element('p','No academic years recorded.'));return;}
    const label=element('label','Academic year'),select=element('select');
    for(const year of data.years)select.append(element('option',year.name,{value:String(year.id)}));
    if(data.context.currentYear)select.value=String(data.context.currentYear.id);
    label.append(select);box.append(label,detail);
    let generation=0;
    async function review(){
        const request=++generation;
        detail.replaceChildren();
        const report=(await api('/api/setup/academic-years/'+select.value+'/coverage')).data;
        if(state.epoch!==epoch || request!==generation)return;
        detail.append(element('h3',report.yearName),element('p','Counts compare recorded sources. A dated placement can cover part of a year. Paper registers may identify other pupils.'));
        table(detail,['Pupil evidence','Count'],[
            ['Current pupil profiles pointing to this year',report.currentProjectionPupils],
            ['Active pupil profiles pointing to this year',report.activeProjectionPupils],
            ['Placements with an open or future end date',report.unfinishedPlacements],
            ['Pupils on the year membership list',report.yearMemberPupils],
            ['Distinct pupils across year memberships, subject links and marks',report.sourcePupils],
            ['Pupils with a dated placement',report.ledgerPupils],
            ['Source pupils missing a dated placement',report.sourcePupilsWithoutPlacement],
            ['Dated pupils missing a year membership',report.ledgerPupilsWithoutYearMembership],
            ['Subject link rows, including revoked links',report.courseLinkRows],['Mark rows',report.scoreRows],
            ['Pupil and offering pairs missing a placement in that class',report.pupilOfferingsWithoutClassPlacement]]);
        table(detail,['Teaching evidence','Count'],[
            ['Offerings referenced by subject links, marks or teaching assignments',report.usedOfferings],
            ['Referenced offerings missing a year coefficient',report.usedOfferingsWithoutCoefficient],
            ['Assignments recorded for this year',report.yearAssignmentRows],
            ['Teachers on the year membership list',report.yearMemberTeachers],
            ['Assigned teachers missing a year membership',report.assignedTeachersWithoutYearMembership],
            ['Assignments missing an event for their latest version',report.assignmentsWithoutVersionEvent],
            ['Assignments with unknown year across this school',report.schoolUndatedAssignmentRows]]);
        const year=data.years.find(row=>String(row.id)===select.value);
        if(!year || !Object.hasOwn(year,'archivedAt'))return;
        if(year.archivedAt){detail.append(element('p','Archived on '+new Date(year.archivedAt).toISOString().slice(0,10)+' UTC.'));return;}
        if(year.isCurrent){detail.append(element('p','Choose a different current year before archiving this one.'));return;}
        if(report.unfinishedPlacements || report.activeProjectionPupils){
            detail.append(element('p','Review the active pupil profiles and unfinished placements above before archiving.'));return;
        }
        detail.append(element('p','Archiving keeps historical records readable and permanently closes this year to setup changes and placement revisions.'));
        detail.append(form('Archive '+year.name,[field('reason','Reason for archiving','text',{required:true})],async values=>{
            if(state.epoch!==epoch || request!==generation || select.value!==String(year.id))return;
            await api('/api/setup/academic-years/'+year.id+'/archive',{method:'POST',body:{version:year.version,reason:values.reason}});
            if(state.epoch!==epoch || request!==generation)return;
            const years=(await api('/api/setup/academic-years')).data;
            if(state.epoch!==epoch || request!==generation)return;
            data.years=years;message(year.name+' archived.');await review();
        },'Archive year'));
    }
    select.onchange=()=>action(review);
    await review();
}
function renderPeople(){window.location.assign("/registration");}
function setupForm(kind,record=null){const d=state.data;let fields;
    if(kind==='year')fields=[field('name','Year name','text',{value:record?.name}),field('fromYear','From year','number',{required:true,min:1,value:record?.fromYear??2026}),field('toYear','To year','number',{required:true,min:1,value:record?.toYear??2027}),...(!record?[field('isCurrent','Make current','checkbox')]:[])];
    else if(kind==='class')fields=[field('name','Class name','text',{required:true,value:record?.name}),field('section','Section','text',{options:sectionOptions,value:record?.section}),field('stream','Stream','text',{nullable:true,value:record?.stream}),field('rank','Level order','number',{required:true,min:1,value:record?.rank??1}),field('class_master_id','Class master','number',{nullable:true,options:choices(d.teachers.filter(t=>t.status==='active'),names,true),value:record?.class_master_id})];
    else fields=[field('name','Subject name','text',{required:true,value:record?.name}),field('code','Subject code','text',{required:true,value:record?.code}),field('coefficient','Catalogue coefficient','number',{required:true,min:1,value:record?.coefficient??1}),field('hours_per_week','Weekly hours','number',{required:true,min:1,value:record?.hours_per_week??4}),field('class_id','Class reference','number',{nullable:true,options:choices(d.classes,row=>row.name,true),value:record?.class_id}),field('has_lab','Has laboratory work','checkbox',{value:record?.has_lab})];
    const resource=kind==='year'?'academic-years':kind==='class'?'classes':'subjects';return form(`${record?'Edit':'Create'} ${kind==='year'?'academic year':kind}`,fields,async values=>{if(kind==='year'&&!values.name)delete values.name;await api(`/api/setup/${resource}${record?'/'+record.id:''}`,{method:record?'PATCH':'POST',body:{...values,...(record?{version:record.version}:{})}});message('Academic setup saved.');await load();});
}
function renderSetup(){const d=state.data;const editors=element('div');editors.id='setup-editors';editors.append(setupForm('year'),setupForm('class'),setupForm('subject'));$('content').append(editors);
    for(const[kind,title,rows]of[['year','Academic years',d.years],['class','Classes',d.classes],['subject','Subjects',d.subjects]]){const box=panel(title);table(box,['Name','Details','Actions'],rows.map(row=>{if(kind==='year'&&row.archivedAt)return [row.name,'Archived','—'];const actions=element('div');actions.append(button('Edit',async()=>{editors.replaceChildren(setupForm(kind,row));editors.scrollIntoView({behavior:'smooth',block:'start'});}));if(kind==='year'&&!row.isCurrent)actions.append(button('Make current',async()=>{await api(`/api/setup/academic-years/${row.id}/current`,{method:'POST',body:{version:row.version}});message('Current academic year updated.');await load();}));return[row.name,kind==='year'?(row.isCurrent?'Current':`${row.fromYear}–${row.toYear}`):kind==='class'?row.section:row.code,actions];}));$('content').append(box);}
}
async function renderYearPanel(d){
    if(!d.years.length||!d.offerings.length)return;
    const box=panel('Year offerings and teaching history'),detail=element('div'),epoch=state.epoch;
    function selector(label,rows,describe){
        const field=element('label',label),select=element('select');
        for(const row of rows)select.append(element('option',describe(row),{value:String(row.id)}));
        field.append(select);box.append(field);return select;
    }
    const year=selector('Academic year',d.years,y=>y.name);
    const offering=selector('Class and subject',d.offerings,o=>[
        d.classes.find(c=>c.id===o.class_id)?.name,d.subjects.find(s=>s.id===o.subject_id)?.name].join(' · '));
    if(d.context.currentYear)year.value=String(d.context.currentYear.id);
    box.append(detail);$('content').append(box);
    let generation=0;
    async function refresh(){
        const request=++generation,yearId=Number(year.value),offeringId=Number(offering.value);
        detail.replaceChildren();
        const history=(await api(`/api/links/offerings/${offeringId}/years/${yearId}/history`)).data;
        if(request!==generation||epoch!==state.epoch)return;
        const latest=history.revisions.at(-1);
        detail.append(element('p',latest?'Year coefficient: '+latest.coefficient:'Coefficient unconfigured for this year.'));
        if(yearId===d.context.currentYear?.id){
            detail.append(form('Record year coefficient',[field('coefficient','Year coefficient','number',{min:.01,step:'.01',required:true}),
                field('sourceReference','Source reference','text',{required:true})],async values=>{
                if(request!==generation||epoch!==state.epoch)return;
                try{await api('/api/links/year-offerings',{method:'POST',body:{offeringId,yearId,version:latest?.version??0,...values}});}
                catch(error){if(epoch===state.epoch)await refresh();throw error;}
                await refresh();message('Year coefficient recorded.');
            }));
        }
        table(detail,['Revision','Coefficient','Source reference'],history.revisions.map(r=>[r.version,r.coefficient,r.sourceReference]));
        detail.append(element('h3','Recorded teaching changes'));
        if(!history.assignments.length)detail.append(element('p','Earlier or undated teaching assignments may require review.'));
        table(detail,['Teacher','Term','Status','Assignment version','Coefficient revision','Recorded (UTC)'],history.assignments.map(a=>[
            a.teacherName||a.teacherId,a.term,a.status,a.version,a.offeringVersion??'Unconfigured',a.recordedAt]));
    }
    year.onchange=offering.onchange=()=>action(refresh);await refresh();
    return refresh;
}
async function renderLinks(){const d=state.data,box=panel('Class subject offerings');table(box,['Class','Subject',yearOfferings?'Catalogue coefficient':'Coefficient'],d.offerings.map(row=>[d.classes.find(c=>c.id===row.class_id)?.name,d.subjects.find(s=>s.id===row.subject_id)?.name,row.coefficient]));$('content').append(box);
    $('content').append(form('Add a subject offering',[field('classId','Class','number',{options:choices(d.classes,row=>row.name)}),field('subjectId','Subject','number',{options:choices(d.subjects,row=>row.name)}),field('coefficient','Offering coefficient','number',{required:true,value:1,min:.01,step:'.01'})],async values=>{await api('/api/links/offerings',{method:'POST',body:values});message('Offering created.');await load();}));
    const refreshYear=yearOfferings?await renderYearPanel(d):null;
    if(state.data!==d||!d.context.currentYear||!d.offerings.length)return;
    const scope=panel('Manage subject memberships · '+d.context.currentYear.name),offeringSelect=element('select',null,{'aria-label':'Subject offering'});for(const offering of d.offerings)offeringSelect.append(element('option',`${d.classes.find(c=>c.id===offering.class_id)?.name} · ${d.subjects.find(s=>s.id===offering.subject_id)?.name}`,{value:String(offering.id)}));
    scope.append(offeringSelect);const termSelect=element('select',null,{'aria-label':'Teaching term'});for(const term of ['First','Second','Third'])termSelect.append(element('option',term,{value:term}));scope.append(termSelect);const detail=element('div');scope.append(detail);$('content').append(scope);
    async function refreshLinks(){const offeringId=Number(offeringSelect.value),yearId=d.context.currentYear.id,term=termSelect.value;const[enrolments,assignments]=await Promise.all([api(`/api/links/offerings/${offeringId}/enrolments?yearId=${yearId}`),api(`/api/links/offerings/${offeringId}/assignments?yearId=${yearId}&term=${term}`)]);detail.replaceChildren();
        detail.append(form('Enrol a pupil',[field('studentId','Pupil','number',{options:choices(d.students,names)})],async values=>{const existing=enrolments.data.find(row=>row.studentId===values.studentId);await api('/api/links/enrolments',{method:'POST',body:{offeringId,yearId,changes:[{studentId:values.studentId,action:'enrol',version:existing?.version??0}]}});message('Pupil subject membership saved.');await refreshLinks();},'Enrol'));
        table(detail,['Pupil','Membership','Action'],enrolments.data.map(row=>[names(d.students.find(s=>s.id===row.studentId)||{}),row.status,row.status==='active'?button('Revoke',async()=>{await api('/api/links/enrolments',{method:'POST',body:{offeringId,yearId,changes:[{studentId:row.studentId,action:'revoke',version:row.version}]}});message('Subject membership revoked; history retained.');await refreshLinks();}):'—']));
        detail.append(form('Assign a teacher',[field('teacherId','Teacher','number',{options:choices(d.teachers.filter(t=>t.status==='active'),names)})],async values=>{const existing=assignments.data.find(row=>row.teacherId===values.teacherId);await api('/api/links/assignments',{method:'POST',body:{offeringId,yearId,teacherId:values.teacherId,term,action:'assign',version:existing?.version??0}});message('Teaching assignment saved.');await refreshLinks();if(refreshYear)await refreshYear();},'Assign'));
        table(detail,['Teacher',term+' term','Action'],assignments.data.map(row=>[names(d.teachers.find(t=>t.id===row.teacherId)||{}),row.status,row.status==='active'?button('Revoke',async()=>{await api('/api/links/assignments',{method:'POST',body:{offeringId,yearId,teacherId:row.teacherId,term,action:'revoke',version:row.version}});message('Teaching assignment revoked.');await refreshLinks();if(refreshYear)await refreshYear();}):'—']));
    }offeringSelect.addEventListener('change',()=>action(refreshLinks));termSelect.addEventListener('change',()=>action(refreshLinks));await refreshLinks();
}
async function renderTeaching(){const year=state.data.context.currentYear;if(!year){$('content').append(panel('No current academic year'));return;}
    const scope=panel('My teaching assignments'),select=element('select',null,{'aria-label':'Teaching term'});for(const term of ['First','Second','Third'])select.append(element('option',term,{value:term}));scope.append(select);const detail=element('div');scope.append(detail);$('content').append(scope);
    async function show(){const assignments=(await api(`/api/links/my-assignments?yearId=${year.id}&term=${select.value}`)).data;detail.replaceChildren();table(detail,['Class','Subject','Roster'],assignments.map(row=>[row.className,row.subjectName,button('View roster',async()=>{const rows=(await api(`/api/links/offerings/${row.offeringId}/roster?yearId=${year.id}&term=${select.value}`)).data;const box=panel(`${row.className} · ${row.subjectName}`);table(box,['Pupil','Matricule'],rows.map(pupil=>[names(pupil),pupil.matricule]));detail.querySelector('.roster')?.remove();box.classList.add('roster');detail.append(box);})]));}select.addEventListener('change',()=>action(show));await show();
}
async function renderSubjects(){const year=state.data.context.currentYear,box=panel('My subject memberships');if(year){const rows=(await api(`/api/links/my-enrolments?yearId=${year.id}`)).data;table(box,['Class','Subject','Membership'],rows.map(row=>[row.className,row.subjectName,row.status]));}$('content').append(box);}
$('school-switch').addEventListener('change',()=>action(async()=>{const schoolCode=$('school-switch').value;state.epoch++;state.data={};$('content').replaceChildren();$('workspace').hidden=true;const session=await api('/api/identity/switch-school',{method:'POST',body:{schoolCode}});state.csrf=session.csrfToken;await bootstrap();message('School switched.');}));
$('logout').addEventListener('click',()=>action(async()=>{await api('/api/identity/logout',{method:'POST',body:{}});state.csrf=null;state.identity=null;state.epoch++;$('workspace').hidden=true;$('account-bar').hidden=true;$('login-view').hidden=false;$('content').replaceChildren();message('Signed out.');}));
$('refresh').addEventListener('click',()=>action(load));
$('login-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{const values=Object.fromEntries(new FormData(event.target));const payload=values.accountType==='admin'?{loginKey:values.identifier,password:values.password,schoolCode:values.schoolCode}:values;state.csrf=(await api('/api/identity/login',{method:'POST',body:payload})).csrfToken;event.target.reset();await bootstrap();message('Signed in.');});});
(async()=>{try{const catalog=await api('/preview/catalog');for(const school of catalog.schools){const box=element('div',null,{class:'sample-school'});box.append(element('h3',school.name));for(const account of catalog.accounts.filter(row=>row.schoolCode===school.code)){box.append(button(account.role==='admin'?'Use sample administrator':account.role==='teacher'?'Use sample teacher':'Use sample pupil',async()=>{state.csrf=(await api('/preview/sign-in',{method:'POST',body:{schoolCode:account.schoolCode,role:account.role}})).csrfToken;await bootstrap();message('Sample account signed in.');}));}$('sample-accounts').append(box);}try{await bootstrap();}catch{state.csrf=null;}}catch(error){message(error.message,true);}})();
