'use strict';
(()=>{
 const destination='https://localhost:2027/registration';
 const academic=document.body.dataset.canonicalAcademic==='true';
 const auxiliary=document.body.dataset.canonicalAuxiliary==='true';
 const academicKinds={subject:'subject',classes:'class','academic-years':'year'};
 document.addEventListener('click',event=>{
  const target=event.target.closest('[data-tab="registration"],.reg-subtab');
  if(!target)return;const sub=target.dataset.sub;
  if(sub&&!['student','teacher'].includes(sub)&&!(academic&&academicKinds[sub])&&!(auxiliary&&sub==='auxiliary'))return;
  event.preventDefault();event.stopImmediatePropagation();window.location.assign(auxiliary&&sub==='auxiliary'?'https://localhost:2027/auxiliary':academic&&academicKinds[sub]?'https://localhost:2027/academic?kind='+academicKinds[sub]:destination);
 },true);
 function handoff(){const hash=window.location.hash;if(/^#registration(?:\/(?:student|teacher))?$/.test(hash))window.location.replace(destination);else{const sub=hash.match(/^#registration\/([^/]+)$/)?.[1];if(auxiliary&&sub==='auxiliary')window.location.replace('https://localhost:2027/auxiliary');else if(academic&&academicKinds[sub])window.location.replace('https://localhost:2027/academic?kind='+academicKinds[sub]);}}
 window.addEventListener('hashchange',handoff);handoff();
})();
