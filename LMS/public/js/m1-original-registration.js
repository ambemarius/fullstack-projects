'use strict';
const byId=id=>document.getElementById(id),model={csrf:null,identity:null,kind:'student',edits:{},selected:{},offset:{student:0,teacher:0},rows:{student:[],teacher:[]},epoch:0};
const ledgerEnabled=document.body?.dataset.enrolmentLedger==='true';
const transferEnabled=ledgerEnabled&&Boolean(document.querySelector?.('#transferForm'));
const lifecycleEnabled=ledgerEnabled&&Boolean(document.querySelector?.('#pupilStatusForm'));
const sourcePanel=document.querySelector?.('#sourceReview');
const placementPanel=document.querySelector?.('#placementReview');
let placementRequest=0;
function clearPlacementReview(){
    if(!placementPanel)return;
    ++placementRequest;placementPanel.open=false;
    byId('placementReviewRows').replaceChildren();byId('placementReviewMessage').textContent='';
    byId('placementReviewNext').hidden=true;byId('placementReviewNext').onclick=null;
}
async function loadPlacementReview(after){
    const version=++placementRequest,epoch=model.epoch,year=model.years?.find(row=>row.isCurrent);
    const output=byId('placementReviewRows'),notice=byId('placementReviewMessage'),more=byId('placementReviewNext');
    output.replaceChildren();more.hidden=true;more.onclick=null;
    if(!year){notice.textContent='Select a current year in Academic setup first.';return;}
    notice.textContent='Loading pupil profiles…';
    try{
        const params=new URLSearchParams({yearId:String(year.id)});
        if(after)params.set('afterStudentId',String(after));
        const {data}=await api('/api/academic-history/placement-review?'+params);
        if(version!==placementRequest||epoch!==model.epoch||!placementPanel.open)return;
        notice.textContent=data.pupils.length?'Current year: '+data.yearName:'Every active pupil profile has a class and points to '+data.yearName+'.';
        if(!data.pupils.length){if(after)notice.textContent='End of the review list.';return;}
        const rows=data.pupils.map(p=>[
            [p.firstName,p.middleName,p.lastName].filter(Boolean).join(' '),p.matricule,
            p.profileClass??'Missing class',p.profileYear??'Missing year',
            ()=>{const button=node('button','Academic records',{type:'button',class:'reg-btn reg-btn-gray'});
                button.onclick=()=>openSourceReview('student',p,button);return button;}
        ]);
        evidenceTable(output,'Pupils to review',['Pupil','Matricule','Class on profile','Year on profile','Review'],rows);
        if(data.nextAfterStudentId!==null){more.hidden=false;more.onclick=()=>loadPlacementReview(data.nextAfterStudentId);}
    }catch(error){if(version===placementRequest&&epoch===model.epoch)notice.textContent=error.message;}
}
let sourcePerson=null,sourceRequest=0;
function closeSourceReview(){
    if(!sourcePanel)return;
    ++sourceRequest;sourcePerson=null;sourcePanel.hidden=true;
    byId('sourceReviewTitle').textContent='';byId('sourceReviewResults').replaceChildren();
    byId('sourceReviewYear').replaceChildren();
}
function evidenceTable(container,title,headers,rows){
    container.append(node('h4',title));
    if(!rows.length){container.append(node('p','No matching records.'));return;}
    const wrap=node('div',null,{class:'reg-table-wrap'}),table=node('table',null,{class:'reg-table'});
    const head=node('thead',null),labels=node('tr',null),body=node('tbody',null);
    for(const label of headers)labels.append(node('th',label,{scope:'col'}));
    head.append(labels);
    for(const values of rows){const tr=node('tr',null);for(const value of values){
        if(typeof value==='function'){const cell=node('td',null);cell.append(value());tr.append(cell);}
        else tr.append(node('td',value??'—'));
    }body.append(tr);}
    table.append(head,body);wrap.append(table);container.append(wrap);
}
async function readSourceYear(){
    const person=sourcePerson,request=++sourceRequest,epoch=model.epoch;
    const year=byId('sourceReviewYear').value,box=byId('sourceReviewResults');
    box.replaceChildren();if(!person||!year)return;
    try{
        const {data}=await api('/api/academic-history/'+resource(person.kind)+'/'+person.id+'?yearId='+encodeURIComponent(year));
        if(epoch!==model.epoch||sourceRequest!==request)return;
        if(person.kind==='student'){
            box.append(node('p',data.yearMembershipRecorded?'Listed in the year membership register.':'No year membership entry found.'));
            const candidates=data.placement.candidateClassIds.map(id=>model.classes.find(c=>c.id===id)?.name??('Class '+id));
            box.append(node('p',candidates.length?'Classes referenced by subject or mark records: '+candidates.join(', ')+'. Confirm dated placements against the register.':'Subject and mark records provide no class reference for this year.'));
            evidenceTable(box,'Subject memberships',['Class','Subject','Status'],data.subjectLinks.map(r=>[r.className,r.subjectName,r.sourceStatus]));
            evidenceTable(box,'Mark references',['Class','Subject','Term','Sequence'],data.scoreReferences.map(r=>[r.className,r.subjectName,r.term,r.sequence]));
        }else{
            for(const [title,rows] of [['Assignments for '+data.yearName,data.assignments],['Assignments with no recorded year',data.unresolvedYearAssignments]]){
                evidenceTable(box,title,['Class','Subject','Term','Status'],rows.map(r=>[r.className,r.subjectName,r.term,r.sourceStatus]));
            }
        }
    }catch(error){if(epoch===model.epoch&&request===sourceRequest)box.textContent=error.message;else if(error.status===403)say(error.message,true);}
}
function openSourceReview(kind,row,button){
    closeSourceReview();sourcePerson={id:row.id,kind};
    const years=model.years,selected=years.find(y=>y.isCurrent)??years[0];
    options(byId('sourceReviewYear'),years,selected?.id);
    byId('sourceReviewYear').onchange=readSourceYear;
    byId('sourceReviewClose').onclick=()=>{closeSourceReview();button.focus();};
    byId('sourceReviewTitle').textContent='Academic records — '+[row.firstName,row.middleName,row.lastName].filter(Boolean).join(' ');
    sourcePanel.hidden=false;byId('sourceReviewTitle').focus();
    if(!selected){byId('sourceReviewResults').textContent='No academic years recorded for this school.';return;}
    return readSourceYear();
}
function clearPupilStatus(){
    if(!lifecycleEnabled)return;
    model.statusDraft=null;
    byId('pupilStatusForm').reset();byId('returnClass').replaceChildren();
    byId('confirmReturnCourses').checked=false;byId('confirmReturnCourses').required=false;
    byId('returnCourseLabel').hidden=true;byId('returnCourseNotice').textContent='';
    byId('pupilStatusPanel').open=false;byId('pupilStatusPanel').hidden=true;
    byId('pupilStatusTitle').textContent='';byId('pupilStatusNotice').textContent='';
}
function offerPupilStatus(row,history){
    if(!lifecycleEnabled)return;
    const returning=Boolean(row.isWithdrawn);
    const latest=history.filter(record=>record.isLatest);
    const sources=returning ? latest.filter(r=>r.status==='withdrawn'&&r.toDate).sort((a,b)=>b.toDate.localeCompare(a.toDate))
        : latest.filter(r=>r.status==='enrolled'&&r.toDate===null);
    if(!sources.length||(!returning&&sources.length!==1))return;
    const source=sources[0];
    const draft={root:source.id,version:source.version,profileVersion:row.version,returning,epoch:model.epoch};
    let notice='The effective date is the first day outside this placement. Recording a withdrawal ends this pupil’s sign-in access at this school immediately.';
    if(returning){
        const years=model.years.filter(y=>y.isCurrent),rooms=model.classes.filter(c=>c.section===row.section);
        if(years.length!==1||!rooms.length)return;
        draft.yearId=years[0].id;options(byId('returnClass'),rooms);
        notice=`Choose the verified placement for ${years[0].name}. The pupil can sign in again using their existing password after the return is recorded.`;
    }
    model.statusDraft=draft;
    byId('returnClassLabel').hidden=!returning;byId('returnClass').required=returning;byId('returnClass').disabled=!returning;
    const title=returning?'Record return':'Record withdrawal';
    byId('pupilStatusTitle').textContent=title;byId('recordPupilStatus').textContent=title;
    byId('pupilStatusNotice').textContent=notice;byId('pupilStatusPanel').hidden=false;
}
async function reviewReturnCourses(){
    const draft=model.statusDraft;
    if(!draft?.returning)return;
    const classId=Number(byId('returnClass').value),generation=(draft.generation??0)+1;
    draft.generation=generation;draft.review=null;
    byId('confirmReturnCourses').checked=false;byId('confirmReturnCourses').required=false;
    byId('returnCourseLabel').hidden=true;byId('returnCourseNotice').textContent='';
    if(!classId)return;
    const query=new URLSearchParams({version:draft.version,profileVersion:draft.profileVersion,classId,yearId:draft.yearId});
    try{
        const {data}=await api(`/api/pupil-placements/${draft.root}/return-courses?${query}`);
        if(draft!==model.statusDraft||generation!==draft.generation)return;
        draft.review={classId,links:data.map(({id,version})=>({id,version}))};
        byId('returnCourseNotice').textContent=data.length?'Subjects that will resume: '+data.map(c=>c.name).join(', '):'No active subjects in this placement.';
        byId('returnCourseLabel').hidden=!data.length;byId('confirmReturnCourses').required=Boolean(data.length);
    }catch(error){if(draft===model.statusDraft&&generation===draft.generation)say(error.message,true);}
}
async function submitPupilStatus(){
    const draft=model.statusDraft;
    if(!draft||draft.epoch!==model.epoch)throw new Error('Reopen pupil history before recording a change.');
    const body={version:draft.version,profileVersion:draft.profileVersion,onDate:byId('statusDate').value,
        sourceReference:byId('statusSource').value.trim(),reason:byId('statusReason').value.trim()};
    if(draft.returning){
        body.classId=Number(byId('returnClass').value);body.yearId=draft.yearId;
        if(!draft.review||draft.review.classId!==body.classId||(draft.review.links.length&&!byId('confirmReturnCourses').checked))
            throw new Error('Review the subjects for the selected class before recording the return.');
        body.reviewedCourses=draft.review.links;
    }
    await submitPlacementChange(draft,body,draft.returning?'returns':'withdrawals',draft.returning?'Return recorded.':'Withdrawal recorded.');
}
function clearTransfer(){
    if(!transferEnabled)return;
    model.transfer=null;byId('transferPanel').hidden=true;byId('transferPanel').open=false;
    byId('transferForm').reset();byId('transferClass').replaceChildren();byId('transferContext').textContent='';
}
function clearHistory(){if(!ledgerEnabled)return;clearTransfer();clearPupilStatus();model.historyRequest=(model.historyRequest||0)+1;byId('enrolmentHistoryBody').replaceChildren();byId('enrolmentCoverage').textContent='';byId('enrolmentHistoryTitle').textContent='Enrolment history';byId('enrolmentHistory').hidden=true;}
function offerTransfer(row,history){
    if(!transferEnabled||row.isWithdrawn)return;
    const open=history.filter(r=>r.isLatest&&r.status==='enrolled'&&r.toDate===null);
    const current=model.years.filter(y=>y.isCurrent);
    if(open.length!==1||current.length!==1)return;
    const source=open[0],year=current[0],room=model.classes.find(c=>c.id===source.classId);
    const choices=model.classes.filter(c=>c.section===row.section&&(c.id!==source.classId||year.id!==source.yearId));
    if(!room||!choices.length)return;
    model.transfer={pupilId:row.id,profileVersion:row.version,root:source.id,version:source.version,yearId:year.id,epoch:model.epoch};
    byId('transferContext').textContent=`Current ledger placement: ${room.name}, ${model.years.find(y=>y.id===source.yearId)?.name||source.yearId}. Destination academic year: ${year.name}.`;
    options(byId('transferClass'),choices);byId('transferPanel').hidden=false;
}
async function submitTransfer(){
    const t=model.transfer;
    if(!t||t.epoch!==model.epoch)throw new Error('Reopen the pupil’s history before recording a transfer.');
    const input={version:t.version,profileVersion:t.profileVersion,yearId:t.yearId,classId:Number(byId('transferClass').value),
        onDate:byId('transferDate').value,sourceReference:byId('transferSource').value.trim(),reason:byId('transferReason').value.trim()};
    await submitPlacementChange(t,input,'transfers','Transfer recorded.');
}
async function submitPlacementChange(t,input,path,success){
    let result;
    try{result=(await api(`/api/pupil-placements/${t.root}/${path}`,{method:'POST',body:input})).data;}
    catch(error){
        if(error.status===409&&model.epoch===t.epoch){clearHistory();await load('student');throw new Error(error.message+'. Reopen the pupil’s history to review the current record.');}
        throw error;
    }
    if(model.epoch!==t.epoch)return;
    clearHistory();say(success);
    try{
        await load('student');if(model.epoch!==t.epoch)return;
        const row=model.rows.student.find(r=>r.id===result.pupil.id);
        if(row)await showEnrolmentHistory(row);
    }catch(error){throw new Error(success+' Reload to see the updated history.');}
}
function enrolmentFields(editing){if(!ledgerEnabled)return;byId('initialEnrolmentFields').hidden=editing;for(const id of ['sEnrolmentFrom','sEnrolmentSource','sEnrolmentReason']){byId(id).disabled=editing;byId(id).required=!editing;}byId('sAcademicYear').required=true;byId('sClass').required=true;}
async function showEnrolmentHistory(row){
    clearHistory();const epoch=model.epoch,request=model.historyRequest;
    const rows=(await api(`/api/enrolments/students/${row.id}/history`)).data;
    if(epoch!==model.epoch||request!==model.historyRequest)return;
    byId('enrolmentHistoryTitle').textContent=`Enrolment history — ${[row.firstName,row.middleName,row.lastName].filter(Boolean).join(' ')}`;
    byId('enrolmentCoverage').textContent=rows.length?'Recorded enrolments only. Earlier revisions are retained; missing legacy history is not reconstructed automatically.':'No verified enrolment has been recorded. This does not mean the pupil has no historical enrolments.';
    for(const record of rows){const tr=node('tr',null);const room=model.classes?.find(item=>item.id===record.classId),year=model.years?.find(item=>item.id===record.yearId);
        for(const text of [`${record.id} / ${record.version}${record.isLatest?' · latest':''}`,`${room?.name||record.classId} / ${year?.name||record.yearId}`,record.fromDate,record.toDate||'Open',record.status,`${record.sourceReference} — ${record.reason}`])tr.append(node('td',text));
        byId('enrolmentHistoryBody').append(tr);
    }
    offerTransfer(row,rows);offerPupilStatus(row,rows);byId('enrolmentHistory').hidden=false;byId('enrolmentHistoryTitle').focus();byId('enrolmentHistory').scrollIntoView({behavior:'smooth',block:'start'});
}
const fields={student:{firstName:'sFirstName',middleName:'sMiddleName',lastName:'sLastName',sex:'sSex',dateOfBirth:'sDob',placeOfBirth:'sPlaceOfBirth',regionOfOrigin:'sRegion',division:'sDivision',address:'sAddress',section:'sSection',matricule:'sMatricule',parentName:'sParentName',parentPhone:'sParentPhone',parentPhone2:'sParentPhone2'},
teacher:{firstName:'tFirstName',middleName:'tMiddleName',lastName:'tLastName',email:'tEmail',phone:'tPhone',gender:'tGender',civilStatus:'tCivilStatus',noOfChildren:'tNoOfChildren',address:'tAddress',section:'tSection',employmentType:'tEmpType',idCardNo:'tIdCard',dateOfIssue:'tDateOfIssue',matriculeFile:'tMatriculeFile',telephone:'tTelephone',secondaryContactName:'tSecContactName',secondaryContactPhone:'tSecContactPhone'}};
const resource=kind=>kind==='student'?'students':'teachers';
function node(tag,text,attrs={}){const e=document.createElement(tag);if(text!==null)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
function say(text,bad=false){byId('workspaceMessage').textContent=text;byId('workspaceMessage').className=bad?'error':'';}
function lockout(){model.csrf=null;model.identity=null;model.epoch++;clearHistory();closeSourceReview();clearPlacementReview();document.querySelectorAll('form').forEach(form=>form.reset());byId('registrationWorkspace').hidden=true;byId('signInNotice').hidden=false;model.edits={};model.selected={};model.rows={student:[],teacher:[]};for(const id of ['studentTableBody','teacherTableBody'])byId(id).replaceChildren();}
async function api(path,options={}){const response=await fetch(path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(model.csrf?{'X-CSRF-Token':model.csrf}:{}),...options.headers},...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});const body=response.status===204?{}:await response.json();if(!response.ok){if(response.status===403)lockout();throw Object.assign(new Error(body.message||'Request failed'),{status:response.status});}return body;}
let pending=false;async function run(work){if(pending)return;pending=true;document.querySelectorAll('button,#schoolSwitch').forEach(e=>e.disabled=true);try{await work();}catch(error){say(error.message,true);}finally{pending=false;document.querySelectorAll('button,#schoolSwitch').forEach(e=>e.disabled=false);}}
function options(select,items,selected=''){select.replaceChildren(node('option','-- select --',{value:''}));for(const item of items)select.append(node('option',item.name,{value:String(item.id)}));select.value=String(selected??'');}
function reset(kind){byId(kind+'Form').reset();delete model.edits[kind];delete model.selected[kind];byId(kind+'EditId').value='';byId(kind+'HeaderBar').textContent=kind==='student'?'Register New Student':'Register New Teacher';byId(kind+'SubmitBtn').textContent=kind==='student'?'Register Student':'Create Teacher';
    if(kind==='student'){enrolmentFields(false);clearHistory();}
    const password=byId(kind==='student'?'sPassword':'tPassword');password.required=true;password.disabled=false;password.placeholder='At least 12 characters';if(kind==='student'){byId('sAcademicYear').disabled=false;byId('sClass').disabled=false;byId('sRegion').value='';byId('sDivision').replaceChildren(node('option','-- select region first --',{value:''}));}else byId('tNoOfChildren').value='';}
