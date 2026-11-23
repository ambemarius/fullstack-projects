// Presentation only: destinations retain their existing authorisation.
// `baseUrl` is the public origin of the original application; `practiceUrls`
// name the optional practice servers. Nothing is hard-coded to a developer machine.
const roleNames={admin:'Administrator',teacher:'Teacher',student:'Student',bursar:'Bursar / cashier',librarian:'Librarian',lab_attendant:'Laboratory attendant',discipline_master:'Discipline master'};
const modules=[
 {id:'finance',icon:'wallet',title:'Financial management',description:'Student charges, payments and receipts. Keep collections and outstanding balances in view.',roles:['admin','bursar'],actions:[['finance','Administrator'],['cashier','Bursar / cashier']]},
 {id:'library',icon:'book',title:'Library',description:'Find books, manage lending and renewals, and follow each copy through its return.',roles:['librarian'],actions:[['library','Librarian']]},
 {id:'laboratory',icon:'flask',title:'Laboratory',description:'Manage equipment and stock, review requests, and record issues and returns.',roles:['lab_attendant','teacher'],actions:[['laboratory','Laboratory attendant'],['requests','Teacher']]},
 {id:'attendance',icon:'calendar',title:'Attendance',description:'Open a dated class register, record attended periods and review corrections.',roles:['discipline_master'],practice:'attendance'}
];
const trim=url=>String(url||'').replace(/\/+$/,'');
function practiceHub(accounts,{practiceUrls={}}={}){
 const attendance=trim(practiceUrls.attendance);
 return {practice:true,schoolName:'Practice workspaces',roleLabel:'Practice visitor',yearLabel:'Academic year varies by workspace',groups:[],
  modules:modules.map(m=>({...m,href:m.practice?attendance||undefined:undefined,actions:(m.actions||[]).filter(([area])=>accounts[area])})).filter(m=>m.href||m.actions.length),history:true};
}
function liveHub(identity,school,years,enabled,{baseUrl='',practiceUrls={}}={}){
 const base=trim(baseUrl);const modulesUrl=trim(practiceUrls.modules);const attendance=trim(practiceUrls.attendance);
 const has=(...roles)=>roles.some(r=>identity.roles.includes(r));
 const groups=[
  {title:'People',icon:'people',items:[
   has('admin')&&enabled.personnelWrites&&['Students and teachers','Registration and profiles','/registration'],
   has('admin')&&enabled.auxiliaryWrites&&['Auxiliary staff','School support team','/auxiliary']]},
  {title:'Academics',icon:'book',items:[
   has('admin')&&enabled.academicWrites&&['Classes, subjects and years','Academic setup','/academic'],
   has('admin','teacher','student')&&enabled.academicLinks&&['Courses, marks and timetables','Your academic workspace','/courses'],
   has('admin')&&['Administrator timetable','Original school application',base+'/timetable']]},
  {title:'Administration',icon:'shield',items:[
   has('admin')&&enabled.staffAccounts&&['Staff accounts and recovery','Access and account support','/staff-accounts'],
   !enabled.schoolAdministration&&has('admin','teacher')&&enabled.membershipInvitations&&['Administrator invitations','Accept a school invitation','/invitations'],
   has('admin')&&['Dashboard and reports','Original school application',base+'/admin-dashboard']]}
 ].map(g=>({...g,items:g.items.filter(Boolean)})).filter(g=>g.items.length);
 const visible=modules.filter(m=>has(...m.roles));
 return {practice:false,schoolName:school.name,roleLabel:identity.roles.map(r=>roleNames[r]||'School staff').join(' · '),
  yearLabel:years.length===1?'Academic year '+years[0].name:years.length?'Academic year needs review':'No current academic year set',groups,
  modules:enabled.schoolAdministration?[]:visible.map(m=>({...m,actions:[],href:m.practice?attendance:modulesUrl?modulesUrl+'/#'+m.id:''})).filter(m=>m.href),
  unavailableModules:enabled.schoolAdministration?visible.map(m=>m.title):[],history:!enabled.schoolAdministration&&has('admin')};
}
module.exports={practiceHub,liveHub};
