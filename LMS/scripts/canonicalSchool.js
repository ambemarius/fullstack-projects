const {pageDenied}=require('../utils/pageError');
const fs=require('node:fs');const path=require('node:path');const https=require('node:https');const express=require('express');
const {createDatabase,sql}=require('../config/database');const {loadEnvironment}=require('../config/environment');
const {createApp}=require('../app/app');const {createIdentityService}=require('../model/identity/identityService');
const {createIdentityRouter}=require('../routes/identity/identityRouter');const {createScopedPersonnelRouter}=require('../routes/identity/personnelRouter');
const {createScopedAcademicRouter}=require('../routes/identity/academicSetupRouter');const {createReferenceRouter}=require('../routes/identity/referenceRouter');
const {readSessionToken}=require('../middlewares/canonicalSession');
const {createAuxiliaryRouter}=require('../routes/identity/auxiliaryRouter');
const {createMembershipInvitationRouter}=require('../routes/identity/membershipInvitationRouter');
const {createScopedAcademicLinksRouter}=require('../routes/identity/academicLinksRouter');const {createScopedMarksRouter}=require('../routes/identity/marksRouter');
const ORIGIN='https://localhost:2027';
function guardedIdentity(database,{staffAccounts=false}={}){
 const service=createIdentityService(database);const resolve=service.resolveSession;
 service.resolveSession=async token=>{
  const identity=await resolve(token);if(!identity?.schoolId)return null;
  const matches=await database.getPool().request().input('account',sql.Int,identity.accountId).input('school',sql.Int,identity.schoolId).query(`
   SELECT m.account_id FROM dbo.legacy_account_map m JOIN dbo.accounts a ON a.id=m.account_id
   JOIN dbo.Admins p ON m.source_table='Admins' AND p.id=m.legacy_id
   WHERE m.account_id=@account AND m.school_id=@school AND p.school_id=@school AND LOWER(LTRIM(RTRIM(p.role)))='admin'
    AND a.password_hash COLLATE Latin1_General_100_BIN2=p.password COLLATE Latin1_General_100_BIN2
   UNION ALL SELECT m.account_id FROM dbo.legacy_account_map m JOIN dbo.accounts a ON a.id=m.account_id
   JOIN dbo.teachers p ON m.source_table='teachers' AND p.id=m.legacy_id
   WHERE m.account_id=@account AND m.school_id=@school AND p.school_id=@school AND p.role='teacher' AND p.status='active'
    AND a.password_hash COLLATE Latin1_General_100_BIN2=p.password COLLATE Latin1_General_100_BIN2
   UNION ALL SELECT m.account_id FROM dbo.legacy_account_map m JOIN dbo.accounts a ON a.id=m.account_id
   JOIN dbo.students p ON m.source_table='students' AND p.id=m.legacy_id
   WHERE m.account_id=@account AND m.school_id=@school AND p.school_id=@school AND p.role='student' AND p.isWithdrawn=0
    AND a.password_hash COLLATE Latin1_General_100_BIN2=p.password COLLATE Latin1_General_100_BIN2;`);
  return matches.recordset.length===1?identity:null;
 };
 for(const method of ['login','loginSchoolIdentity']){const login=service[method];service[method]=async(...args)=>{
  const session=await login(...args);if(!await service.resolveSession(session.token)){await service.revokeSession(session.token);throw Object.assign(new Error('Access denied'),{statusCode:403});}return session;
 };}
 if(staffAccounts){service.staffCoreResolve=resolve;require('../model/identity/staffIdentity').enableStaffIdentity(service,database);}
 return service;
}
function createSchoolApp(database,{identityService,personnelWrites=false,academicWrites=false,auxiliaryWrites=false,membershipInvitations=false,academicLinks=false,staffAccounts=false,schoolAdministration=false,academicHistoryReview=false}={}){
 identityService??=guardedIdentity(database,{staffAccounts});
 if(academicWrites&&!personnelWrites)throw new Error('Academic workspace requires personnel context');
 if(academicHistoryReview&&!personnelWrites)throw new Error('Academic history review requires registration');
 if(auxiliaryWrites&&!personnelWrites)throw new Error('Auxiliary workspace requires personnel context');
 if(academicLinks&&(!academicWrites||!personnelWrites))throw new Error('Course workspace requires scoped academic and personnel context');
 const pages=express.Router();pages.get('/',(_req,res)=>res.render('canonical-school',{personnelEnabled:personnelWrites,academicEnabled:academicWrites,auxiliaryEnabled:auxiliaryWrites,invitationsEnabled:membershipInvitations,coursesEnabled:academicLinks,staffAccountsEnabled:staffAccounts}));
 const schoolHub=require('../model/identity/schoolHubService').createSchoolHubService(database,identityService,
  {personnelWrites,academicWrites,auxiliaryWrites,membershipInvitations,academicLinks,staffAccounts,schoolAdministration});
 pages.get('/school',async(req,res)=>{
  const hub=await schoolHub(readSessionToken(req));
  if(!hub)return res.redirect('/?next=school');
  res.render('school-practice',{hub});
 });
 if(staffAccounts)pages.get('/staff-accounts',(_req,res)=>res.render('canonical-staff-accounts',{schoolAdministration}));
 if(academicLinks)pages.get('/courses',async(req,res)=>{const identity=await identityService.resolveSession(readSessionToken(req));if(!identity)return res.redirect('/?next=courses');if(!identity.roles.some(role=>['admin','teacher','student'].includes(role)))return pageDenied(req,res,403,'A school account is required.');res.render('canonical-courses');});
 if(membershipInvitations)pages.get('/invitations',async(req,res)=>{
  const identity=await identityService.resolveSession(readSessionToken(req));if(!identity)return res.redirect('/?next=invitations');
  if(!identity.roles.some(role=>['admin','teacher'].includes(role)))return pageDenied(req,res,403,'An existing staff account is required.');res.render('canonical-invitations');
 });
 if(auxiliaryWrites)pages.get('/auxiliary',async(req,res)=>{
  const identity=await identityService.resolveSession(readSessionToken(req));if(!identity)return res.redirect('/?next=auxiliary');
  if(!identity.roles.includes('admin'))return pageDenied(req,res,403,'A school administrator account is required.');res.render('canonical-auxiliary');
 });
 if(academicWrites)pages.get('/academic',async(req,res)=>{
  const kind=['class','subject','year'].includes(req.query.kind)?req.query.kind:'year';
  const identity=await identityService.resolveSession(readSessionToken(req));
  if(!identity)return res.redirect('/?next=academic&kind='+kind);
  if(!identity.roles.includes('admin'))return pageDenied(req,res,403,'A school administrator account is required.');
  res.render('canonical-academic');
 });
 if(personnelWrites)pages.get('/registration',async(req,res)=>{
  const identity=await identityService.resolveSession(readSessionToken(req));
  if(!identity)return res.redirect('/?next=registration');
  if(!identity.roles.includes('admin'))return pageDenied(req,res,403,'A school administrator account is required.');
  res.render('m1-original-registration',{sampleEnvironment:false,academicHistoryReview,placementReview:academicHistoryReview});
 });
 const identity=express.Router();
 identity.use((req,res,next)=>{
  const allowed={'POST /login':true,'GET /session':true,'GET /memberships':true,'POST /csrf':true,'POST /logout':true};
  if(staffAccounts)allowed['POST /switch-school']=true;
  if(!allowed[`${req.method} ${req.path}`])return res.status(404).json({message:'Not available in this workspace'});
  if(req.method==='POST'&&req.path==='/switch-school'&&req.body?.schoolCode!=='LYCEE_BATOURI')return res.status(422).json({message:'Another school is not yet enabled in this workspace'});
  if(req.method==='POST'&&req.path==='/login'&&(req.body?.schoolCode!=='LYCEE_BATOURI'||![...['admin','teacher','student'],...(staffAccounts?['staff']:[])].includes(req.body?.accountType)))return res.status(422).json({message:'Use LYCEE_BATOURI and select your account type'});
  next();
 });
 // School UI receives only its active institution, never provider authority or
 // another institution's membership directory. Core services retain real checks.
 const schoolIdentity=schoolAdministration?{...identityService,
  resolveSession:async token=>{const actor=await identityService.resolveSession(token);return actor?{...actor,platformPermissions:[]}:null;},
  memberships:async token=>{const actor=await identityService.resolveSession(token);if(!actor)throw Object.assign(new Error('Access denied'),{statusCode:403});return (await identityService.memberships(token)).filter(row=>row.schoolId===actor.schoolId&&row.membershipId===actor.membershipId);}
 }:identityService;
 identity.use(createIdentityRouter({service:schoolIdentity,publicOrigin:ORIGIN}));
 const personnel=express.Router();personnel.use((req,res,next)=>{
  if(!personnelWrites&&!['GET /students','GET /teachers'].includes(`${req.method} ${req.path}`))return res.status(405).json({message:'This workspace is read-only'});next();
 });personnel.use(createScopedPersonnelRouter({identityService,database,publicOrigin:ORIGIN}));
 const routes=[['/',pages],['/api/identity',identity],['/api/personnel',personnel]];
 if(academicHistoryReview)routes.push(['/api/academic-history',require('../routes/identity/academicHistoryReviewRouter').createAcademicHistoryReviewRouter({identityService,database,publicOrigin:ORIGIN})]);
 if(staffAccounts)routes.push(['/api/staff-accounts',require('../routes/identity/staffAccountsRouter').createStaffAccountsRouter({identityService,database,publicOrigin:ORIGIN,schoolCode:'LYCEE_BATOURI',schoolAdministration})]);
 if(academicLinks)routes.push(['/api/links',createScopedAcademicLinksRouter({identityService,database,publicOrigin:ORIGIN})],['/api/marks',createScopedMarksRouter({identityService,database,publicOrigin:ORIGIN})]);
 if(membershipInvitations){const invitations=createMembershipInvitationRouter({identityService,database,publicOrigin:ORIGIN,requireSchoolProfile:true,schoolCode:'LYCEE_BATOURI'});
  if(schoolAdministration){const acceptOnly=express.Router();acceptOnly.use((req,res,next)=>req.method==='POST'&&req.path==='/accept-existing-admin'?next():res.status(404).json({message:'Use school account management'}));acceptOnly.use(invitations);routes.push(['/api/membership-invitations',acceptOnly]);}
  else routes.push(['/api/membership-invitations',invitations]);}
 if(auxiliaryWrites)routes.push(['/api/auxiliary',createAuxiliaryRouter({identityService,database,publicOrigin:ORIGIN,staffAccounts})]);
 if(personnelWrites){const setup=express.Router();setup.use((req,res,next)=>{
  if(!academicWrites&&(req.method!=='GET'||!['/academic-years','/classes'].includes(req.path)))return res.status(405).json({message:'Academic changes are not enabled here'});next();
 });setup.use(createScopedAcademicRouter({identityService,database,publicOrigin:ORIGIN}));
 routes.push(['/api/setup',setup],['/api/reference',createReferenceRouter({identityService,database})]);}
 return createApp({logging:false,requestContext:(_req,res,next)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');next();
 },routes});
}
async function readiness(database,{personnelWrites=false,academicWrites=false,auxiliaryWrites=false,academicLinks=false,staffAccounts=false}={}){
 await database.connect();const state=(await database.getPool().request().query("SELECT DB_NAME() name,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server")).recordset[0];
 if(state.name!=='schooldb'||state.server.toUpperCase()!=='MARIUS\\DEV')throw new Error('Wrong real-school database');
 const files=require('./migrate').migrationFiles();const history=(await database.getPool().request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
 if(JSON.stringify(history.map(r=>[r.version,r.checksum]))!==JSON.stringify(files.map(f=>[f.name,f.checksum])))throw new Error('Schema history mismatch');
 const school=(await database.getPool().request().query("SELECT id FROM dbo.schools WHERE code='LYCEE_BATOURI' AND name=N'LYCEE BATOURI' AND status='active'; SELECT id FROM dbo.legacy_adoption_runs;")).recordsets;
 if(school[0].length!==1||school[1].length!==1)throw new Error('School adoption missing');
 if(personnelWrites)await require('./personnelActivationReadiness').personnelActivationReadiness(database);
 if(staffAccounts){const state=(await database.getPool().request().query(`SELECT OBJECT_ID('dbo.staff_profile_links') id,(SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('dbo.staff_profile_links') AND (is_disabled=1 OR is_not_trusted=1)) bad;
 SELECT COUNT(*) bad FROM (SELECT p.school_id,p.email FROM dbo.staff_profile_links l JOIN dbo.auxiliary_staff p ON p.school_id=l.school_id AND p.id=l.auxiliary_profile_id WHERE l.link_status='active' AND p.status='active' GROUP BY p.school_id,p.email HAVING COUNT(*)>1) duplicate_logins;`)).recordsets;if(!state[0][0].id||state[0][0].bad||state[1][0].bad)throw Error('Staff account schema or identifiers require review');}
 if(auxiliaryWrites){const unowned=(await database.getPool().request().query("SELECT COUNT(*) count FROM dbo.auxiliary_staff WHERE school_id IS NULL OR school_id<>(SELECT id FROM dbo.schools WHERE code='LYCEE_BATOURI')")).recordset[0].count;if(Number(unowned)!==0)throw new Error('Auxiliary ownership requires review');}
 if(academicLinks){const unowned=(await database.getPool().request().query(`SELECT COUNT(*) count FROM (
  SELECT school_id FROM dbo.class_subjects UNION ALL SELECT school_id FROM dbo.class_subject_students UNION ALL SELECT school_id FROM dbo.class_subject_teachers UNION ALL SELECT school_id FROM dbo.subject_scores
  ) p WHERE p.school_id IS NULL OR p.school_id<>(SELECT id FROM dbo.schools WHERE code='LYCEE_BATOURI')`)).recordset[0].count;if(Number(unowned)!==0)throw new Error('Academic-link ownership requires review');}
 if(academicWrites){
  const unresolved=(await database.getPool().request().query(`SELECT COUNT(*) count FROM (
   SELECT school_id FROM dbo.classes UNION ALL SELECT school_id FROM dbo.subjects UNION ALL SELECT school_id FROM dbo.academic_years
   ) p WHERE p.school_id IS NULL OR p.school_id<>(SELECT id FROM dbo.schools WHERE code='LYCEE_BATOURI')`)).recordset[0].count;
  if(Number(unresolved)!==0)throw new Error('Academic ownership requires review');
 }
}
async function main(){loadEnvironment();const database=createDatabase();const policy=require('../config/runtimePolicy.json');const personnelWrites=policy.canonicalPersonnelWrites===true,academicWrites=policy.canonicalAcademicWrites===true,auxiliaryWrites=policy.canonicalAuxiliaryWrites===true,membershipInvitations=policy.canonicalMembershipInvitations===true,academicLinks=policy.canonicalAcademicLinks===true,staffAccounts=policy.canonicalStaffAccounts===true;try{await readiness(database,{personnelWrites,academicWrites,auxiliaryWrites,academicLinks,staffAccounts});
 const directory=path.join(__dirname,'../backups/runtime');
 const server=https.createServer({key:fs.readFileSync(path.join(directory,'tls/localhost.key')),cert:fs.readFileSync(path.join(directory,'tls/localhost.crt'))},createSchoolApp(database,{personnelWrites,academicWrites,auxiliaryWrites,membershipInvitations,academicLinks,staffAccounts,schoolAdministration:policy.canonicalSchoolAdministration===true,academicHistoryReview:policy.canonicalAcademicHistoryReview===true}));
 server.listen(2027,'127.0.0.1',()=>console.log(`LYCEE BATOURI workspace: https://localhost:2027 (${personnelWrites?'personnel workflows':'read-only'})`));
 server.on('error',async()=>{console.error('Canonical server failed; credentials withheld');await database.close();process.exitCode=1;});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>database.close()));
 }catch(error){await database.close();throw error;}
}
if(require.main===module)main().catch(()=>{console.error('Canonical startup refused; verify original database adoption and TLS configuration');process.exitCode=1;});
module.exports={createSchoolApp,guardedIdentity,readiness};