function show(kind){closeSourceReview();clearPlacementReview();if(placementPanel)placementPanel.hidden=kind!=='student';model.kind=kind;document.querySelectorAll('[data-kind]').forEach(e=>{e.classList.toggle('active',e.dataset.kind===kind);e.setAttribute('aria-pressed',String(e.dataset.kind===kind));});byId('sub-student').classList.toggle('active',kind==='student');byId('sub-teacher').classList.toggle('active',kind==='teacher');}
function lookupSelect(id,value){const select=byId(id);if(value&&!Array.from(select.options).some(option=>option.value===String(value)))select.append(node('option',String(value),{value:String(value)}));select.value=value??'';}
async function edit(kind,id){const row=(await api(`/api/personnel/${resource(kind)}/${id}/edit-profile`)).data;reset(kind);model.edits[kind]=row;model.selected[kind]=id;byId(kind+'EditId').value=String(id);
    for(const[key,control]of Object.entries(fields[kind])){const value=row[key];if(key==='regionOfOrigin'||key==='division')continue;byId(control).value=value===null||value===undefined?'':key==='dateOfBirth'||key==='dateOfIssue'?String(value).slice(0,10):String(value);}
    if(kind==='student'){enrolmentFields(true);const region=model.regions.find(item=>item.name===row.regionOfOrigin);if(region){byId('sRegion').value=String(region.id);await divisions(region.id,row.division);}else lookupSelect('sRegion',row.regionOfOrigin);byId('sAcademicYear').value=String(row.academicYearId??'');byId('sClass').value=String(row.currentClassLevel??'');byId('sAcademicYear').disabled=true;byId('sClass').disabled=true;}
    else byId('tStatus').value=row.status;
    const password=byId(kind==='student'?'sPassword':'tPassword');password.required=false;password.disabled=true;password.placeholder='Use account recovery to change passwords';byId(kind+'HeaderBar').textContent=kind==='student'?'Edit Student':'Edit Teacher';byId(kind+'SubmitBtn').textContent='Save Changes';byId(kind+'Form').scrollIntoView({behavior:'smooth',block:'start'});}
