'use strict';
(()=>{
    const get=id=>document.getElementById(id);
    let csrf,registers=[],dirty=new Set(),previous='';
    function element(tag,text){
        const e=document.createElement(tag);
        if(text!==undefined)e.textContent=text;
        return e;
    }
    async function api(path,body){
        const response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',
            headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf||''}:{},body:body?JSON.stringify(body):undefined});
        const result=await response.json();
        if(!response.ok){
            if(response.status===403){get('workspace').hidden=true;get('pupils').replaceChildren();get('totals').replaceChildren();get('enter').hidden=false;dirty.clear();}
            throw Error(result.message||'Could not open the register');
        }
        return result;
    }
    async function run(work){
        const controls=()=>Array.from(document.querySelectorAll('button,select,input'));
        controls().forEach(e=>e.disabled=true);
        try{await work();}catch(error){get('notice').textContent=error.message;}
        finally{controls().forEach(e=>e.disabled=false);}
    }
    function field(form,label,input){
        const wrap=element('label',label);wrap.append(input);form.append(wrap);
    }
    function table(target,columns,rows){
        const grid=element('table'),head=element('thead'),heading=element('tr'),body=element('tbody');
        for(const column of columns){const cell=element('th',column);cell.scope='col';heading.append(cell);}
        head.append(heading);
        for(const values of rows){const row=element('tr');for(const value of values)row.append(element('td',value??'—'));body.append(row);}
        grid.append(head,body);target.replaceChildren(grid);
    }
    async function open(){
        const selected=registers.find(row=>String(row.id)===get('register').value);
        get('pupils').replaceChildren();get('totals').replaceChildren();get('periods').textContent='';dirty.clear();
        if(!selected)return;
        get('from').value=selected.lessonDate;get('to').value=selected.lessonDate;
        const pupils=await api('/api/attendance/registers/'+selected.id);
        get('periods').textContent=selected.periods+' scheduled periods';
        get('notice').textContent=pupils.length?'':'No pupils in this register.';
        for(const pupil of pupils){
            const form=element('form');form.className='panel';
            form.append(element('h2',pupil.name+' · '+pupil.matricule));
            const count=element('input');count.type='number';count.min='0';count.max=String(selected.periods);count.step='1';count.required=true;
            count.value=pupil.attended??'';
            field(form,'Periods attended',count);
            const reason=element('input');reason.maxLength=300;field(form,'Reason for correction',reason);
            const summary=element('output');
            function display(){
                reason.required=pupil.version>0;reason.parentElement.hidden=!reason.required;
                summary.textContent=pupil.attended===null?'Awaiting entry':pupil.attended+' attended · '+(selected.periods-pupil.attended)+' missed';
            }
            display();form.append(summary,element('button','Save entry'));
            const history=element('div');history.className='table-wrap';
            const historyButton=element('button','View correction history');historyButton.type='button';
            historyButton.onclick=()=>run(async()=>{
                history.replaceChildren();
                const entries=await api('/api/attendance/registers/'+selected.id+'/pupils/'+pupil.studentId+'/history');
                if(!entries.length){history.append(element('p','No saved entries yet.'));return;}
                table(history,['Version','Previous attended','Attended','Reason','Editor membership','Recorded time'],entries.map(entry=>[
                    entry.revision,entry.previousAttended,entry.attended,entry.reason,entry.editorMembershipId,
                    new Date(entry.recordedAt).toLocaleString()
                ]));
            });
            form.append(historyButton,history);
            form.oninput=()=>dirty.add(pupil.studentId);
            form.onsubmit=event=>{event.preventDefault();run(async()=>{
                const saved=await api('/api/attendance/entries',{sessionId:selected.id,studentId:pupil.studentId,
                    version:pupil.version,attended:count.valueAsNumber,reason:reason.value});
                Object.assign(pupil,saved);reason.value='';dirty.delete(pupil.studentId);display();
                history.replaceChildren();get('totals').replaceChildren();
                get('notice').textContent='Saved attendance for '+pupil.name+'.';
            });};
            get('pupils').append(form);
        }
    }
    get('enter').onclick=()=>run(async()=>{
        csrf=(await api('/practice/sign-in',{})).csrfToken;
        registers=await api('/api/attendance/registers');
        const select=get('register');select.replaceChildren();
        for(const row of registers){const opt=element('option',row.className+' · '+row.lessonDate+' · '+row.yearName);opt.value=row.id;select.append(opt);}
        previous=select.value;get('enter').hidden=true;get('workspace').hidden=false;await open();
    });
    get('register').onchange=()=>run(async()=>{
        if(dirty.size&&!window.confirm('Discard unsaved attendance entries?')){get('register').value=previous;return;}
        previous=get('register').value;await open();
    });
    get('totals-form').onsubmit=event=>{event.preventDefault();run(async()=>{
        get('totals').replaceChildren();
        const query=new URLSearchParams({registerId:get('register').value,from:get('from').value,to:get('to').value});
        const rows=await api('/api/attendance/totals?'+query);
        if(!rows.length){get('totals').textContent='No registers in this date range.';return;}
        table(get('totals'),['Pupil','Matricule','Register days','Scheduled','Attended','Missed','Unrecorded'],
            rows.map(row=>[row.name,row.matricule,row.registeredDays,row.scheduled,row.attended,row.missed,row.unrecorded]));
    });};
    for(const id of ['from','to'])get(id).oninput=()=>get('totals').replaceChildren();
    window.addEventListener('beforeunload',event=>{if(dirty.size){event.preventDefault();event.returnValue='';}});
})();
