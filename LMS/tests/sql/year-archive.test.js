const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase}=require('../../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const schema=require('../../scripts/stagedPupilSchema');
const {seedEnrolmentFixture,removeEnrolmentFixture}=require('../helpers/enrolmentFixture');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createAcademicSetupService}=require('../../model/identity/academicSetupService');
const {createEnrolmentLedgerService}=require('../../model/identity/enrolmentLedgerService');
const {createScopedAcademicRouter}=require('../../routes/identity/academicSetupRouter');
const {createApp}=require('../../app/app');
const {serve}=require('../helpers/http');

test('archive preserves a referenced year, serializes current selection and rolls back an audit failure',async t=>{
    loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
    const query=statement=>db.getPool().request().query(statement);
    const baseline=async()=>(await query(`SELECT OBJECT_ID('dbo.academic_year_archives') archives,OBJECT_ID('dbo.enrolment_archive_boundary') boundary,
        INDEXPROPERTY(OBJECT_ID('dbo.academic_years'),'UX_year_archive_definition','IndexID') yearIndex,
        (SELECT COUNT(*) FROM dbo.schools) schools,(SELECT COUNT(*) FROM dbo.academic_years) years,
        (SELECT COUNT(*) FROM dbo.identity_audit_events) audits;SELECT version,checksum FROM dbo.schema_migrations ORDER BY version`)).recordsets;
    const before=await baseline(),options={yearOfferings:true,yearArchive:true};
    const trigger='archive_audit_'+crypto.randomBytes(5).toString('hex');
    let installed=false,ids,hasTrigger=false;
    try {
        await schema.install(db,true,options);assert.deepEqual(await baseline(),before);
        await schema.install(db,false,options);installed=true;ids=await seedEnrolmentFixture(db);
        const identity=createIdentityService(db),access=createSchoolAccess(identity),setup=createAcademicSetupService(access,db,options);
        const admin=await identity.createSession(ids.aa,ids.ma),teacher=await identity.createSession(ids.at,ids.mt),a=await access.resolve(admin.token);
        const origin='https://lms.example.invalid',base=await serve(t,createApp({logging:false,routes:[
            ['/setup',createScopedAcademicRouter({identityService:identity,database:db,publicOrigin:origin,yearArchive:true,yearCoverage:true})],
            ['/original',createScopedAcademicRouter({identityService:identity,database:db,publicOrigin:origin})]]}));
        const input={version:1,reason:'Reviewed end-of-year register'};
        const send=(year,body=input,actor=admin,csrf=actor.csrfToken,route='setup')=>fetch(base+'/'+route+'/academic-years/'+year+'/archive',{
            method:'POST',headers:{Origin:origin,Cookie:'__Host-lms_session='+actor.token,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
        assert.equal((await send(ids.yn,input,admin,admin.csrfToken,'original')).status,404);
        assert.equal((await send(ids.yn,input,admin,'')).status,403);assert.equal((await send(ids.yn,input,teacher)).status,403);
        assert.equal((await send(ids.yb)).status,404);
        for(const fields of [{reason:' '},{version:0},{schoolId:ids.b}])assert.equal((await send(ids.yn,{...input,...fields})).status,422);
        await setup.setCurrent(a,ids.yn,1);assert.equal((await send(ids.yn,{...input,version:2})).status,409);
        assert.equal((await send(ids.ya)).status,409); // Active projected pupil, even with an empty ledger.
        await query(`UPDATE dbo.students SET academicYearId=${ids.yn} WHERE id=${ids.pa} AND school_id=${ids.a};
            INSERT dbo.academic_year_students(school_id,academic_year_id,student_id) VALUES(${ids.a},${ids.ya},${ids.pa});`);
        const ledger=createEnrolmentLedgerService(access,db);
        const period={yearId:ids.ya,classId:ids.ca,fromDate:'2024-09-01',toDate:null,status:'enrolled',sourceReference:'Synthetic register',reason:'Reviewed'};
        const entry=await ledger.record(a,{...period,studentId:ids.pa});
        assert.equal((await send(ids.ya)).status,409);
        await ledger.revise(a,entry.id,{...period,version:1,toDate:'2099-01-01'});assert.equal((await send(ids.ya)).status,409);
        await ledger.revise(a,entry.id,{...period,version:2,status:'completed',toDate:'2025-07-01'});
        const coverage=await setup.yearCoverage(a,ids.ya),history=await ledger.history(a,ids.pa);
        await query(`CREATE TRIGGER dbo.${trigger} ON dbo.identity_audit_events AFTER INSERT AS IF EXISTS
            (SELECT 1 FROM inserted WHERE school_id=${ids.a} AND action='academic_year_archived') THROW 50132,'Synthetic failure',1`);hasTrigger=true;
        assert.equal((await send(ids.ya)).status,500);
        const year=async id=>(await setup.list(a,'year')).find(row=>row.id===id);
        assert.equal((await year(ids.ya)).archivedAt,null);assert.equal((await year(ids.ya)).version,1);
        await query(`DROP TRIGGER dbo.${trigger}`);hasTrigger=false;
        const competing=await Promise.all([send(ids.ya),send(ids.ya)]);
        assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
        assert.ok((await year(ids.ya)).archivedAt);assert.equal((await year(ids.ya)).version,2);
        const receipt=(await query(`SELECT actor_account_id,actor_membership_id,reason FROM dbo.academic_year_archives WHERE school_id=${ids.a} AND academic_year_id=${ids.ya}`)).recordset;
        assert.deepEqual(receipt,[{actor_account_id:ids.aa,actor_membership_id:ids.ma,reason:input.reason}]);
        assert.equal((await query(`SELECT COUNT(*) n FROM dbo.identity_audit_events WHERE school_id=${ids.a} AND action='academic_year_archived'`)).recordset[0].n,1);
        await assert.rejects(setup.update(a,'year',ids.ya,2,{name:'Changed'}),{statusCode:409});
        await assert.rejects(setup.setCurrent(a,ids.ya,2),{statusCode:409});
        await assert.rejects(query(`UPDATE dbo.academic_years SET name='Changed' WHERE id=${ids.ya}`));
        await assert.rejects(query(`DELETE dbo.academic_year_archives WHERE school_id=${ids.a}`));
        await assert.rejects(ledger.revise(a,entry.id,{...period,yearId:ids.yn,version:3}),{statusCode:409});
        await assert.rejects(ledger.record(a,{...period,studentId:ids.pa,fromDate:'2025-08-01'}),{statusCode:409});
        assert.deepEqual(await setup.yearCoverage(a,ids.ya),coverage);assert.deepEqual(await ledger.history(a,ids.pa),history);
        const fresh=await setup.create(a,'year',{fromYear:2040,toYear:2041});
        const race=await Promise.allSettled([setup.archive(a,fresh.id,1,'Reviewed'),setup.setCurrent(a,fresh.id,1)]);
        assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
        assert.equal(race.find(r=>r.status==='rejected').reason.statusCode,409);
        const final=await year(fresh.id);assert.notEqual(Boolean(final.isCurrent),Boolean(final.archivedAt));
    } finally {
        if(hasTrigger)await query(`DROP TRIGGER dbo.${trigger}`);
        if(installed)await schema.remove(db,ids,options);
        if(ids)await removeEnrolmentFixture(db,ids);
    }
    assert.deepEqual(await baseline(),before);
});
