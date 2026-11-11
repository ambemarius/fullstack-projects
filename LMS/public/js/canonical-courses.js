'use strict';
(()=>{const $=id=>document.getElementById(id);let csrf,identity,currentYear,busy=false,epoch=0;const drafts=new Set();let state={offerings:[],students:[],teachers:[],classes:[],subjects:[]};
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};const name=row=>row?[row.firstName,row.middleName,row.lastName].filter(Boolean).join(' '):'Record';const say=text=>{$('message').textContent=text;};
function clear(){epoch++;drafts.clear();csrf=null;state={offerings:[],students:[],teachers:[],classes:[],subjects:[]};$('workspace').hidden=true;$('details').replaceChildren();for(const id of ['class','subject','offering'])$(id).replaceChildren();}
async function api(path,method='GET',body){const response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});const data=response.status===204?{}:await response.json();if(!response.ok){if(response.status===403||response.status===404)clear();throw new Error(data.message||'Request failed');}return data;}
async function run(work){if(busy)return;busy=true;document.querySelectorAll('button,select,input').forEach(e=>e.disabled=true);try{await work();}catch(error){say(error.message);}finally{busy=false;document.querySelectorAll('button,select,input').forEach(e=>e.disabled=false);}}
function discardDrafts(){if(drafts.size){if(!window.confirm('Discard unsaved raw scores?'))return false;$('details').querySelector('[data-marks]')?.remove();drafts.clear();}return true;}
window.addEventListener('beforeunload',event=>{if(drafts.size){event.preventDefault();event.returnValue='';}});
function select(element,rows,label,empty=true){element.replaceChildren();if(empty){const option=node('option','Choose');option.value='';element.append(option);}for(const row of rows){const option=node('option',label(row));option.value=String(row.id);element.append(option);}}
function button(text,handler,keepDrafts=false){const e=node('button',text);e.type='button';e.onclick=()=>run(async()=>{if(!keepDrafts&&!discardDrafts())return;await handler();});return e;}
function table(parent,headers,rows){const wrap=node('div');wrap.className='table-wrap';const t=node('table'),head=node('thead'),tr=node('tr');headers.forEach(h=>tr.append(node('th',h)));head.append(tr);const body=node('tbody');for(const cells of rows){const row=node('tr');for(const value of cells){const cell=node('td');if(value instanceof Node)cell.append(value);else cell.textContent=value??'—';row.append(cell);}body.append(row);}if(!rows.length){const row=node('tr'),cell=node('td','No records in this scope.');cell.colSpan=headers.length;row.append(cell);body.append(row);}t.append(head,body);wrap.append(t);parent.append(wrap);}
function panel(title){const box=node('section');box.className='panel';box.append(node('h2',title));return box;}
async function personnel(kind){let offset=0,total=1;const rows=[];while(offset<total){const response=await api(`personnel/${kind}?limit=100&offset=${offset}`);rows.push(...response.data);total=response.total;offset+=100;}return rows;}
async function marks(offeringId){
 if(!discardDrafts())return;
 const current=epoch,root={offeringId,yearId:currentYear.id,term:$('term').value};
 const result=await api(`marks/sheet?offeringId=${offeringId}&yearId=${root.yearId}&term=${root.term}`);
 if(current!==epoch)return;
 const box=panel('Raw marks'),grouped=new Map();
 box.append(node('p','Enter a score and its maximum for each sequence. Leave unrecorded marks blank.'));
 for(const row of result.data){
  if(!grouped.has(row.studentId))grouped.set(row.studentId,{...row,marks:[]});
  if(row.sequence)grouped.get(row.studentId).marks.push(row);
 }
 const batch=button('Save changed scores',()=>save([...drafts]),true);
 function updateCount(){
  batch.hidden=drafts.size===0;
  batch.textContent='Save changed scores ('+drafts.size+')';
 }
 async function save(rows){
  if(!rows.length)return;
  if(rows.length>200)throw Error('A batch can contain up to 200 scores. Save individual rows to reduce this batch.');
  const scores=rows.map(row=>{
   const score=Number(row.score.value),maxScore=Number(row.max.value);
   if(row.score.value===''||row.max.value===''||!Number.isFinite(score)||!Number.isFinite(maxScore)||
      Math.round(score*100)/100!==score||Math.round(maxScore*100)/100!==maxScore||score<0||score>maxScore||maxScore<=0||maxScore>999.99)
    throw Error(row.label+': enter a score from zero to its maximum, and a positive maximum up to 999.99, using up to two decimal places.');
   return {studentId:row.studentId,sequence:row.sequence,score,maxScore,version:row.version};
  });
  const saved=await api('marks/scores','POST',{...root,scores});
  if(epoch!==current)return;
  const versions=new Map(saved.data.map(r=>[r.studentId+':'+r.sequence,r.version]));
  for(const row of rows){
   row.version=versions.get(row.studentId+':'+row.sequence);
   row.originalScore=String(row.score.value);row.originalMax=String(row.max.value);
   drafts.delete(row);
  }
  updateCount();say(rows.length===1?'Raw score saved.':rows.length+' raw scores saved.');
 }
 table(box,['Pupil','Sequence','Score','Maximum','Action'],[...grouped.values()].flatMap(pupil=>[1,2].map(sequence=>{
  const old=pupil.marks.find(m=>m.sequence===sequence),score=node('input'),max=node('input');
  const row={studentId:pupil.studentId,sequence,version:old?.version??0,score,max,label:name(pupil)+' sequence '+sequence,
   originalScore:String(old?.score??''),originalMax:String(old?.maxScore??'')};
  for(const input of [score,max]){
   input.type='number';input.step='0.01';input.oninput=()=>{
    if(String(score.value)===row.originalScore&&String(max.value)===row.originalMax)drafts.delete(row);
    else drafts.add(row);
    updateCount();
   };
   input.setAttribute('aria-label',row.label+' '+(input===score?'score':'maximum'));
  }
  score.min=0;max.min='0.01';max.max='999.99';score.value=row.originalScore;max.value=row.originalMax;
  return [name(pupil),String(sequence),score,max,button('Save score',()=>save([row]),true)];
 })));
 updateCount();box.append(batch);
 $('details').querySelector('[data-marks]')?.remove();box.dataset.marks='true';$('details').append(box);
}
async function teacherView(){const root={yearId:currentYear.id,term:$('term').value};const result=await api(`links/my-assignments?yearId=${root.yearId}&term=${root.term}`);const box=panel('My confirmed teaching assignments');table(box,['Class','Subject','Actions'],result.data.map(row=>{const actions=node('div');actions.append(button('View roster',async()=>{const roster=await api(`links/offerings/${row.offeringId}/roster?yearId=${root.yearId}&term=${root.term}`);$('details').querySelector('[data-roster]')?.remove();const list=panel(row.className+' · '+row.subjectName);list.dataset.roster='true';table(list,['Pupil','Matricule'],roster.data.map(p=>[name(p),p.matricule]));$('details').append(list);}),button('Raw marks',()=>marks(row.offeringId)));return[row.className,row.subjectName,actions];}));$('details').append(box);}
async function adminView(){const offeringId=Number($('offering').value);if(!offeringId){$('details').append(panel('Select or create a subject offering'));return;}const root={offeringId,yearId:currentYear.id,term:$('term').value};const [enrolments,assignments]=await Promise.all([api(`links/offerings/${offeringId}/enrolments?yearId=${root.yearId}`),api(`links/offerings/${offeringId}/assignments?yearId=${root.yearId}&term=${root.term}`)]);
 const pupils=panel('Pupil subject memberships');pupils.append(node('p','A pupil must already be placed in this class and current academic year. Pupils with recorded marks require a reviewed correction before removal.'));const pupil=node('select');pupil.setAttribute('aria-label','Pupil to enrol');select(pupil,state.students.filter(s=>!s.isWithdrawn),s=>name(s)+' · '+s.matricule);pupils.append(pupil,button('Enrol selected pupil',async()=>{const studentId=Number(pupil.value);if(!studentId)throw Error('Choose a pupil.');const old=enrolments.data.find(e=>e.studentId===studentId);await api('links/enrolments','POST',{offeringId,yearId:root.yearId,changes:[{studentId,action:'enrol',version:old?.version??0}]});await details();say('Subject membership saved.');}));table(pupils,['Pupil','Status','Action'],enrolments.data.map(row=>[name(state.students.find(p=>p.id===row.studentId)),row.status,row.status==='active'?button('Revoke membership',async()=>{await api('links/enrolments','POST',{offeringId,yearId:root.yearId,changes:[{studentId:row.studentId,action:'revoke',version:row.version}]});await details();say('Subject membership revoked; history retained.');}):'—']));
 const teachers=panel('Teaching assignments · '+root.term);const teacher=node('select');teacher.setAttribute('aria-label','Teacher to assign');select(teacher,state.teachers.filter(t=>t.status==='active'),name);teachers.append(teacher,button('Assign selected teacher',async()=>{const teacherId=Number(teacher.value);if(!teacherId)throw Error('Choose a teacher.');const old=assignments.data.find(a=>a.teacherId===teacherId);await api('links/assignments','POST',{...root,teacherId,action:'assign',version:old?.version??0});await details();say('Explicit year and term assignment saved.');}));table(teachers,['Teacher','Status','Action'],assignments.data.map(row=>[name(state.teachers.find(t=>t.id===row.teacherId)),row.status,row.status==='active'?button('Revoke assignment',async()=>{await api('links/assignments','POST',{...root,teacherId:row.teacherId,action:'revoke',version:row.version});await details();say('Teaching access revoked.');}):'—']));$('details').append(pupils,teachers,button('Open raw mark sheet',()=>marks(offeringId)));}
