const test=require('node:test'),assert=require('node:assert/strict');const {legacyRoutes,dispositions}=require('../scripts/auditRouteBoundaries');
test('every declared legacy API is excluded from the canonical runtime, including actual write and login paths',async t=>{
 const {serve}=require('./helpers/http'),{createSchoolApp}=require('../scripts/canonicalSchool');
 const identity={resolveSession:async()=>null},database={connect(){throw Error('Unexpected SQL');}};
 const base=await serve(t,createSchoolApp(database,{identityService:identity,personnelWrites:true,academicWrites:true,auxiliaryWrites:true,membershipInvitations:true,academicLinks:true,staffAccounts:true}));
 const routes=legacyRoutes().filter(r=>r.path.startsWith('/api/'));assert.ok(routes.length>70);
 for(const route of routes){const requestPath=route.path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g,'1'),response=await fetch(base+requestPath,{method:route.method,headers:{Origin:'https://localhost:2027','Content-Type':'application/json'},...(!['GET','HEAD'].includes(route.method)?{body:'{}'}:{})});assert.equal(response.status,404,route.method+' '+route.path);}
});
test('source-derived boundary ledger records retained admin tools as unresolved rather than certifying tenancy',()=>{
 const rows=dispositions(legacyRoutes(),require('../config/runtimePolicy.json'));
 const report=rows.find(r=>r.path.startsWith('/api/v1/report-cards')&&r.method==='GET');assert.ok(report);assert.equal(report.auth,'admin');assert.equal(report.gates.admin,'downstream_auth_required');assert.equal(report.gates.teacher,'moved_409');
 const marks=rows.filter(r=>r.path.startsWith('/api/v1/marks'));assert.ok(marks.length);for(const r of marks)assert.equal(r.gates.admin,'moved_409');
 if(require('../config/runtimePolicy.json').legacyScopedExamResults)assert.equal(rows.filter(r=>r.dataBoundary==='legacy-exam-results-scoped').length,3);
 if(require('../config/runtimePolicy.json').legacyScopedPersonnelReads)assert.equal(rows.filter(r=>r.dataBoundary==='legacy-personnel-reads-scoped').length,9);
 if(require('../config/runtimePolicy.json').legacyScopedReferences)assert.equal(rows.filter(r=>r.dataBoundary==='legacy-reference-reads-scoped').length,14);
 if(require('../config/runtimePolicy.json').legacyScopedReports)assert.equal(rows.filter(r=>r.dataBoundary==='legacy-report-reads-scoped').length,1);
 if(require('../config/runtimePolicy.json').legacyScopedSelf)assert.equal(rows.filter(r=>r.dataBoundary==='legacy-self-reads-scoped').length,2);
 if(require('../config/runtimePolicy.json').legacyScopedAllocations)assert.equal(rows.filter(r=>r.dataBoundary==='legacy-allocation-reads-scoped').length,3);
 if(require('../config/runtimePolicy.json').legacyScopedTimetables)assert.equal(rows.filter(r=>r.dataBoundary==='legacy-timetable-scoped').length,8);
});

test('fully activated M1 policy has an explicit boundary for every retained authenticated API declaration',()=>{
 const policy={...require('../config/runtimePolicy.json'),legacyScopedReferences:true,legacyScopedReports:true,legacyScopedSelf:true};
 const rows=dispositions(legacyRoutes(),policy);
 for(const route of rows){if(!route.path.startsWith('/api/')||!['admin','teacher','student','any-account'].includes(route.auth))continue;
  const role=route.auth==='any-account'?'admin':route.auth;
  if(route.gates[role]==='downstream_auth_required')assert.notEqual(route.dataBoundary,'not-assessed-by-this-inventory',route.method+' '+route.path);
 }
});