async function status(kind,row){const active=kind==='student'?!row.isWithdrawn:row.status==='active';await api(`/api/personnel/${resource(kind)}/${row.id}/status`,{method:'POST',body:{version:row.version,status:active?(kind==='student'?'withdrawn':'suspended'):'active',reason:active?'administrative':'return_to_school'}});say('Status updated; records retained.');await load(kind);}
async function load(kind){const epoch=model.epoch,search=byId(kind==='student'?'studentSearch':'teacherSearch').value;const result=await api(`/api/personnel/${resource(kind)}?search=${encodeURIComponent(search)}&limit=25&offset=${model.offset[kind]}`);if(epoch!==model.epoch)return;
    model.rows[kind]=result.data;const body=byId(kind==='student'?'studentTableBody':'teacherTableBody');body.replaceChildren();
    for(const row of result.data){const tr=node('tr',null);tr.addEventListener('click',()=>{model.selected[kind]=row.id;Array.from(body.children).forEach(other=>other.classList.toggle('selected',other===tr));});const name=[row.firstName,row.middleName,row.lastName].filter(Boolean).join(' ');
        const values=kind==='student'?[row.matricule,name,'—','Open record','Open record','Open record','Open record','Open record','Open record','Open record','Open record','Open record','Restricted']:
            [name,row.email,'Open record',row.section,row.employmentType,row.status];
        // Teacher table follows the original column structure; basic row fields remain minimal.
        const actual=kind==='teacher'?[name,row.email,'Open record',row.section,row.employmentType,row.status]:values;
        for(const value of actual)tr.append(node('td',value));const actions=node('td',null);const editButton=node('button','Edit',{type:'button',class:'reg-btn reg-btn-blue'});editButton.onclick=event=>{event.stopPropagation();run(()=>edit(kind,row.id));};actions.append(editButton);
        if(sourcePanel){const review=node('button','Academic records',{type:'button',class:'reg-btn reg-btn-gray'});review.onclick=event=>{event.stopPropagation();openSourceReview(kind,row,review);};actions.append(review);}
        if(kind==='student'&&ledgerEnabled){const view=node('button','History',{type:'button',class:'reg-btn reg-btn-gray'});view.onclick=event=>{event.stopPropagation();run(()=>showEnrolmentHistory(row));};actions.append(view);}
        else{const active=kind==='student'?!row.isWithdrawn:row.status==='active';const change=node('button',active?(kind==='student'?'Withdraw':'Suspend'):'Return',{type:'button',class:'reg-btn reg-btn-gray'});change.onclick=event=>{event.stopPropagation();run(()=>status(kind,row));};actions.append(change);}tr.append(actions);body.append(tr);}
    if(!result.data.length){const row=node('tr',null),cell=node('td','No matching records.');cell.colSpan=kind==='student'?14:7;row.append(cell);body.append(row);}
    byId(kind==='student'?'studentCount':'teacherCount').textContent=String(result.total);
    let pager=byId(kind+'Pager');if(!pager){pager=node('div',null,{id:kind+'Pager',class:'m1-pagination'});body.closest('.reg-table-wrap').append(pager);}pager.replaceChildren();
    for(const[label,offset,enabled]of[['Previous',Math.max(0,model.offset[kind]-25),model.offset[kind]>0],['Next',model.offset[kind]+25,model.offset[kind]+25<result.total]]){const button=node('button',label,{type:'button',class:'reg-btn reg-btn-gray'});button.hidden=!enabled;button.onclick=()=>run(async()=>{model.offset[kind]=offset;await load(kind);});pager.append(button);}pager.append(node('span',`${result.total?model.offset[kind]+1:0}–${model.offset[kind]+result.data.length} of ${result.total}`));}
