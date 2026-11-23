const test=require('node:test'),assert=require('node:assert/strict');const {legacyRoutes,dispositions}=require('../scripts/auditRouteBoundaries');
test('every declared legacy API is excluded from the canonical runtime, including actual write and login paths',async t=>{
 const {serve}=require('./helpers/http'),{createSchoolApp}=require('../scripts/canonicalSchool');
 const identity={resolveSession:async()=>null},database={connect(){throw Error('Unexpected SQL');}};
 const base=await serve(t,createSchoolApp(database,{identityService:identity,personnelWrites:true,academicWrites:true,auxiliaryWrites:true,membershipInvitations:true,academicLinks:true,staffAccounts:true}));
 const routes=legacyRoutes().filter(r=>r.path.startsWith('/api/'));assert.ok(routes.length>70);
 for(const route of routes){const requestPath=route.path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g,'1'),response=await fetch(base+requestPath,{method:route.method,headers:{Origin:'https://localhost:2027','Content-Type':'application/json'},...(!['GET','HEAD'].includes(route.method)?{body:'{}'}:{})});assert.equal(response.status,404,route.method+' '+route.path);}
});
// The ledger describes the staged two-server (M1) migration mode, so it is
// verified against that policy explicitly rather than the shipped single-app policy.
const shippedPolicy=require('../config/runtimePolicy.json');
const m1Policy=Object.fromEntries(Object.entries(shippedPolicy).map(([k,v])=>[k,/^(canonical|legacyScoped)/.test(k)?true:v]));

test('shipped single-application policy keeps marks writable on the main app',()=>{
 for(const [key,value] of Object.entries(shippedPolicy))if(/^(canonical|legacyScoped)/.test(key))assert.equal(value,false,key);
 const marks=dispositions(legacyRoutes(),shippedPolicy).filter(r=>r.path.startsWith('/api/v1/marks'));assert.ok(marks.length);
 for(const r of marks)assert.notEqual(r.gates.admin,'moved_409',r.method+' '+r.path);
});

test('source-derived boundary ledger records retained admin tools as unresolved rather than certifying tenancy',()=>{
 const rows=dispositions(legacyRoutes(),m1Policy);
 const report=rows.find(r=>r.path.startsWith('/api/v1/report-cards')&&r.method==='GET');assert.ok(report);assert.equal(report.auth,'admin');assert.equal(report.gates.admin,'downstream_auth_required');assert.equal(report.gates.teacher,'moved_409');
 const marks=rows.filter(r=>r.path.startsWith('/api/v1/marks'));assert.ok(marks.length);for(const r of marks)assert.equal(r.gates.admin,'moved_409');
 assert.equal(rows.filter(r=>r.dataBoundary==='legacy-exam-results-scoped').length,3);
 assert.equal(rows.filter(r=>r.dataBoundary==='legacy-personnel-reads-scoped').length,9);
 assert.equal(rows.filter(r=>r.dataBoundary==='legacy-reference-reads-scoped').length,14);
 assert.equal(rows.filter(r=>r.dataBoundary==='legacy-report-reads-scoped').length,1);
 assert.equal(rows.filter(r=>r.dataBoundary==='legacy-self-reads-scoped').length,2);
 assert.equal(rows.filter(r=>r.dataBoundary==='legacy-allocation-reads-scoped').length,3);
 assert.equal(rows.filter(r=>r.dataBoundary==='legacy-timetable-scoped').length,8);
});

test('fully activated M1 policy has an explicit boundary for every retained authenticated API declaration',()=>{
 const rows=dispositions(legacyRoutes(),m1Policy);
 // Added after the M1 inventory was frozen, for the single-application deployment.
 const postM1=new Set(['POST /api/v1/parents/admin/link','GET /api/v1/students/my-scores']);
 const postM1Modules=['/api/v1/staff-duties','/api/v1/attendance','/api/v1/library'];
 for(const route of rows){if(!route.path.startsWith('/api/')||!['admin','teacher','student','any-account'].includes(route.auth)||postM1.has(route.method+' '+route.path)||postM1Modules.some(p=>route.path.startsWith(p)))continue;
  const role=route.auth==='any-account'?'admin':route.auth;
  if(route.gates[role]==='downstream_auth_required')assert.notEqual(route.dataBoundary,'not-assessed-by-this-inventory',route.method+' '+route.path);
 }
});
