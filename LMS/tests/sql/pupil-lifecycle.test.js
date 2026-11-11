const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {createDatabase,withDatabase} = require('../../config/database');
const {loadTestEnvironment,assertSyntheticDatabase} = require('../../scripts/testEnvironment');
const schema = require('../../scripts/stagedPupilSchema');
const {seedEnrolmentFixture,removeEnrolmentFixture} = require('../helpers/enrolmentFixture');
const {createIdentityService} = require('../../model/identity/identityService');
const {createSchoolAccess} = require('../../model/identity/schoolAccess');
const {createPersonnelService} = require('../../model/identity/personnelService');
const {createEnrolmentLedgerService} = require('../../model/identity/enrolmentLedgerService');
const {createPupilPlacementRouter} = require('../../routes/identity/pupilPlacementRouter');
const {legacyCredentialVersion} = require('../../model/identity/legacyCredentialVersion');
const {createLegacySchoolAccess} = require('../../model/identity/legacySchoolAccess');
const {createLegacySelfReads} = require('../../model/identity/legacySelfReads');
const generateToken = require('../../utils/generateToken');
const {createApp} = require('../../app/app');
const {serve} = require('../helpers/http');

test('dated withdrawal and return keep prior tokens invalid and preserve access at another school',async t=>{
    loadTestEnvironment();
    const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
    const query=text=>db.getPool().request().query(text);
    const baseline=async()=>(await query(`SELECT OBJECT_ID('dbo.pupil_withdrawal_access') receipts,COL_LENGTH('dbo.school_memberships','pupil_access_stamp') stamp,
        OBJECT_ID('dbo.student_enrolments') ledger,(SELECT COUNT(*) FROM dbo.students) pupils,
        (SELECT COUNT(*) FROM dbo.school_memberships) members,(SELECT COUNT(*) FROM dbo.identity_audit_events) audits;
        SELECT version,checksum FROM dbo.schema_migrations ORDER BY version`)).recordsets;
    const before=await baseline(),trigger='withdrawal_probe_'+crypto.randomBytes(5).toString('hex');
    let installed=false,ids,triggerInstalled=false;
    try{
        await schema.install(db,true);assert.deepEqual(await baseline(),before);
        await schema.install(db);installed=true;ids=await seedEnrolmentFixture(db);
        await query(`UPDATE dbo.academic_years SET isCurrent=1 WHERE id=${ids.ya}`);
        const identity=createIdentityService(db),access=createSchoolAccess(identity);
        const ledger=createEnrolmentLedgerService(access,db),people=createPersonnelService(access,db,{enrolmentLedger:true});
        const actor=await identity.createSession(ids.aa,ids.ma),foreign=await identity.createSession(ids.ab,ids.mb),teacher=await identity.createSession(ids.at,ids.mt);
        const context=await access.resolve(actor.token);
        const password=crypto.randomBytes(24).toString('base64url');
        const pupil=await people.register(context,'student',{firstName:'Lifecycle',lastName:'Fixture',sex:'Male',section:'Anglophone',matricule:'CYCLE',password,
            placement:{classId:ids.ca,yearId:ids.ya,fromDate:'2024-09-01',reason:'Verified admission',sourceReference:'Register 3'}});
        const target=(await query(`SELECT account_id,membership_id FROM dbo.legacy_account_map WHERE source_table='students' AND legacy_id=${pupil.id}`)).recordset[0];
        const subject=await require('../../model/identity/academicSetupService').createAcademicSetupService(access,db).create(context,'subject',{name:'Geometry',code:'GEOM'});
        const {createAcademicLinksService}=require('../../model/identity/academicLinksService');
        const links=createAcademicLinksService(access,db,{datedPlacement:true});
        const offering=await links.createOffering(context,{classId:ids.ca,subjectId:subject.id});
        const enrolled=(await links.enrol(context,{offeringId:offering.id,yearId:ids.ya,changes:[{studentId:pupil.id,action:'enrol',version:0}]}))[0];
        const marks=require('../../model/identity/marksService').createMarksService(access,db,{datedPlacement:true});
        const markScope={offeringId:offering.id,yearId:ids.ya,term:'First'};
        await marks.save(context,{...markScope,scores:[{studentId:pupil.id,sequence:1,version:0,score:17,maxScore:20}]});
        // This peer has matching present-day class/year but no verified ledger. Model an existing M1 course link.
        await createAcademicLinksService(access,db).enrol(context,{offeringId:offering.id,yearId:ids.ya,changes:[{studentId:ids.pa,action:'enrol',version:0}]});
        const markRecord=await marks.sheet(context,markScope);
        const localSession=await identity.createSession(target.account_id,target.membership_id);
        const otherMember=(await query(`INSERT dbo.school_memberships(school_id,account_id,status) OUTPUT inserted.id VALUES(${ids.b},${target.account_id},'active')`)).recordset[0].id;
        await query(`INSERT dbo.membership_roles VALUES(${ids.b},${otherMember},'student')`);
        const otherSession=await identity.createSession(target.account_id,otherMember);
        const code=(await query(`SELECT code FROM dbo.schools WHERE id=${ids.a}`)).recordset[0].code;
        const legacy=createLegacySchoolAccess(db,{pupilLifecycle:true});
        const version=()=>legacyCredentialVersion('student',pupil.id,db,undefined,true);
        // Enable only in this isolated test process. Exercise the original sign-in handler and middleware.
        const policy=require('../../config/runtimePolicy.json'),prior=policy.canonicalPupilLifecycle;
        policy.canonicalPupilLifecycle=true;t.after(()=>{if(prior===undefined)delete policy.canonicalPupilLifecycle;else policy.canonicalPupilLifecycle=prior;});
        const oldRoutes=require('express').Router();
        oldRoutes.post('/login',require('../../controllers/students/studentCtrl').loginStudentCtrl);
        oldRoutes.get('/self',require('../../middlewares/roleAuth').createRoleAuth({accountType:'student',findById:id=>require('../../model/Academic/student').findById(id)}),
            (req,res)=>res.json({id:req.userAuth.id}));
        const oldBase=await serve(t,createApp({logging:false,legacyCredentialVersionsEnabled:true,routes:[['/student',oldRoutes]],
            requestContext:(_req,_res,next)=>withDatabase(db,next)}));
        const login=()=>fetch(oldBase+'/student/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({matricule:'CYCLE',password})});
        const authenticated=token=>fetch(oldBase+'/student/self',{headers:{Authorization:'Bearer '+token}});
        const signedIn=await login();assert.equal(signedIn.status,200);
        const legacyToken=(await signedIn.json()).token;assert.equal((await authenticated(legacyToken)).status,200);
        const validate=token=>legacy.resolve('Bearer '+token,['student']);
        assert.ok(await validate(legacyToken));
        const origin='https://lms.example.invalid',base=await serve(t,createApp({logging:false,routes:[
            ['/placement',createPupilPlacementRouter({identityService:identity,database:db,publicOrigin:origin,pupilLifecycle:true})],
            ['/links',require('../../routes/identity/academicLinksRouter').createScopedAcademicLinksRouter({identityService:identity,database:db,publicOrigin:origin,datedPlacement:true})],
            ['/marks',require('../../routes/identity/marksRouter').createScopedMarksRouter({identityService:identity,database:db,publicOrigin:origin,datedPlacement:true})]]}));
        const coursePost=(path,body)=>fetch(base+path,{method:'POST',headers:{Origin:origin,Cookie:'__Host-lms_session='+actor.token,
            'X-CSRF-Token':actor.csrfToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
        const peerLink={offeringId:offering.id,yearId:ids.ya,changes:[{studentId:ids.pa,action:'enrol',version:1}]};
        const batch={...markScope,scores:[{studentId:pupil.id,sequence:1,version:1,score:19,maxScore:20},{studentId:ids.pa,sequence:1,version:0,score:10,maxScore:20}]};
        assert.equal((await coursePost('/links/enrolments',peerLink)).status,409);
        assert.equal((await coursePost('/marks/scores',batch)).status,409);
        assert.deepEqual(await marks.sheet(context,markScope),markRecord);
        const peer=await ledger.record(context,{studentId:ids.pa,classId:ids.cn,yearId:ids.ya,fromDate:'2024-01-01',toDate:null,status:'enrolled',reason:'Verified placement',sourceReference:'Peer register'});
        assert.equal((await coursePost('/links/enrolments',peerLink)).status,409);
        await ledger.revise(context,peer.id,{version:1,classId:ids.ca,yearId:ids.ya,fromDate:'2024-01-01',toDate:'2024-04-01',status:'completed',reason:'Closed period',sourceReference:'Peer register'});
        assert.equal((await coursePost('/marks/scores',batch)).status,409);
        assert.deepEqual(await marks.sheet(context,markScope),markRecord);
        const post=(path,body,session=actor,extra={})=>fetch(base+'/placement/'+pupil.enrolment.id+'/'+path,{method:'POST',headers:{Origin:origin,
            Cookie:'__Host-lms_session='+session.token,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
        const withdrawal={version:1,profileVersion:1,onDate:'2025-01-10',sourceReference:'Register 4',reason:'Confirmed departure'};
        const readState=async()=>(await query(`SELECT isWithdrawn,profile_version,currentClassLevel,academicYearId FROM dbo.students WHERE id=${pupil.id};
            SELECT status,pupil_access_stamp FROM dbo.school_memberships WHERE id=${target.membership_id};
            SELECT COUNT(*) n FROM dbo.pupil_withdrawal_access WHERE school_id=${ids.a};
            SELECT COUNT(*) n FROM dbo.identity_audit_events WHERE school_id=${ids.a};
            SELECT academic_year_id FROM dbo.academic_year_students WHERE student_id=${pupil.id} ORDER BY academic_year_id`)).recordsets;
        const hashes=async()=>crypto.createHash('sha256').update(JSON.stringify((await query(`SELECT s.password,a.password_hash,a.security_version
            FROM dbo.students s JOIN dbo.accounts a ON a.id=${target.account_id} WHERE s.id=${pupil.id}`)).recordset)).digest('hex');
        const original=await readState(),credentials=await hashes(),originalHistory=await ledger.history(context,pupil.id);
        for(const [session,extra,body,status] of [[foreign,{},withdrawal,404],[teacher,{},withdrawal,403],[actor,{'X-CSRF-Token':''},withdrawal,403],
            [actor,{}, {...withdrawal,schoolId:ids.b},422],[actor,{}, {...withdrawal,profileVersion:2},409],
            [actor,{}, {...withdrawal,onDate:'9999-01-01'},422],[actor,{}, {...withdrawal,onDate:'2024-09-01'},409]])
            assert.equal((await post('withdrawals',body,session,extra)).status,status);
        const inject=async action=>{await query(`CREATE TRIGGER dbo.${trigger} ON dbo.identity_audit_events AFTER INSERT AS
            IF EXISTS(SELECT 1 FROM inserted WHERE school_id=${ids.a} AND action='${action}') THROW 50117,'Synthetic late failure',1;`);triggerInstalled=true;};
        const release=async()=>{await query(`DROP TRIGGER dbo.${trigger}`);triggerInstalled=false;};
        await inject('pupil_withdrawn');assert.equal((await post('withdrawals',withdrawal)).status,500);await release();
        assert.deepEqual(await readState(),original);assert.deepEqual(await ledger.history(context,pupil.id),originalHistory);
        assert.ok(await identity.resolveSession(localSession.token));assert.ok(await validate(legacyToken));
        const racing=await Promise.all([post('withdrawals',withdrawal),post('withdrawals',withdrawal)]);
        assert.deepEqual(racing.map(r=>r.status).sort(),[200,409]);
        assert.equal(await identity.resolveSession(localSession.token),null);assert.ok(await identity.resolveSession(otherSession.token));
        await assert.rejects(identity.switchSchool(otherSession.token,code));
        await assert.rejects(identity.loginSchoolIdentity(code,'student','CYCLE',password));
        await assert.rejects(validate(legacyToken));assert.equal(await hashes(),credentials);
        assert.equal((await login()).status,403);assert.equal((await authenticated(legacyToken)).status,403);
        const roster=async onDate=>(await ledger.roster(context,{classId:ids.ca,yearId:ids.ya,onDate})).rows.map(r=>r.studentId);
        assert.deepEqual(await roster('2025-01-09'),[pupil.id]);assert.deepEqual(await roster('2025-01-10'),[]);
        const returning={...withdrawal,version:2,profileVersion:2,onDate:'2025-02-01',classId:ids.ca,yearId:ids.ya,sourceReference:'Register 5',reason:'Verified readmission'};
        const closed=await readState(),closedHistory=await ledger.history(context,pupil.id);
        const reviewURL=base+'/placement/'+pupil.enrolment.id+'/return-courses?version=2&profileVersion=2&classId='+ids.ca+'&yearId='+ids.ya;
        assert.equal((await fetch(reviewURL,{headers:{Cookie:'__Host-lms_session='+foreign.token}})).status,404);
        const review=await fetch(reviewURL,{headers:{Cookie:'__Host-lms_session='+actor.token}});assert.equal(review.status,200);
        const subjects=(await review.json()).data;assert.deepEqual(subjects,[{id:enrolled.id,version:1,name:'Geometry'}]);
        assert.equal((await post('returns',returning)).status,409);
        assert.equal((await post('returns',{...returning,reviewedCourses:[{id:enrolled.id,version:2}]})).status,409);
        returning.reviewedCourses=subjects.map(({id,version})=>({id,version}));
        assert.equal((await post('returns',{...returning,classId:ids.cb})).status,404);
        assert.equal((await post('returns',{...returning,onDate:'2025-01-09'})).status,409);
        await inject('pupil_returned');assert.equal((await post('returns',returning)).status,500);await release();
        assert.deepEqual(await readState(),closed);assert.deepEqual(await ledger.history(context,pupil.id),closedHistory);
        const returns=await Promise.all([post('returns',returning),post('returns',returning)]);
        assert.deepEqual(returns.map(r=>r.status).sort(),[200,409]);
        const newEntry=(await returns.find(r=>r.status===200).json()).data.enrolment;
        assert.equal(await identity.resolveSession(localSession.token),null);assert.ok(await identity.resolveSession(otherSession.token));
        assert.ok(await identity.loginSchoolIdentity(code,'student','CYCLE',password));await assert.rejects(validate(legacyToken));
        assert.equal((await authenticated(legacyToken)).status,401);
        const newLogin=await login();assert.equal(newLogin.status,200);assert.equal((await authenticated((await newLogin.json()).token)).status,200);
        const fresh=await validate(generateToken(pupil.id,'student',await version()));
        assert.equal((await createLegacySelfReads(legacy,db).profile(fresh)).id,pupil.id);
        assert.equal(await hashes(),credentials);assert.deepEqual(await roster('2025-01-20'),[]);
        assert.deepEqual(await roster(returning.onDate),[pupil.id]);assert.deepEqual(await marks.sheet(context,markScope),markRecord);
        // An independent membership decision, even a repeated revocation, invalidates the receipt.
        await ledger.changeStatus(context,newEntry.id,'withdraw',{...withdrawal,version:1,profileVersion:3,onDate:'2025-03-01'});
        await query(`UPDATE dbo.school_memberships SET status='revoked' WHERE id=${target.membership_id}`);
        const afterIndependentRevoke=await readState();
        await assert.rejects(ledger.changeStatus(context,newEntry.id,'return',{...returning,profileVersion:4,onDate:'2025-03-15'}),e=>e.statusCode===409);
        assert.deepEqual(await readState(),afterIndependentRevoke);
        assert.ok(await identity.resolveSession(otherSession.token));
    }finally{
        if(triggerInstalled)await query(`DROP TRIGGER dbo.${trigger}`);
        if(installed)await schema.remove(db,ids);
        if(ids){
            await query(`DELETE dbo.subject_scores WHERE school_id=${ids.a};DELETE dbo.class_subject_students WHERE school_id=${ids.a};
                DELETE dbo.class_subjects WHERE school_id=${ids.a};DELETE dbo.subjects WHERE school_id=${ids.a};`);
            await removeEnrolmentFixture(db,ids);
        }
    }
    assert.deepEqual(await baseline(),before);
});
