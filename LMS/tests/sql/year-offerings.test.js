const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase}=require('../../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const {seedEnrolmentFixture,removeEnrolmentFixture}=require('../helpers/enrolmentFixture');
const schema=require('../../scripts/stagedPupilSchema');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createAcademicSetupService}=require('../../model/identity/academicSetupService');
const {createAcademicLinksService}=require('../../model/identity/academicLinksService');
const {createPersonnelService}=require('../../model/identity/personnelService');
const {createScopedAcademicLinksRouter}=require('../../routes/identity/academicLinksRouter');
const {createScopedAcademicRouter}=require('../../routes/identity/academicSetupRouter');
const {createEnrolmentLedgerService}=require('../../model/identity/enrolmentLedgerService');
const {createApp}=require('../../app/app');
const {serve}=require('../helpers/http');

test('year coefficients and co-teaching events preserve independent years, permissions and rollback',async t=>{
    loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
    const query=text=>db.getPool().request().query(text);
    const baseline=async()=>(await query(`SELECT OBJECT_ID('dbo.year_offering_revisions') revisions,OBJECT_ID('dbo.teaching_assignment_events') events,
        (SELECT COUNT(*) FROM dbo.class_subject_teachers) links,(SELECT COUNT(*) FROM dbo.schools) schools,(SELECT COUNT(*) FROM dbo.identity_audit_events) audits;
        SELECT version,checksum FROM dbo.schema_migrations ORDER BY version`)).recordsets;
    const before=await baseline(),opts={yearOfferings:true},trigger='year_audit_'+crypto.randomBytes(5).toString('hex');
    let installed=false,ids,triggerInstalled=false;
    try{
        await schema.install(db,true,opts);assert.deepEqual(await baseline(),before);
        await schema.install(db,false,opts);installed=true;ids=await seedEnrolmentFixture(db);
        await query(`UPDATE dbo.academic_years SET isCurrent=1 WHERE id IN(${ids.ya},${ids.yb})`);
        const identity=createIdentityService(db),access=createSchoolAccess(identity),links=createAcademicLinksService(access,db,opts);
        const setup=createAcademicSetupService(access,db),people=createPersonnelService(access,db);
        const session=await identity.createSession(ids.aa,ids.ma),foreign=await identity.createSession(ids.ab,ids.mb);
        const a=await access.resolve(session.token),b=await access.resolve(foreign.token);
        const subject=await setup.create(a,'subject',{name:'Geometry',code:'GEOM'}),otherSubject=await setup.create(b,'subject',{name:'Geometry',code:'GEOM'});
        const offering=await links.createOffering(a,{classId:ids.ca,subjectId:subject.id,coefficient:7});
        const otherOffering=await links.createOffering(b,{classId:ids.cb,subjectId:otherSubject.id,coefficient:4});
        const code=(await query(`SELECT code FROM dbo.schools WHERE id=${ids.a}`)).recordset[0].code;
        const teacherInput={firstName:'Sample',lastName:'Teacher',email:'geometry@example.invalid',section:'Anglophone',employmentType:'Part-time',password:crypto.randomBytes(24).toString('base64url')};
        const teacher=await people.register(a,'teacher',teacherInput),peer=await people.register(a,'teacher',{...teacherInput,email:'peer@example.invalid'});
        const teacherSession=await identity.loginSchoolIdentity(code,'teacher',teacherInput.email,teacherInput.password);
        const teacherContext=await access.resolve(teacherSession.token);
        await query(`INSERT dbo.class_subject_teachers(class_subject_id,teacher_id,school_id,term) VALUES(${offering.id},${teacher.id},${ids.a},'First')`);
        const history=year=>links.offeringHistory(a,offering.id,year);
        const config={offeringId:offering.id,yearId:ids.ya,version:0,coefficient:2.5,sourceReference:'Curriculum register 1'};
        const assignment={offeringId:offering.id,yearId:ids.ya,teacherId:teacher.id,term:'First',action:'assign',version:0};
        assert.deepEqual(await history(ids.ya),{revisions:[],assignments:[]});
        assert.deepEqual(await links.myAssignments(teacherContext,ids.ya,'First'),[]);
        await assert.rejects(links.assign(a,assignment),e=>e.statusCode===409);
        // A verified pre-history assignment can still be revoked before year configuration.
        const preHistory=createAcademicLinksService(access,db);
        const old=await preHistory.assign(a,{...assignment,term:'Third'});
        await links.assign(a,{...assignment,term:'Third',action:'revoke',version:old.version});
        const imported=await history(ids.ya);
        assert.deepEqual(imported.revisions,[]);
        assert.deepEqual(imported.assignments.map(r=>[r.term,r.status,r.version,r.offeringVersion]),[['Third','revoked',2,null]]);
        await assert.rejects(links.enrol(a,{offeringId:offering.id,yearId:ids.ya,changes:[{studentId:ids.pa,version:0,action:'enrol'}]}),e=>e.statusCode===409);
        const origin='https://lms.example.invalid',base=await serve(t,createApp({logging:false,routes:[['/links',createScopedAcademicLinksRouter({identityService:identity,database:db,publicOrigin:origin,...opts})]]}));
        const post=(body,actor=session,extra={})=>fetch(base+'/links/year-offerings',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
            Cookie:'__Host-lms_session='+actor.token,'X-CSRF-Token':actor.csrfToken,...extra},body:JSON.stringify(body)});
        const get=actor=>fetch(base+'/links/offerings/'+offering.id+'/years/'+ids.ya+'/history',{headers:{Cookie:'__Host-lms_session='+actor.token}});
        assert.equal((await post(config,session,{'X-CSRF-Token':''})).status,403);
        assert.equal((await post(config,teacherSession)).status,403);assert.equal((await post(config,foreign)).status,404);
        assert.equal((await post({...config,yearId:ids.yb})).status,404);assert.equal((await post({...config,offeringId:otherOffering.id})).status,404);
        assert.equal((await get(foreign)).status,404);assert.equal((await get(teacherSession)).status,403);
        for(const patch of [{coefficient:0},{coefficient:1.234},{coefficient:null},{version:-1},{sourceReference:''},{schoolId:ids.b}])
            assert.equal((await post({...config,...patch})).status,422);
        const attempts=await Promise.all([post(config),post(config)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);
        const first=await links.assign(a,assignment);
        await links.assign(a,{...assignment,teacherId:peer.id});await links.assign(a,{...assignment,version:first.version});
        await links.configureYear(a,{...config,version:1,coefficient:3.25,sourceReference:'Curriculum correction 2'});
        await links.assign(a,{...assignment,action:'revoke',version:first.version});
        const firstYear=await history(ids.ya);
        assert.deepEqual(firstYear.revisions.map(r=>r.coefficient),[2.5,3.25]);
        assert.deepEqual(firstYear.assignments.filter(r=>r.teacherId===teacher.id&&r.term==='First').map(r=>[r.status,r.offeringVersion]),[['active',1],['revoked',2]]);
        assert.equal(firstYear.assignments.filter(r=>r.teacherId===peer.id).length,1);
        assert.equal((await links.myAssignments(teacherContext,ids.ya,'First')).length,0);
        assert.deepEqual(await history(ids.yn),{revisions:[],assignments:[]});
        await query(`UPDATE dbo.academic_years SET isCurrent=CASE WHEN id=${ids.yn} THEN 1 ELSE 0 END WHERE school_id=${ids.a}`);
        await assert.rejects(links.configureYear(a,{...config,version:2}),e=>e.statusCode===409);
        const next={...config,yearId:ids.yn,coefficient:1.75,sourceReference:'New year timetable'};
        await links.configureYear(a,next);
        await query(`CREATE TRIGGER dbo.${trigger} ON dbo.identity_audit_events AFTER INSERT AS IF EXISTS(
            SELECT 1 FROM inserted WHERE school_id=${ids.a} AND resource_type IN('teaching_assignment','year_offering')) THROW 50122,'Synthetic audit failure',1;`);triggerInstalled=true;
        await assert.rejects(links.configureYear(a,{...next,version:1,coefficient:9}),e=>e.statusCode===500);
        await assert.rejects(links.assign(a,{...assignment,yearId:ids.yn}),e=>e.statusCode===500);
        assert.equal((await history(ids.yn)).revisions.length,1);assert.deepEqual((await history(ids.yn)).assignments,[]);
        assert.deepEqual(await links.linkList(a,offering.id,ids.yn,'First'),[]);
        assert.equal((await query(`SELECT COUNT(*) n FROM dbo.academic_year_teachers WHERE school_id=${ids.a} AND academic_year_id=${ids.yn}`)).recordset[0].n,0);
        await query(`DROP TRIGGER dbo.${trigger}`);triggerInstalled=false;
        await links.assign(a,{...assignment,yearId:ids.yn,term:'Second'});
        assert.deepEqual(await history(ids.ya),firstYear);
        assert.equal((await links.myAssignments(teacherContext,ids.yn,'Second')).length,1);
        assert.equal((await links.myAssignments(teacherContext,ids.yn,'First')).length,0);
        assert.equal((await links.listOfferings(a))[0].coefficient,7);
        assert.equal((await query(`SELECT COUNT(*) n FROM dbo.class_subject_teachers WHERE school_id=${ids.a} AND academic_year_id IS NULL AND link_version=1`)).recordset[0].n,1);
        await assert.rejects(query(`DELETE dbo.teaching_assignment_events WHERE school_id=${ids.a}`));
        await assert.rejects(query(`UPDATE dbo.year_offering_revisions SET coefficient=7 WHERE school_id=${ids.a}`));
        await t.test('coverage reconciles selected-year sources and current revisions without certifying a cohort',async()=>{
            const base=await serve(t,createApp({logging:false,routes:[
                ['/setup',createScopedAcademicRouter({identityService:identity,database:db,publicOrigin:origin,yearCoverage:true})],
                ['/original',createScopedAcademicRouter({identityService:identity,database:db,publicOrigin:origin})]
            ]}));
            const read=(year,actor=session,path='setup',suffix='')=>fetch(base+'/'+path+'/academic-years/'+year+'/coverage'+suffix,
                {headers:{Cookie:'__Host-lms_session='+actor.token}});
            assert.equal((await read(ids.ya,session,'original')).status,404);
            assert.equal((await read(ids.yb)).status,404);
            assert.equal((await read(ids.ya,teacherSession)).status,403);
            assert.equal((await read(ids.ya,session,'setup','?school_id='+ids.b)).status,422);
            const coverage=async(year,actor=session)=>{
                const response=await read(year,actor);assert.equal(response.status,200);
                assert.equal(response.headers.get('cache-control'),'no-store');return (await response.json()).data;
            };
            const initial=await coverage(ids.ya);
            assert.equal(initial.currentProjectionPupils,1);assert.equal(initial.sourcePupils,0);
            assert.equal(initial.schoolUndatedAssignmentRows,1);assert.equal(initial.yearAssignmentRows,3);
            assert.equal(initial.assignmentsWithoutVersionEvent,0);
            const other=await coverage(ids.yb,foreign);assert.equal(other.schoolUndatedAssignmentRows,0);
            await query(`INSERT dbo.class_subject_students(class_subject_id,student_id,academic_year_id,school_id,enrolment_status)
                VALUES(${offering.id},${ids.pa},${ids.ya},${ids.a},'revoked');
                INSERT dbo.subject_scores(student_id,class_subject_id,academic_year_id,school_id,term,sequence,score,created_by)
                VALUES(${ids.pa},${offering.id},${ids.ya},${ids.a},'First',1,25,123);`);
            const gap=await coverage(ids.ya);
            assert.equal(gap.courseLinkRows,1);assert.equal(gap.scoreRows,1);assert.equal(gap.sourcePupils,1);
            assert.equal(gap.sourcePupilsWithoutPlacement,1);assert.equal(gap.pupilOfferingsWithoutClassPlacement,1);
            const ledger=createEnrolmentLedgerService(access,db);
            const period={classId:ids.cn,yearId:ids.ya,fromDate:'2024-09-01',toDate:null,status:'enrolled',
                sourceReference:'Synthetic register',reason:'Reviewed date'};
            const entry=await ledger.record(a,{...period,studentId:ids.pa});
            const mismatch=await coverage(ids.ya);assert.equal(mismatch.ledgerPupilsWithoutYearMembership,1);
            assert.equal(mismatch.sourcePupilsWithoutPlacement,0);assert.equal(mismatch.pupilOfferingsWithoutClassPlacement,1);
            await ledger.revise(a,entry.id,{...period,classId:ids.ca,version:1});
            assert.equal((await coverage(ids.ya)).pupilOfferingsWithoutClassPlacement,0);
            await ledger.revise(a,entry.id,{...period,yearId:ids.yn,version:2});
            assert.equal((await coverage(ids.ya)).ledgerPupils,0);assert.equal((await coverage(ids.yn)).ledgerPupils,1);
            await ledger.revise(a,entry.id,{...period,yearId:ids.yn,version:3,status:'voided'});
            assert.equal((await coverage(ids.yn)).ledgerPupils,0);
            await query(`INSERT dbo.academic_year_students(academic_year_id,student_id,school_id) VALUES(${ids.ya},${ids.pa},${ids.a});
                INSERT dbo.class_subject_teachers(class_subject_id,teacher_id,academic_year_id,school_id,term)
                VALUES(${offering.id},${peer.id},${ids.yn},${ids.a},'Third');`);
            assert.equal((await coverage(ids.ya)).sourcePupils,1);assert.equal((await coverage(ids.ya)).yearMemberPupils,1);
            const later=await coverage(ids.yn);
            assert.equal(later.assignmentsWithoutVersionEvent,1);assert.equal(later.assignedTeachersWithoutYearMembership,1);
            await query(`INSERT dbo.class_subject_students(class_subject_id,student_id,academic_year_id,school_id)
                VALUES(${otherOffering.id},${ids.pb},${ids.yb},${ids.b})`);
            assert.equal((await coverage(ids.yb,foreign)).usedOfferingsWithoutCoefficient,1);
            assert.equal((await coverage(ids.ya)).usedOfferingsWithoutCoefficient,0);
        });
        assert.equal((await get(session)).status,200);await identity.revokeSession(session.token);assert.equal((await get(session)).status,403);
    }finally{
        if(triggerInstalled)await query(`DROP TRIGGER dbo.${trigger}`);
        if(installed)await schema.remove(db,ids,opts);
        if(ids)await removeEnrolmentFixture(db,ids);
    }
    assert.deepEqual(await baseline(),before);
});
