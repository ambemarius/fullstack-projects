const fs=require('node:fs');
const path=require('node:path');
const https=require('node:https');
const crypto=require('node:crypto');
const bcrypt=require('bcrypt');
const express=require('express');
const {loadTestEnvironment,assertSyntheticDatabase}=require('./testEnvironment');
const {createDatabase,sql}=require('../config/database');
const {createIdentityService}=require('../model/identity/identityService');
const {createSchoolAccess}=require('../model/identity/schoolAccess');
const {createPersonnelService}=require('../model/identity/personnelService');
const {createAcademicSetupService}=require('../model/identity/academicSetupService');
const {createAcademicLinksService}=require('../model/identity/academicLinksService');
const {createIdentityRouter}=require('../routes/identity/identityRouter');
const {createScopedPersonnelRouter}=require('../routes/identity/personnelRouter');
const {createScopedAcademicRouter}=require('../routes/identity/academicSetupRouter');
const {createScopedAcademicLinksRouter}=require('../routes/identity/academicLinksRouter');
const {createScopedMarksRouter}=require('../routes/identity/marksRouter');
const {createReferenceRouter}=require('../routes/identity/referenceRouter');
const {originGuard,readSessionToken,COOKIE}=require('../middlewares/canonicalSession');
const {createApp}=require('../app/app');

