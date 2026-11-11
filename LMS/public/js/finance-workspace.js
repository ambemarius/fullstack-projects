(() => {
 function enhance(){
  document.body.dataset.enhanced='true';
  const opener=document.getElementById('finance-menu-open'),dialog=document.getElementById('finance-menu');
  if(opener&&dialog&&typeof dialog.showModal==='function'){
   opener.hidden=false;opener.onclick=()=>dialog.showModal();
   document.getElementById('finance-menu-close').onclick=()=>dialog.close();
   dialog.addEventListener('close',()=>opener.focus());
  }else delete document.body.dataset.enhanced;
  document.querySelectorAll('.table-wrap').forEach((region,index)=>{region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','Scrollable data table '+(index+1));});
  document.querySelectorAll('th').forEach(th=>{if(/^(Amount|Original amount|Charge|Collected|Outstanding|Net paid|Recorded|Reversed|Current net|Entries)$/.test(th.textContent.trim())){
   const index=Array.from(th.parentElement.children).indexOf(th);th.classList.add('numeric');
   th.closest('table').querySelectorAll('tbody tr').forEach(row=>{const cell=row.children[index];if(cell&&!cell.hasAttribute('colspan'))cell.classList.add('numeric');});
  }});
 }
 document.addEventListener('click',event=>{
  const link=event.target.closest('[data-open-panel]');if(!link)return;
  const panel=document.getElementById(link.dataset.openPanel);if(!panel)return;
  event.preventDefault();panel.open=true;panel.scrollIntoView({block:'start'});panel.querySelector('input:not([type=hidden]),select')?.focus();
 });
 document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement)||(form.getAttribute('method')||'get').toLowerCase()!=='post')return;
  event.preventDefault();if(form.getAttribute('aria-busy')==='true')return;
  const body=new URLSearchParams(new FormData(form));
  const buttons=Array.from(form.querySelectorAll('button[type=submit],button:not([type])'));form.setAttribute('aria-busy','true');buttons.forEach(b=>b.disabled=true);
  form.querySelector('.form-error')?.remove();
  const showError=message=>{const error=document.createElement('p');error.className='form-error';error.setAttribute('role','alert');error.tabIndex=-1;error.textContent=message;form.prepend(error);error.focus();};
  try{
   const response=await fetch(form.getAttribute('action')||window.location.href,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'text/html'},body});
   if(response.redirected&&response.ok){window.location.assign(response.url);return;}
   const html=await response.text(),parsed=new DOMParser().parseFromString(html,'text/html');
   if(response.status===401||response.status===403){document.getElementById('finance-main').replaceChildren();window.location.assign('/');return;}
   if(!response.ok){showError([404,409,422].includes(response.status)?parsed.querySelector('[data-entry-error]')?.textContent||'Review this entry and try again.':'Could not save the entry. Your values are still here; retry when the service is available.');return;}
   if(!parsed.body.classList.contains('finance-app'))throw Error('Unexpected response');
   document.title=parsed.title;document.body.replaceWith(parsed.body);enhance();document.getElementById('finance-main')?.focus();
  }catch(_error){showError('Connection interrupted. Your values are still here. Check the records before retrying if the submission may have reached the server.');}
  finally{form.removeAttribute('aria-busy');buttons.forEach(b=>b.disabled=false);}
 });
 enhance();
})();
