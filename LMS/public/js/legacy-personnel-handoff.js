'use strict';
// Sends registration tasks to the school workspace when one is configured for this deployment.
(()=>{
 const base=(document.body.dataset.workspaceBase||'').replace(/\/+$/,'');
 const academic=document.body.dataset.canonicalAcademic==='true';
 const auxiliary=document.body.dataset.canonicalAuxiliary==='true';
 const academicKinds={subject:'subject',classes:'class','academic-years':'year'};
 function targetFor(sub){
  if(auxiliary&&sub==='auxiliary')return '/auxiliary';
  if(academic&&academicKinds[sub])return '/academic?kind='+academicKinds[sub];
  if(!sub||['student','teacher'].includes(sub))return '/registration';
  return null;
 }
 function go(path,replace){
  if(!base){if(window.toast)toast('This task is managed in the school workspace, which is not configured for this deployment. Ask your administrator.','warning');return;}
  window.location[replace?'replace':'assign'](base+path);
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest('[data-tab="registration"],.reg-subtab');
  if(!target)return;const path=targetFor(target.dataset.sub);
  if(!path)return;
  event.preventDefault();event.stopImmediatePropagation();go(path,false);
 },true);
 function handoff(){
  const match=window.location.hash.match(/^#registration(?:\/([^/]+))?$/);
  if(!match)return;const path=targetFor(match[1]);
  if(path&&base)go(path,true);
 }
 window.addEventListener('hashchange',handoff);handoff();
})();
