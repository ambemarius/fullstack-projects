// Presentation only: destinations retain their existing authorisation.
const roleNames={admin:'Administrator',teacher:'Teacher',student:'Pupil',bursar:'Bursar / cashier',librarian:'Librarian',lab_attendant:'Laboratory attendant',discipline_master:'Discipline master'};
const modules=[
 {id:'finance',icon:'wallet',title:'Financial management',description:'Pupil charges, payments and receipts. Keep collections and outstanding balances in view.',roles:['admin','bursar'],actions:[['finance','Administrator'],['cashier','Bursar / cashier']]},
 {id:'library',icon:'book',title:'Library',description:'Find books, manage lending and renewals, and follow each copy through its return.',roles:['librarian'],actions:[['library','Librarian']]},
 {id:'laboratory',icon:'flask',title:'Laboratory',description:'Manage equipment and stock, review requests, and record issues and returns.',roles:['lab_attendant','teacher'],actions:[['laboratory','Laboratory attendant'],['requests','Teacher']]},
 {id:'attendance',icon:'calendar',title:'Attendance',description:'Open a dated class register, record attended periods and review corrections.',roles:['discipline_master'],href:'https://localhost:2029'}
];
function practiceHub(accounts){
 return {practice:true,schoolName:'Practice workspaces',roleLabel:'Practice visitor',yearLabel:'Academic year varies by workspace',groups:[],
  modules:modules.map(m=>({...m,actions:(m.actions||[]).filter(([area])=>accounts[area])})).filter(m=>m.href||m.actions.length),history:true};
}
function liveHub(identity,school,years,enabled){
 const has=(...roles)=>roles.some(r=>identity.roles.includes(r));
 const groups=[
  {title:'People',icon:'people',items:[
   has('admin')&&enabled.personnelWrites&&['Pupils and teachers','Registration and profiles','/registration'],
   has('admin')&&enabled.auxiliaryWrites&&['Auxiliary staff','School support team','/auxiliary']]},
  {title:'Academics',icon:'book',items:[
   has('admin')&&enabled.academicWrites&&['Classes, subjects and years','Academic setup','/academic'],
   has('admin','teacher','student')&&enabled.academicLinks&&['Courses, marks and timetables','Your academic workspace','/courses'],
   has('admin')&&['Administrator timetable','Original school application','http://localhost:2026/timetable']]},
  {title:'Administration',icon:'shield',items:[
   has('admin')&&enabled.staffAccounts&&['Staff accounts and recovery','Access and account support','/staff-accounts'],
   !enabled.schoolAdministration&&has('admin','teacher')&&enabled.membershipInvitations&&['Administrator invitations','Accept a school invitation','/invitations'],
   has('admin')&&['Dashboard and reports','Original school application','http://localhost:2026/admin-dashboard']]}
 ].map(g=>({...g,items:g.items.filter(Boolean)})).filter(g=>g.items.length);
 return {practice:false,schoolName:school.name,roleLabel:identity.roles.map(r=>roleNames[r]||'School staff').join(' · '),
  yearLabel:years.length===1?'Academic year '+years[0].name:years.length?'Academic year needs review':'No current academic year set',groups,
  modules:enabled.schoolAdministration?[]:modules.filter(m=>has(...m.roles)).map(m=>({...m,actions:[],href:m.href||'https://localhost:2030/#'+m.id})),
  unavailableModules:enabled.schoolAdministration?modules.filter(m=>has(...m.roles)).map(m=>m.title):[],history:!enabled.schoolAdministration&&has('admin')};
}
module.exports={practiceHub,liveHub};