async function divisions(regionId,selected){const rows=(await api(`/api/reference/divisions?regionId=${encodeURIComponent(regionId)}`)).data;options(byId('sDivision'),rows);const matching=rows.find(row=>row.name===selected);if(matching)byId('sDivision').value=String(matching.id);else if(selected)lookupSelect('sDivision',selected);}
async function submit(kind){const old=model.edits[kind],body={};for(const[key,control]of Object.entries(fields[kind])){const raw=byId(control).value.trim();body[key]=key==='noOfChildren'?(raw===''?null:Number(raw)):raw||null;}
    if(kind==='student'){body.regionOfOrigin=byId('sRegion').selectedOptions[0]?.value?byId('sRegion').selectedOptions[0].textContent:null;body.division=byId('sDivision').selectedOptions[0]?.value?byId('sDivision').selectedOptions[0].textContent:null;}
    if(old)body.version=old.version;else{body.password=byId(kind==='student'?'sPassword':'tPassword').value;if(kind==='student'){const year=byId('sAcademicYear').value,room=byId('sClass').value;if(Boolean(year)!==Boolean(room))throw new Error('Choose both academic year and class, or leave both empty.');if(ledgerEnabled&&(!year||!room))throw new Error('Choose an academic year and class for the initial enrolment.');if(year)body.placement={yearId:Number(year),classId:Number(room),...(ledgerEnabled?{fromDate:byId('sEnrolmentFrom').value,sourceReference:byId('sEnrolmentSource').value.trim(),reason:byId('sEnrolmentReason').value.trim()}:{})};}}
    await api(`/api/personnel/${resource(kind)}${old?'/'+old.id:''}`,{method:old?'PATCH':'POST',body});reset(kind);await load(kind);say(old?'Profile updated.':'Registration completed.');}
