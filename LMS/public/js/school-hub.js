(() => {
 const opener=document.getElementById('hub-menu-open'),dialog=document.getElementById('hub-menu');
 if(opener&&dialog&&typeof dialog.showModal==='function'){
  document.body.classList.add('hub-enhanced');opener.hidden=false;
  opener.addEventListener('click',()=>dialog.showModal());
  document.getElementById('hub-menu-close').addEventListener('click',()=>dialog.close());
  let destination;
  dialog.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(!link)return;
   destination=document.getElementById(link.getAttribute('href').slice(1));dialog.close();});
  dialog.addEventListener('close',()=>{if(destination){destination.tabIndex=-1;destination.focus();destination=null;}else opener.focus();});
 }
 const account=document.querySelector('.hub-account');
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&account?.open){account.open=false;account.querySelector('summary').focus();}});
 document.addEventListener('click',event=>{if(account?.open&&!account.contains(event.target))account.open=false;});
 window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});
})();
