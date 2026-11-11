// Presentation/accessibility only. Never reads credentials or grants access.
(() => {
 const root=document.body;if(!root.classList.contains('lms-ui'))return;
 const content=document.querySelector('.admin-content')||document.querySelector('main');
 if(content){if(!content.id)content.id='lms-main';content.tabIndex=-1;
  const skip=document.createElement('a');skip.className='lms-skip';skip.href='#'+content.id;skip.textContent='Skip to main content';root.prepend(skip);}
 function enhanceTables(){
  document.querySelectorAll('table').forEach(table=>{
   if(table.dataset.uiEnhanced)return;table.dataset.uiEnhanced='true';
   let region=table.closest('.table-wrap,.reg-table-scroll,.marks-table-wrap,.lms-table-region');
   if(!region){region=document.createElement('div');region.className='lms-table-region';table.before(region);region.append(table);}
   region.tabIndex=0;region.setAttribute('role','region');
   const title=table.querySelector('caption')?.textContent||table.closest('section,.card,.panel')?.querySelector('h2,h3')?.textContent||'Records';
   if(!region.hasAttribute('aria-label'))region.setAttribute('aria-label',title.trim()+' — scrollable table');
  });
 }
 enhanceTables();let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhanceTables();});}).observe(content||root,{childList:true,subtree:true});
 const sidebar=document.getElementById('sidebar'),toggle=document.getElementById('menuToggle');
 if(sidebar&&toggle){
  const mobile=window.matchMedia('(max-width:768px)'),main=document.querySelector('.admin-main');
  const close=document.createElement('button');close.type='button';close.className='lms-nav-close';close.textContent='Close navigation';sidebar.prepend(close);
  const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='lms-nav-backdrop';backdrop.tabIndex=-1;backdrop.setAttribute('aria-hidden','true');backdrop.hidden=true;root.append(backdrop);
  let wasOpen=false,previousInert=false;
  const dismiss=()=>{sidebar.classList.remove('open');sync();toggle.focus();};
  close.addEventListener('click',dismiss);backdrop.addEventListener('click',dismiss);
  toggle.setAttribute('aria-controls','sidebar');toggle.setAttribute('aria-label','Open navigation');
  const sync=()=>{
   const open=mobile.matches&&sidebar.classList.contains('open');
   toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');backdrop.hidden=!open;
   if(open&&!wasOpen){previousInert=Boolean(main?.inert);if(main)main.inert=true;close.focus();}
   if(!open&&wasOpen){if(main)main.inert=previousInert;if(sidebar.contains(document.activeElement)){if(mobile.matches)toggle.focus();else sidebar.querySelector('a[href],button:not(.lms-nav-close)')?.focus();}}
   wasOpen=open;
  };
  new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});sync();
  mobile.addEventListener('change',sync);
  sidebar.addEventListener('keydown',event=>{
   if(event.key!=='Tab'||!wasOpen)return;
   const controls=[...sidebar.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sidebar.classList.contains('open')){sidebar.classList.remove('open');toggle.focus();}});
 }
})();