async function showTimetable(current){
 const term=$('term').value;
 const path='links/my-timetable?yearId='+currentYear.id+'&term='+encodeURIComponent(term);
 const response=await api(path);
 if(current!==epoch)return;
 const box=panel('My timetable');box.id='my-timetable';
 if(response.data.length){
  const actions=node('nav');
  actions.setAttribute('aria-label','Timetable exports');
  const csv=node('a','Download CSV'),print=node('a','Print timetable');
  csv.href='/api/'+path+'&format=csv';
  print.href='/api/'+path+'&format=print';
  print.target='_blank';print.rel='noopener';
  actions.append(csv,print);box.append(actions);
  table(box,['Day','Time','Class','Subject','Teacher','Room'],response.data.map(lesson=>[
   lesson.day,lesson.startTime+'–'+lesson.endTime,[lesson.className,lesson.stream].filter(Boolean).join(' · '),
   lesson.subjectName,lesson.teacherName,lesson.room
  ]));
 }else{
  box.append(node('p',identity.roles.includes('teacher')
   ? 'No lessons match your confirmed teaching assignments for this term.'
   : 'No lessons match your current class and subject enrolments for this term.'));
 }
 $('details').append(box);
}
async function details(){if(!discardDrafts())return;const current=epoch;$('details').replaceChildren();if(!currentYear){$('details').append(panel('No current academic year selected'));return;}if(identity.roles.includes('teacher')||identity.roles.includes('student'))await showTimetable(current);if(current!==epoch)return;if(identity.roles.includes('admin'))await adminView();else if(identity.roles.includes('teacher'))await teacherView();else{const response=await api('links/my-enrolments?yearId='+currentYear.id);if(current!==epoch)return;const box=panel('My subject memberships');table(box,['Class','Subject','Status'],response.data.map(row=>[row.className,row.subjectName,row.status]));$('details').append(box);}}
async function offerings(){state.offerings=(await api('links/offerings')).data;select($('offering'),state.offerings,o=>[state.classes.find(c=>c.id===o.class_id)?.name,state.subjects.find(s=>s.id===o.subject_id)?.name,o.coefficient===null?'Coefficient unspecified':'Coefficient '+o.coefficient].join(' · '),false);}
$('offering-form').onsubmit=event=>{event.preventDefault();run(async()=>{if(!discardDrafts())return;await api('links/offerings','POST',{classId:Number($('class').value),subjectId:Number($('subject').value),coefficient:Number($('coefficient').value)});await offerings();await details();say('Subject offering created.');});};
for(const id of ['term','offering']){const element=$(id);element.onfocus=()=>{element.dataset.previous=element.value;};element.onchange=()=>run(async()=>{if(!discardDrafts()){element.value=element.dataset.previous;return;}element.dataset.previous=element.value;await details();});}
$('refresh').onclick=()=>run(async()=>{if(!discardDrafts())return;currentYear=(await api('setup/context')).data.currentYear;$('year').textContent=currentYear?'Academic year '+currentYear.name:'No current academic year';await details();});$('logout').onclick=()=>run(async()=>{if(!discardDrafts())return;await api('identity/logout','POST',{});clear();window.location.assign('/');});
run(async()=>{identity=(await api('identity/session')).identity;csrf=(await api('identity/csrf','POST',{})).csrfToken;currentYear=(await api('setup/context')).data.currentYear;$('year').textContent=currentYear?'Academic year '+currentYear.name:'No current academic year';if(identity.roles.includes('admin')){const [classes,subjects,students,teachers]=await Promise.all([api('setup/classes'),api('setup/subjects'),personnel('students'),personnel('teachers')]);state.classes=classes.data;state.subjects=subjects.data;state.students=students;state.teachers=teachers;select($('class'),state.classes,c=>[c.section,c.name,c.stream].filter(Boolean).join(' · '));select($('subject'),state.subjects,s=>s.code+' · '+s.name);await offerings();$('admin').hidden=false;}await details();$('workspace').hidden=false;say('Course workspace ready.');});
})();