async function sampleAccounts(db,directory) {
    await assertSyntheticDatabase(db);
    const filename=path.join(directory,'m1-preview-private.json');
    if(fs.existsSync(filename)) {
        const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
        if(saved.format!=='m1-synthetic-preview-v1') throw new Error('Preview evidence invalid');
        for(const school of saved.schools) {
            const found=(await db.getPool().request().input('id',sql.Int,school.id).input('code',sql.NVarChar(50),school.code)
                .query("SELECT id FROM dbo.schools WHERE id=@id AND code=@code AND status='active'")).recordset;
            if(found.length!==1) throw new Error('Preview school changed; review rather than reseed');
        }
        return saved;
    }
    const conflicts=(await db.getPool().request().query("SELECT id FROM dbo.schools WHERE code IN('M1_DEMO_A','M1_DEMO_B')")).recordset;
    if(conflicts.length) throw new Error('Preview schools already exist without private evidence; stop for review');
    const saved={format:'m1-synthetic-preview-v1',schools:[],accounts:[]};
    const identity=createIdentityService(db),access=createSchoolAccess(identity),people=createPersonnelService(access,db),setup=createAcademicSetupService(access,db),links=createAcademicLinksService(access,db);
    for(const [code,name] of [['M1_DEMO_A','Maplewood Sample School'],['M1_DEMO_B','Riverside Sample School']]) {
        const password=crypto.randomBytes(24).toString('base64url'),loginKey=`${code.toLowerCase()}.admin@example.invalid`;
        const hash=await bcrypt.hash(password,12);
        const ids=(await db.getPool().request().input('code',sql.NVarChar(50),code).input('name',sql.NVarChar(200),name)
            .input('login',sql.NVarChar(255),loginKey).input('hash',sql.NVarChar(255),hash).query(`
                INSERT dbo.schools(code,name,education_system,status) VALUES(@code,@name,'Bilingual','active');DECLARE @school INT=SCOPE_IDENTITY();
                INSERT dbo.accounts(login_key,password_hash,status) VALUES(@login,@hash,'active');DECLARE @account INT=SCOPE_IDENTITY();
                INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@account,'active');DECLARE @membership INT=SCOPE_IDENTITY();
                INSERT dbo.membership_roles VALUES(@school,@membership,'admin');SELECT @school AS school,@account AS account,@membership AS membership;
            `)).recordset[0];
        saved.schools.push({id:ids.school,code,name});saved.accounts.push({schoolCode:code,role:'admin',identifier:loginKey,loginKey,password,accountId:ids.account});
        const session=await identity.login(loginKey,password,code),context=await access.resolve(session.token);
        const year=await setup.create(context,'year',{fromYear:2026,toYear:2027,isCurrent:true});
        const classroom=await setup.create(context,'class',{section:'Anglophone',name:'Form 1',stream:'Normal',rank:1});
        const subject=await setup.create(context,'subject',{name:'Mathematics',code:'MATH',coefficient:2});
        const offering=await links.createOffering(context,{classId:classroom.id,subjectId:subject.id,coefficient:2});
        for(const role of ['teacher','student']) {
            const secret=crypto.randomBytes(24).toString('base64url');
            const identifier=role==='teacher'?`${code.toLowerCase()}.teacher@example.invalid`:'DEMO-001';
            const profile=await people.register(context,role,role==='teacher'?{firstName:'Sample',lastName:code.endsWith('A')?'Teacher A':'Teacher B',email:identifier,employmentType:'Part-time',section:'Anglophone',password:secret}:
                {firstName:'Sample',lastName:code.endsWith('A')?'Pupil A':'Pupil B',matricule:identifier,section:'Anglophone',sex:'Female',password:secret});
            const mapped=(await db.getPool().request().input('id',sql.Int,profile.id).input('source',sql.VarChar(20),role==='teacher'?'teachers':'students')
                .query('SELECT a.login_key,l.account_id FROM dbo.legacy_account_map l JOIN dbo.accounts a ON a.id=l.account_id WHERE l.source_table=@source AND l.legacy_id=@id')).recordset[0];
            saved.accounts.push({schoolCode:code,role,identifier,loginKey:mapped.login_key,password:secret,accountId:mapped.account_id});
            if(role==='student') {
                // Explicit fictional present-day placement; no actual legacy/history backfill.
                await db.getPool().request().input('student',sql.Int,profile.id).input('class',sql.Int,classroom.id).input('year',sql.Int,year.id)
                    .query('UPDATE dbo.students SET currentClassLevel=@class,academicYearId=@year WHERE id=@student');
                await links.enrol(context,{offeringId:offering.id,yearId:year.id,changes:[{studentId:profile.id,action:'enrol',version:0}]});
            } else await links.assign(context,{offeringId:offering.id,yearId:year.id,teacherId:profile.id,term:'First',action:'assign',version:0});
        }
        await identity.revokeSession(session.token);
    }
    const adminA=saved.accounts.find(row=>row.role==='admin'&&row.schoolCode==='M1_DEMO_A');
    const schoolB=saved.schools.find(row=>row.code==='M1_DEMO_B');
    await db.getPool().request().input('account',sql.Int,adminA.accountId).input('school',sql.Int,schoolB.id).query(`
        INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@account,'active');DECLARE @m INT=SCOPE_IDENTITY();
        INSERT dbo.membership_roles VALUES(@school,@m,'admin');`);
    fs.writeFileSync(filename,JSON.stringify(saved),{flag:'wx'});
    return saved;
}
function createPreviewApp(db,samples,publicOrigin,{enrolmentLedger=false,currentTransfers=false,pupilLifecycle=false,yearOfferings=false,yearArchive=false}={}) {
    if(pupilLifecycle&&!currentTransfers)throw Error('Pupil status requires the placement workspace');
    if(currentTransfers&&!enrolmentLedger)throw Error('Current transfers require the enrolment ledger');
    if(yearOfferings&&!enrolmentLedger)throw Error('Year coverage requires the enrolment ledger');
    if(yearArchive&&!(yearOfferings&&pupilLifecycle))throw Error('Year archive requires the full placement workspace');
    const identity=createIdentityService(db),preview=express.Router();
    preview.get('/',(_req,res)=>res.render('m1-preview',{yearOfferings}));
    preview.get('/registration',(_req,res)=>res.render('m1-original-registration',{enrolmentLedgerEnabled:enrolmentLedger,currentTransfers,pupilLifecycle,academicHistoryReview:enrolmentLedger}));
    preview.get('/preview/catalog',(_req,res)=>res.json({schools:samples.schools,accounts:samples.accounts.map(({schoolCode,role,identifier})=>({schoolCode,role,identifier}))}));
    const attempts=new Map();
    preview.post('/preview/sign-in',originGuard(publicOrigin),async(req,res)=>{
        const now=Date.now(),key=req.ip;let rate=attempts.get(key);
        if(!rate||now>rate.until){rate={count:0,until:now+900000};attempts.set(key,rate);}
        if(++rate.count>30) return res.status(429).json({message:'Please try again later'});
        const account=samples.accounts.find(row=>row.schoolCode===req.body?.schoolCode&&row.role===req.body?.role);
        if(!account) return res.status(403).json({message:'Sample account not found'});
        const session=await identity.login(account.loginKey,account.password,account.schoolCode);
        await identity.revokeSession(readSessionToken(req));
        res.cookie(COOKIE,session.token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',expires:session.expiresAt});
        res.json({status:'success',csrfToken:session.csrfToken});
    });
    const app=createApp({logging:false,requestContext:(_req,res,next)=>{
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
        res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');next();
    },routes:[['/',preview],['/api/identity',createIdentityRouter({service:identity,publicOrigin})],
        ['/api/personnel',createScopedPersonnelRouter({identityService:identity,database:db,publicOrigin,enrolmentLedger})],
        ...(enrolmentLedger?[['/api/enrolments',require('../routes/identity/enrolmentLedgerRouter').createEnrolmentLedgerRouter({identityService:identity,database:db,publicOrigin,readOnly:true})]]:[]),
        ...(enrolmentLedger?[['/api/academic-history',require('../routes/identity/academicHistoryReviewRouter').createAcademicHistoryReviewRouter({identityService:identity,database:db,publicOrigin})]]:[]),
        ...(currentTransfers?[['/api/pupil-placements',require('../routes/identity/pupilPlacementRouter').createPupilPlacementRouter({identityService:identity,database:db,publicOrigin,pupilLifecycle})]]:[]),
        ['/api/setup',createScopedAcademicRouter({identityService:identity,database:db,publicOrigin,yearCoverage:yearOfferings && enrolmentLedger,yearArchive})],
        ['/api/links',createScopedAcademicLinksRouter({identityService:identity,database:db,publicOrigin,datedPlacement:enrolmentLedger,yearOfferings})],
        ['/api/marks',createScopedMarksRouter({identityService:identity,database:db,publicOrigin,datedPlacement:enrolmentLedger})],
        ['/api/reference',createReferenceRouter({identityService:identity,database:db})]]});
    app.set('trust proxy',false);
    return app;
}
async function main() {
    loadTestEnvironment();const db=createDatabase();await assertSyntheticDatabase(db);
    const directory=path.join(__dirname,'../backups/runtime');fs.mkdirSync(directory,{recursive:true});
    const expected=require('./migrate').migrationFiles();
    const installed=(await db.getPool().request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
    if(JSON.stringify(installed.map(row=>[row.version,row.checksum]))!==JSON.stringify(expected.map(row=>[row.name,row.checksum]))) throw new Error('Apply reviewed synthetic migrations before preview');
    const samples=await sampleAccounts(db,directory);
    const server=https.createServer({key:fs.readFileSync(path.join(directory,'tls/localhost.key')),cert:fs.readFileSync(path.join(directory,'tls/localhost.crt'))},
        createPreviewApp(db,samples,'https://localhost:2027'));
    server.listen(2027,'127.0.0.1',()=>console.log('Synthetic M1 browser preview: https://localhost:2027'));
    for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>server.close(()=>db.close()));
}
if(require.main===module)main().catch(()=>{console.error('Synthetic preview startup failed; credentials withheld. Review local setup.');process.exitCode=1;});
module.exports={createPreviewApp,sampleAccounts};
