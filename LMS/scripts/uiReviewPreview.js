// Database-free visual fixtures only. Not mounted in any application runtime.
// No authentication/API routes, credentials or form submissions are available here.
const express=require('express');
const {createApp}=require('../app/app');
function adminNavigationSource(){
 const source=require('node:fs').readFileSync(require.resolve('../public/js/admin-layout.js'),'utf8');
 const ranges=[['  // ----- Tab switching -----','  // ----- Logout -----'],['  // ===== REGISTRATION: SUB-TAB SWITCHING =====','  // ===== STUDENT: Load'],['  // ----- Restore tab from sessionStorage','  function gradeFromScore'],['// ===== EVALUATION: SUB-TAB SWITCHING =====','  // ===== EVALUATION: SHARED LOADERS']];
 return '(()=>{'+ranges.map(([start,end])=>{const a=source.indexOf(start),b=source.indexOf(end);if(a<0||b<=a)throw Error('Review navigation boundaries changed');return source.slice(a,b);}).join('\n')+'})();';
}
const pages=['landing','login','admin-layout','m1-original-registration','canonical-school','canonical-academic','canonical-auxiliary','canonical-courses','canonical-invitations','canonical-staff-accounts','m1-preview','attendance','teachers','students','subjects','allocations','timetable','timetable-teacher','timetable-student','teacher-dashboard','student-dashboard','promotion','page-error'];
function createUiReviewApp(){
 const routes=express.Router();
 // Only the source navigation blocks: no login, data loaders, logout or mutations.
 routes.get('/review-admin-navigation.js',(_req,res)=>res.type('js').send(adminNavigationSource()));
 routes.get('/',(_req,res)=>res.type('html').send('<!doctype html><html lang="en"><title>UI review fixtures</title><h1>UI review — fictional layouts only</h1><ul>'+pages.map(p=>'<li><a href="/review/'+p+'">'+p+'</a></li>').join('')+'</ul></html>'));
 routes.get('/review/:page',(req,res)=>{
  if(!pages.includes(req.params.page))return res.sendStatus(404);
  res.render(req.params.page,{...(req.params.page==='page-error'?require('../utils/pageError').errorPageModel([403,404,500].includes(Number(req.query.status))?Number(req.query.status):404,'FICTIONAL-REVIEW-REFERENCE'):{}),sampleEnvironment:true,academicHistoryReview:true,placementReview:true,enrolmentLedgerEnabled:true,currentTransfers:true,pupilLifecycle:true,yearOfferings:true,
   personnelEnabled:true,academicEnabled:true,auxiliaryEnabled:true,invitationsEnabled:true,coursesEnabled:true,staffAccountsEnabled:true,
   canonicalPersonnelEnabled:true,canonicalAcademicEnabled:true,canonicalAuxiliaryEnabled:true,canonicalAcademicLinksEnabled:true},(error,html)=>{
   if(error)return res.status(500).send('Fixture rendering failed');
   // Load only the presentation enhancement. Never run real authentication/business clients.
   html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</head>','<script defer src="/js/workspace-ui.js"></script><script defer src="/js/form-feedback.js"></script></head>');
   if(req.params.page==='admin-layout'&&req.query.navigation==='1')html=html.replace('</body>','<script src="/review-admin-navigation.js"></script></body>');
   html=html.replace(/(id="(?:registrationWorkspace|workspace|operator|admin|enrolmentHistory)") hidden/g,'$1');
   if(req.query.kind==='teacher')html=html.replace('class="reg-subpanel active" id="sub-student"','class="reg-subpanel" id="sub-student"').replace('class="reg-subpanel" id="sub-teacher"','class="reg-subpanel active" id="sub-teacher"');
   if(['registration','evaluation','personnel','finance'].includes(req.query.tab))html=html.replace('class="tab-panel active" id="tab-home"','class="tab-panel" id="tab-home"').replace('class="tab-panel" id="tab-'+req.query.tab+'"','class="tab-panel active" id="tab-'+req.query.tab+'"');
   const subGroups={registration:['student','teacher','subject','classes','auxiliary','academic-years'],evaluation:['marks','course-review','report-cards']};
   const group=subGroups[req.query.tab];
   if(req.params.page==='admin-layout'&&group?.includes(req.query.sub)){
    for(const sub of group)html=html.replace('class="reg-subpanel active" id="sub-'+sub+'"','class="reg-subpanel" id="sub-'+sub+'"');
    html=html.replace('class="reg-subpanel" id="sub-'+req.query.sub+'"','class="reg-subpanel active" id="sub-'+req.query.sub+'"');
   }
   html=html.replace(/<body([^>]*)>/,'<body$1><div class="ui-fixture-note" role="note">Visual review only · Fictional layout · Forms do not save</div>');
   res.send(html);
  });
 });
 return createApp({logging:false,routes:[['/',routes]]});
}
if(require.main===module){const server=createUiReviewApp().listen(2031,'127.0.0.1',()=>console.log('Database-free UI review ready at http://localhost:2031/'));
 process.on('SIGINT',()=>server.close(()=>process.exit()));}
module.exports={createUiReviewApp,pages};