async function start(){try{model.identity=(await api('/api/identity/session')).identity;if(!model.identity.roles.includes('admin'))throw new Error('A school administrator account is required.');model.csrf=(await api('/api/identity/csrf',{method:'POST',body:{}})).csrfToken;
    const memberships=(await api('/api/identity/memberships')).data;const current=memberships.find(row=>row.schoolId===model.identity.schoolId);byId('schoolName').textContent=current.name;options(byId('schoolSwitch'),memberships.map(row=>({id:row.code,name:row.name})),current.code);byId('schoolSwitch').closest('label').hidden=memberships.length===1;
    const[years,classes,regions]=await Promise.all([api('/api/setup/academic-years'),api('/api/setup/classes'),api('/api/reference/regions')]);model.regions=regions.data;model.classes=classes.data;model.years=years.data;options(byId('sAcademicYear'),years.data);options(byId('sClass'),classes.data);options(byId('sRegion'),regions.data);
    reset('student');reset('teacher');byId('registrationWorkspace').hidden=false;byId('signInNotice').hidden=true;await Promise.all([load('student'),load('teacher')]);return true;
}catch(error){lockout();say(error.message,true);return false;}}
async function switchSchool(){
    const schoolCode=byId('schoolSwitch').value;
    if(!schoolCode)throw new Error('Choose a school.');
    // Remove the previous school's private DOM and discard in-flight list responses immediately.
    model.epoch++;model.offset={student:0,teacher:0};model.edits={};model.selected={};model.rows={student:[],teacher:[]};
    clearHistory();closeSourceReview();clearPlacementReview();
    document.querySelectorAll('form').forEach(form=>form.reset());
    for(const id of ['studentTableBody','teacherTableBody'])byId(id).replaceChildren();
    byId('registrationWorkspace').hidden=true;
    say('Switching school…');
    try{
        const result=await api('/api/identity/switch-school',{method:'POST',body:{schoolCode}});
        model.csrf=result.csrfToken;
        if(await start())say('School switched.');
    }catch(error){lockout();throw error;}
}
for(const kind of ['student','teacher']){byId(kind+'Form').addEventListener('submit',event=>{event.preventDefault();run(()=>submit(kind));});byId(kind+'ResetBtn').onclick=()=>reset(kind);byId(kind+'EditBtn').onclick=()=>run(async()=>{if(!model.selected[kind])throw new Error('Select a record first.');await edit(kind,model.selected[kind]);});byId(kind+'SaveBtn').textContent='Save';byId(kind+'SaveBtn').onclick=()=>byId(kind+'Form').requestSubmit();byId(kind+'DeleteBtn').hidden=true;
    let timer;byId(kind==='student'?'studentSearch':'teacherSearch').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>run(async()=>{model.offset[kind]=0;await load(kind);}),250);};}
