const { test }=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const { createDatabase,sql }=require('../../config/database');
const { loadTestEnvironment,assertSyntheticDatabase }=require('../../scripts/testEnvironment');
const { createIdentityService }=require('../../model/identity/identityService');
const { createSchoolAccess }=require('../../model/identity/schoolAccess');
const { createPersonnelService }=require('../../model/identity/personnelService');
const { createPersonnelRepository }=require('../../model/identity/personnelRepository');
const { createScopedPersonnelRouter }=require('../../routes/identity/personnelRouter');
const { createIdentityRouter }=require('../../routes/identity/identityRouter');
const { createApp }=require('../../app/app');
const { serve }=require('../helpers/http');

test('scoped personnel writes register atomically, reject stale/cross-school edits and revoke only the target membership',async t=>{
    loadTestEnvironment();
    const db=createDatabase();t.after(()=>db.close());
    await assertSyntheticDatabase(db);
    await require('../../scripts/migrate').migrate(db);
    const prefix=`PERSON_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const password=crypto.randomBytes(24).toString('base64url');
    const trigger=`personnel_test_${crypto.randomBytes(8).toString('hex')}`;
    let ids,triggerInstalled=false;
    try {
        ids=(await db.getPool().request().input('prefix',sql.NVarChar(50),prefix).query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'A',N'Synthetic A','Anglophone','active');
            DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'B',N'Synthetic B','Bilingual','active');
            DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'adminA',N'unusable-fixture-hash','active');
            DECLARE @adminA INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'adminB',N'unusable-fixture-hash','active');
            DECLARE @adminB INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@adminA,'active');
            DECLARE @ma INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@adminB,'active');
            DECLARE @mb INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@b,@mb,'admin');
            SELECT @a AS a,@b AS b,@adminA AS admin_a,@adminB AS admin_b,@ma AS ma,@mb AS mb;
        `)).recordset[0];
        const identity=createIdentityService(db),access=createSchoolAccess(identity);
        const writes=createPersonnelService(access,db),reads=createPersonnelRepository(access,db);
        const sessionA=await identity.createSession(ids.admin_a,ids.ma),sessionB=await identity.createSession(ids.admin_b,ids.mb);
        const contextA=await access.resolve(sessionA.token),contextB=await access.resolve(sessionB.token);
        const placements=(await db.getPool().request().input('name',sql.NVarChar(50),prefix).query(`
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone',@name,1,${ids.a});DECLARE @aClass INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone',@name,1,${ids.b});DECLARE @bClass INT=SCOPE_IDENTITY();
            INSERT dbo.academic_years(name,fromYear,toYear,isCurrent,school_id,created_by_account_id) VALUES('2026/2027',2026,2027,1,${ids.a},${ids.admin_a});
            SELECT @aClass AS class_a,@bClass AS class_b,CONVERT(int,SCOPE_IDENTITY()) AS year_a;`)).recordset[0];
        const studentInput={ firstName:'Synthetic',lastName:'Student',matricule:`${prefix}A`,section:'Anglophone',sex:'Male',password,
            dateOfBirth:'2012-05-09',parentName:'Synthetic guardian',parentPhone:'600000001',placement:{classId:placements.class_a,yearId:placements.year_a} };
        const studentA=await writes.register(contextA,'student',studentInput);
        const foreignInput={...studentInput,matricule:`${prefix}B`};delete foreignInput.placement;
        const studentB=await writes.register(contextB,'student',foreignInput);
        await assert.rejects(writes.register(contextA,'student',{...studentInput,matricule:`${prefix}INVALID`,placement:{classId:placements.class_b,yearId:placements.year_a}}),err=>err.statusCode===404);
        const privateProfile=await reads.editProfile(contextA,'student',studentA.id);
        assert.equal(privateProfile.parentName,'Synthetic guardian');assert.equal(privateProfile.currentClassLevel,placements.class_a);
        assert.equal(Object.hasOwn(privateProfile,'password'),false);assert.equal(Object.hasOwn(privateProfile,'medicalStatus'),false);
        const peerA=await writes.register(contextA,'student',{ ...studentInput,matricule:`${prefix}PEER` });
        const teacherInput={ firstName:'Synthetic',lastName:'Teacher',email:`${prefix}A@example.invalid`,section:'Anglophone',employmentType:'Part-time',password,
            gender:'Female',civilStatus:'Single',noOfChildren:0,idCardNo:'SYNTHETIC-ONLY',dateOfIssue:'2025-01-01',secondaryContactName:'Synthetic contact' };
        const teacherA=await writes.register(contextA,'teacher',teacherInput);
        const teacherB=await writes.register(contextB,'teacher',{ ...teacherInput,email:`${prefix}B@example.invalid` });
        const teacherList=await reads.listTeachers(contextA,{ search:prefix });
        assert.equal(teacherList.total,1);assert.deepEqual(teacherList.data.map(row=>row.id),[teacherA.id]);
        assert.equal(Object.hasOwn(teacherList.data[0],'password'),false);
        assert.equal(studentA.version,1);assert.equal(teacherA.version,1);
        await assert.rejects(writes.register(contextA,'student',studentInput),err=>err.statusCode===409);
        await assert.rejects(writes.update(contextA,'student',studentB.id,1,{ firstName:'Forbidden' }),err=>err.statusCode===404);
        await assert.rejects(writes.update(contextA,'teacher',teacherB.id,1,{ lastName:'Forbidden' }),err=>err.statusCode===404);
        await assert.rejects(writes.setStatus(contextA,'student',studentB.id,1,'withdrawn','withdrawal'),err=>err.statusCode===404);
        await assert.rejects(writes.register(contextA,'student',{ ...studentInput,matricule:`${prefix}FORGED`,schoolId:ids.b }),err=>err.statusCode===422);
        const studentLogin=await identity.loginSchoolIdentity(`${prefix}A`,'student',studentInput.matricule,password);
        const studentContext=await access.resolve(studentLogin.token);
        await assert.rejects(reads.editProfile(studentContext,'student',studentA.id),err=>err.statusCode===403);
        assert.equal((await reads.getStudent(studentContext,studentA.id)).id,studentA.id);
        assert.equal(await reads.getStudent(studentContext,peerA.id),null);
        assert.equal(await reads.getStudent(studentContext,studentB.id),null);
        await assert.rejects(writes.update(studentContext,'student',studentA.id,1,{ firstName:'Forbidden' }),err=>err.statusCode===403);
        await assert.rejects(identity.loginSchoolIdentity(`${prefix}B`,'student',studentInput.matricule,password),/Access denied/);
        const teacherLogin=await identity.loginSchoolIdentity(`${prefix}A`,'teacher',teacherInput.email,password);
        const teacherContext=await access.resolve(teacherLogin.token);
        assert.equal((await reads.getTeacher(teacherContext,teacherA.id)).id,teacherA.id);
        assert.equal(await reads.getTeacher(teacherContext,teacherB.id),null);
        await assert.rejects(reads.listTeachers(teacherContext),err=>err.statusCode===403);
        await assert.rejects(writes.register(teacherContext,'student',{ ...studentInput,matricule:`${prefix}DENIED` }),err=>err.statusCode===403);
        const updated=await writes.update(contextA,'student',studentA.id,1,{ firstName:'Updated',middleName:null });
        assert.equal(updated.version,2);
        await assert.rejects(writes.update(contextA,'student',studentA.id,1,{ lastName:'Stale' }),err=>err.statusCode===409);
        const competing=await Promise.allSettled([
            writes.update(contextA,'student',studentA.id,2,{ lastName:'Edit one' }),
            writes.update(contextA,'student',studentA.id,2,{ lastName:'Edit two' }),
        ]);
        assert.equal(competing.filter(result=>result.status==='fulfilled').length,1);
        assert.equal(competing.find(result=>result.status==='rejected').reason.statusCode,409);
        assert.equal((await reads.getStudent(contextA,studentA.id)).version,3);
        await writes.setStatus(contextA,'student',studentA.id,3,'withdrawn','withdrawal');
        assert.equal(await identity.resolveSession(studentLogin.token),null);
        await assert.rejects(identity.loginSchoolIdentity(`${prefix}A`,'student',studentInput.matricule,password),/Access denied/);
        await writes.setStatus(contextA,'student',studentA.id,4,'active','return_to_school');
        assert.ok(await identity.resolveSession((await identity.loginSchoolIdentity(`${prefix}A`,'student',studentInput.matricule,password)).token));
        const mappedTeacher=(await db.getPool().request().query(`SELECT account_id,membership_id FROM dbo.legacy_account_map WHERE source_table='teachers' AND legacy_id=${teacherA.id}`)).recordset[0];
        const otherMembership=(await db.getPool().request().query(`
            INSERT dbo.school_memberships(school_id,account_id,status) OUTPUT INSERTED.id VALUES(${ids.b},${mappedTeacher.account_id},'active');
        `)).recordset[0].id;
        await db.getPool().request().query(`INSERT dbo.membership_roles VALUES(${ids.b},${otherMembership},'teacher')`);
        const teacherOtherSession=await identity.createSession(mappedTeacher.account_id,otherMembership);
        await writes.setStatus(contextA,'teacher',teacherA.id,1,'suspended','employment_change');
        assert.equal(await identity.resolveSession(teacherLogin.token),null);
        assert.equal((await identity.resolveSession(teacherOtherSession.token)).schoolId,ids.b);
        await db.getPool().request().query(`UPDATE dbo.accounts SET status='disabled' WHERE id=${mappedTeacher.account_id}`);
        await assert.rejects(writes.setStatus(contextA,'teacher',teacherA.id,2,'active','employment_change'),err=>err.statusCode===409);
        assert.equal((await reads.getTeacher(contextA,teacherA.id)).status,'suspended');
        await assert.rejects(writes.update(contextA,'teacher',teacherA.id,2,{ employmentType:'Government' }),err=>err.statusCode===422);
        assert.equal((await reads.getTeacher(contextA,teacherA.id)).version,2);
        // Fail the last write deliberately: profile/account/membership/map must all roll back.
        await db.getPool().request().batch(`CREATE TRIGGER dbo.[${trigger}] ON dbo.identity_audit_events AFTER INSERT AS
            BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE school_id=${ids.a} AND actor_account_id=${ids.admin_a} AND action='personnel_registered')
                THROW 50020,'Synthetic audit failure',1; END;`);
        triggerInstalled=true;
        const snapshot=async()=>(await db.getPool().request().query(`
            SELECT (SELECT COUNT(*) FROM dbo.students WHERE school_id=${ids.a}) AS profiles,
                (SELECT COUNT(*) FROM dbo.legacy_account_map WHERE school_id=${ids.a}) AS mappings,
                (SELECT COUNT(*) FROM dbo.school_memberships WHERE school_id=${ids.a}) AS memberships,
                (SELECT COUNT(*) FROM dbo.accounts) AS accounts;
        `)).recordset[0];
        const before=await snapshot();
        await assert.rejects(writes.register(contextA,'student',{ ...studentInput,matricule:`${prefix}ROLLBACK` }),err=>err.statusCode===500);
        assert.deepEqual(await snapshot(),before);
        await db.getPool().request().query(`DROP TRIGGER dbo.[${trigger}]`);triggerInstalled=false;
        const audit=(await db.getPool().request().query(`SELECT reason_code,resource_version_before,resource_version_after,changed_fields FROM dbo.identity_audit_events WHERE school_id=${ids.a}`)).recordset;
        assert.ok(audit.some(row=>row.reason_code==='withdrawal' && row.resource_version_before===3 && row.resource_version_after===4));
        assert.equal(JSON.stringify(audit).includes(password),false);
        assert.equal(audit.some(row=>row.changed_fields?.includes('password')),false);
        // Exercise the unmounted HTTP factories together against real synthetic SQL.
        const origin='https://lms.example.invalid';
        const base=await serve(t,createApp({ logging:false,routes:[
            ['/identity',createIdentityRouter({ service:identity,publicOrigin:origin })],
            ['/personnel',createScopedPersonnelRouter({ identityService:identity,database:db,publicOrigin:origin })],
        ] }));
        const headers={ Origin:origin,'Content-Type':'application/json',Cookie:`__Host-lms_session=${sessionA.token}`,'X-CSRF-Token':sessionA.csrfToken };
        const post=(path,body,overrides={})=>fetch(`${base}${path}`,{ method:'POST',headers:{ ...headers,...overrides },body:JSON.stringify(body) });
        assert.equal((await post('/personnel/students',{ ...studentInput,matricule:`${prefix}CSRF` },{ 'X-CSRF-Token':'wrong' })).status,403);
        assert.equal((await post('/personnel/students',{ ...studentInput,matricule:`${prefix}ORIGIN` },{ Origin:'https://attacker.invalid' })).status,403);
        const created=await post('/personnel/students',{ ...studentInput,matricule:`${prefix}HTTP` });
        assert.equal(created.status,201);
        const createdId=(await created.json()).data.id;
        const httpLogin=await post('/identity/login',{ accountType:'student',schoolCode:`${prefix}A`,identifier:`${prefix}HTTP`,password },{ Cookie:'' });
        assert.equal(httpLogin.status,200);assert.match(httpLogin.headers.get('set-cookie'),/HttpOnly/);
        const response=await fetch(`${base}/personnel/students/${createdId}`,{ headers });
        assert.equal(response.status,200);assert.equal((await response.json()).data.version,1);
        assert.equal((await fetch(`${base}/personnel/students/${studentB.id}`,{ headers })).status,404);
        assert.equal((await fetch(`${base}/personnel/students?limit=1e2`,{ headers })).status,422);
        const httpPatch=await fetch(`${base}/personnel/students/${createdId}`,{ method:'PATCH',headers,body:JSON.stringify({ version:1,lastName:'HTTP update' }) });
        assert.equal(httpPatch.status,200);assert.equal((await httpPatch.json()).data.version,2);
        const httpStatus=await post(`/personnel/students/${createdId}/status`,{ version:2,status:'withdrawn',reason:'withdrawal' });
        assert.equal(httpStatus.status,200);
        const teacherHttp=await fetch(`${base}/personnel/teachers?search=${prefix}`,{ headers });
        assert.equal(teacherHttp.status,200);assert.equal((await teacherHttp.json()).total,1);
        const descriptor=await access.authorize(contextA,['admin']);
        await identity.revokeSession(sessionA.token);
        const staleService=createPersonnelService({ async authorize(){ return descriptor; } },db);
        await assert.rejects(staleService.update(contextA,'student',peerA.id,1,{ firstName:'Revoked write' }),err=>err.statusCode===403);
        assert.equal((await reads.getStudent(contextB,studentB.id)).version,1);
    } finally {
        if(triggerInstalled) await db.getPool().request().query(`DROP TRIGGER dbo.[${trigger}]`);
        if(ids) await db.getPool().request().query(`
            DECLARE @accounts TABLE(id INT PRIMARY KEY);
            INSERT @accounts SELECT account_id FROM dbo.legacy_account_map WHERE school_id IN(${ids.a},${ids.b});
            INSERT @accounts VALUES(${ids.admin_a}),(${ids.admin_b});
            DELETE dbo.identity_audit_events WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.academic_year_students WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.students WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.academic_years WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.classes WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.account_sessions WHERE account_id IN(SELECT id FROM @accounts);
            DELETE dbo.legacy_account_map WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.membership_roles WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.accounts WHERE id IN(SELECT id FROM @accounts);
            DELETE dbo.students WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.teachers WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.schools WHERE id IN(${ids.a},${ids.b});
        `);
    }
});
