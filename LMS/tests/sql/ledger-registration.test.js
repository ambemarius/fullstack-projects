const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {sql,createDatabase}=require('../../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createPersonnelService}=require('../../model/identity/personnelService');
const {createEnrolmentLedgerService}=require('../../model/identity/enrolmentLedgerService');
const {createScopedPersonnelRouter}=require('../../routes/identity/personnelRouter');
const {createEnrolmentLedgerRouter}=require('../../routes/identity/enrolmentLedgerRouter');
const {seedEnrolmentFixture,removeEnrolmentFixture}=require('../helpers/enrolmentFixture');
const {createApp}=require('../../app/app');const {serve}=require('../helpers/http');
test('M2 registration commits pupil, account, year/current placement and ledger together or rolls everything back',async t=>{
    loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
    const query=text=>db.getPool().request().query(text);
    assert.equal((await query("SELECT OBJECT_ID('dbo.student_enrolments') id")).recordset[0].id,null);
    const baseline=async()=>(await query(`SELECT (SELECT COUNT(*) FROM dbo.students) pupils,(SELECT COUNT(*) FROM dbo.accounts) accounts,
        (SELECT COUNT(*) FROM dbo.identity_audit_events) audits,(SELECT COUNT(*) FROM dbo.student_fees) fees;
        SELECT version,checksum FROM dbo.schema_migrations ORDER BY version;`)).recordsets;
    const before=await baseline();let installed=false,ids,triggerInstalled=false;
    const trigger='registration_ledger_'+crypto.randomBytes(5).toString('hex');
    try{
        const tx=new sql.Transaction(db.getPool());await tx.begin();
        try{await new sql.Request(tx).query(fs.readFileSync(require.resolve('../../docs/implementation/staged/010_enrolment_ledger.sql'),'utf8'));await tx.commit();installed=true;}
        catch(e){await tx.rollback().catch(()=>{});throw e;}
        ids=await seedEnrolmentFixture(db);
        await query(`UPDATE dbo.academic_years SET isCurrent=1 WHERE id IN(${ids.ya},${ids.yb});`);
        const identity=createIdentityService(db),access=createSchoolAccess(identity),people=createPersonnelService(access,db,{enrolmentLedger:true}),ledger=createEnrolmentLedgerService(access,db);
        const session=await identity.createSession(ids.aa,ids.ma),other=await identity.createSession(ids.ab,ids.mb),teacher=await identity.createSession(ids.at,ids.mt);
        const a=await access.resolve(session.token),b=await access.resolve(other.token);
        const input={firstName:'Synthetic',lastName:'Admission',matricule:'M2-ADMIT',section:'Anglophone',sex:'Male',password:crypto.randomBytes(24).toString('base64url'),
            placement:{classId:ids.ca,yearId:ids.ya,fromDate:'2024-09-01',sourceReference:'Admission register page 3',reason:'New pupil admission'}};
        const counts=async()=>(await query(`SELECT (SELECT COUNT(*) FROM dbo.students WHERE school_id=${ids.a}) pupils,
            (SELECT COUNT(*) FROM dbo.school_memberships WHERE school_id=${ids.a}) memberships,(SELECT COUNT(*) FROM dbo.accounts) accounts,
            (SELECT COUNT(*) FROM dbo.student_enrolments WHERE school_id=${ids.a}) enrolments,
            (SELECT COUNT(*) FROM dbo.student_enrolment_revisions WHERE school_id=${ids.a}) revisions,
            (SELECT COUNT(*) FROM dbo.legacy_account_map WHERE school_id=${ids.a}) mappings,
            (SELECT COUNT(*) FROM dbo.academic_year_students WHERE school_id=${ids.a}) yearLinks,
            (SELECT COUNT(*) FROM dbo.identity_audit_events WHERE school_id=${ids.a}) audits`)).recordset[0];
        const initial=await counts();
        await assert.rejects(people.register(b,'student',input),e=>e.statusCode===404);
        await assert.rejects(people.register(a,'student',{...input,placement:{...input.placement,fromDate:'9999-01-01'}}),e=>e.statusCode===422);
        await assert.rejects(people.register(a,'student',{...input,placement:{...input.placement,yearId:ids.yn}}),e=>e.statusCode===404);
        await assert.rejects(people.register(a,'student',{...input,placement:{...input.placement,classId:ids.cb}}),e=>e.statusCode===404);
        assert.deepEqual(await counts(),initial);
        await query(`CREATE TRIGGER dbo.${trigger} ON dbo.identity_audit_events AFTER INSERT AS IF EXISTS(
            SELECT 1 FROM inserted WHERE school_id=${ids.a} AND action='personnel_registered') THROW 50191,'Synthetic final audit failure',1;`);triggerInstalled=true;
        await assert.rejects(people.register(a,'student',input),e=>e.statusCode===500);assert.deepEqual(await counts(),initial);
        await query(`DROP TRIGGER dbo.${trigger}`);triggerInstalled=false;
        const origin='https://lms.example.invalid';const base=await serve(t,createApp({logging:false,routes:[
            ['/people',createScopedPersonnelRouter({identityService:identity,database:db,publicOrigin:origin,enrolmentLedger:true})],
            ['/ledger',createEnrolmentLedgerRouter({identityService:identity,database:db,publicOrigin:origin,readOnly:true})]]}));
        const headers={Cookie:`__Host-lms_session=${session.token}`,Origin:origin,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json'};
        const post=(body,extra={})=>fetch(base+'/people/students',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
        assert.equal((await post(input,{'X-CSRF-Token':''})).status,403);
        assert.equal((await post(input,{Cookie:`__Host-lms_session=${teacher.token}`})).status,403);
        const result=await post(input);assert.equal(result.status,201);const created=(await result.json()).data;
        assert.equal(created.enrolment.version,1);
        const rows=await ledger.history(a,created.id);assert.equal(rows.length,1);assert.equal(rows[0].fromDate,input.placement.fromDate);assert.equal(rows[0].id,created.enrolment.id);
        const record=(await query(`SELECT s.currentClassLevel,s.academicYearId,s.profile_version,
            CASE WHEN s.password COLLATE Latin1_General_100_BIN2=a.password_hash COLLATE Latin1_General_100_BIN2 THEN 1 ELSE 0 END matching_credentials,
            (SELECT COUNT(*) FROM dbo.academic_year_students y WHERE y.school_id=s.school_id AND y.student_id=s.id AND y.academic_year_id=${ids.ya}) year_links
            FROM dbo.students s JOIN dbo.legacy_account_map l ON l.school_id=s.school_id AND l.legacy_id=s.id AND l.source_table='students'
            JOIN dbo.accounts a ON a.id=l.account_id WHERE s.id=${created.id}`)).recordset[0];
        assert.deepEqual(record,{currentClassLevel:ids.ca,academicYearId:ids.ya,profile_version:1,matching_credentials:1,year_links:1});
        const old=await ledger.history(a,created.id);await people.update(a,'student',created.id,1,{lastName:'Corrected'});assert.deepEqual(await ledger.history(a,created.id),old);
        await assert.rejects(people.setStatus(a,'student',created.id,2,'withdrawn','withdrawal'),e=>e.statusCode===409);
        const denied=await fetch(base+'/ledger',{method:'POST',headers,body:'{}'});assert.equal(denied.status,405);
        const replay=await post(input);assert.equal(replay.status,409);assert.equal((await counts()).enrolments,1);
        assert.equal((await query(`SELECT COUNT(*) n FROM dbo.student_fees WHERE school_id IN(${ids.a},${ids.b})`)).recordset[0].n,0);
    }finally{
        if(triggerInstalled)await query(`DROP TRIGGER dbo.${trigger}`);
        if(installed){const unexpected=(await query(`SELECT COUNT(*) n FROM dbo.student_enrolments ${ids?`WHERE school_id NOT IN(${ids.a},${ids.b})`:''}`)).recordset[0].n;
            assert.equal(unexpected,0);await query('DROP TABLE dbo.student_enrolment_revisions;DROP TABLE dbo.student_enrolments;');}
        if(ids)await removeEnrolmentFixture(db,ids);
    }
    assert.deepEqual(await baseline(),before);
});