document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>show(button.dataset.kind));
if(placementPanel)placementPanel.ontoggle=()=>{if(placementPanel.open)loadPlacementReview();else clearPlacementReview();};
if(ledgerEnabled){document.querySelector('#studentForm .reg-student-fields').append(byId('initialEnrolmentFields'));byId('sub-student').append(byId('enrolmentHistory'));byId('closeEnrolmentHistory').onclick=clearHistory;}
if(transferEnabled)byId('transferForm').addEventListener('submit',event=>{event.preventDefault();run(submitTransfer);});
if(lifecycleEnabled){
    byId('pupilStatusForm').addEventListener('submit',event=>{event.preventDefault();run(submitPupilStatus);});
    byId('returnClass').onchange=reviewReturnCourses;
}
byId('sRegion').onchange=()=>run(()=>divisions(byId('sRegion').value));
byId('studentSearch').setAttribute('aria-label','Search pupils');byId('teacherSearch').setAttribute('aria-label','Search teachers');
document.querySelectorAll('.reg-table th').forEach(header=>header.setAttribute('scope','col'));
byId('tStatus').disabled=true;byId('sMedicalStatus').disabled=true;byId('sMedicalStatus').placeholder='Separate medical permission required';
document.querySelectorAll('.reg-student-fees input').forEach(input=>input.disabled=true);byId('studentFeesBody').append(node('p','Fee collection is not enabled in this workspace.',{class:'m1-unavailable'}));
byId('tEmpType').onchange=()=>{byId('tMatriculeFile').required=byId('tEmpType').value==='Government';};
byId('menuToggle').onclick=()=>{const open=byId('sidebar').classList.toggle('open');byId('menuToggle').setAttribute('aria-expanded',String(open));};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&byId('sidebar').classList.contains('open')){byId('sidebar').classList.remove('open');byId('menuToggle').setAttribute('aria-expanded','false');byId('menuToggle').focus();}});
for(const id of ['sidebarLogout','topLogout'])byId(id).onclick=()=>run(async()=>{await api('/api/identity/logout',{method:'POST',body:{}});lockout();window.location.assign('/');});
byId('schoolSwitch').onchange=()=>run(switchSchool);
start();
