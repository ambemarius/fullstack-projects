const { test }=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const { createDatabase,sql }=require('../../config/database');
const { loadTestEnvironment,assertSyntheticDatabase }=require('../../scripts/testEnvironment');
const { createIdentityService }=require('../../model/identity/identityService');
const { createSchoolAccess }=require('../../model/identity/schoolAccess');
const { createAcademicSetupService }=require('../../model/identity/academicSetupService');
const { createPersonnelService }=require('../../model/identity/personnelService');
const { createScopedAcademicRouter }=require('../../routes/identity/academicSetupRouter');
const { createApp }=require('../../app/app');
const { serve }=require('../helpers/http');

test('academic setup isolates school keys/current years, canonical actors, parents and versioned transactions',async t=>{
    loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());
    await assertSyntheticDatabase(db);await require('../../scripts/migrate').migrate(db);
    const prefix=`ACA_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const trigger=`academic_test_${crypto.randomBytes(8).toString('hex')}`;
    let ids,triggerInstalled=false;
    try {
        ids=(await db.getPool().request().input('p',sql.NVarChar(50),prefix).query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'A',N'Synthetic A','Anglophone','active');DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'B',N'Synthetic B','Bilingual','active');DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'A',N'unusable-fixture-hash','active');DECLARE @adminA INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'B',N'unusable-fixture-hash','active');DECLARE @adminB INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@adminA,'active');DECLARE @ma INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@adminB,'active');DECLARE @mb INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@b,@mb,'admin');
            SELECT @a AS a,@b AS b,@adminA AS admin_a,@adminB AS admin_b,@ma AS ma,@mb AS mb;
        `)).recordset[0];
        const identity=createIdentityService(db),access=createSchoolAccess(identity);
        const service=createAcademicSetupService(access,db),personnel=createPersonnelService(access,db);
        const sessionA=await identity.createSession(ids.admin_a,ids.ma),sessionB=await identity.createSession(ids.admin_b,ids.mb);
        const a=await access.resolve(sessionA.token),b=await access.resolve(sessionB.token);
        const yearA=await service.create(a,'year',{ fromYear:2026,toYear:2027,isCurrent:true });
        const yearB=await service.create(b,'year',{ fromYear:2026,toYear:2027,isCurrent:true });
        assert.equal((await service.context(a)).currentYear.id,yearA.id);
        assert.equal((await service.context(b)).currentYear.id,yearB.id);
        const creator=(await db.getPool().request().query(`SELECT createdBy,created_by_account_id FROM dbo.academic_years WHERE id=${yearA.id}`)).recordset[0];
        assert.equal(creator.createdBy,null);assert.equal(creator.created_by_account_id,ids.admin_a);
        await assert.rejects(service.create(a,'year',{ fromYear:2026,toYear:2027 }),err=>err.statusCode===409);
        const yearA2=await service.create(a,'year',{ fromYear:2027,toYear:2028 });
        const concurrent=await Promise.allSettled([service.setCurrent(a,yearA2.id,1),service.setCurrent(a,yearA2.id,1)]);
        assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
        assert.equal(concurrent.find(result=>result.status==='rejected').reason.statusCode,409);
        const currentRows=(await service.list(a,'year')).filter(row=>row.isCurrent);
        assert.equal(currentRows.length,1);assert.equal((await service.context(b)).currentYear.id,yearB.id);
        await assert.rejects(service.setCurrent(a,yearB.id,1),err=>err.statusCode===404);
        assert.equal((await service.context(a)).currentYear.id,currentRows[0].id);
        const yearVersion=(await service.list(a,'year')).find(row=>row.id===yearA2.id).version;
        await service.update(a,'year',yearA2.id,yearVersion,{ toYear:2029 });
        await assert.rejects(service.update(a,'year',yearA2.id,yearVersion+1,{ toYear:2020 }),err=>err.statusCode===422);
        const password=crypto.randomBytes(24).toString('base64url');
        const teacherFields={ firstName:'Synthetic',lastName:'Teacher',email:`${prefix}@example.invalid`,section:'Anglophone',employmentType:'Part-time',password };
        const teacherA=await personnel.register(a,'teacher',teacherFields);
        const teacherB=await personnel.register(b,'teacher',teacherFields);
        const pupilFields={ firstName:'Synthetic',lastName:'Pupil',matricule:prefix,section:'Anglophone',sex:'Male',password };
        const pupilA=await personnel.register(a,'student',pupilFields);
        await personnel.register(b,'student',pupilFields);
        await db.getPool().request().input('email',sql.NVarChar(255),`${prefix}@example.invalid`).query(`
            INSERT dbo.Admins(name,email,password,role,school_id) VALUES(N'Synthetic admin',@email,N'unusable-fixture-hash','admin',${ids.a}),
                (N'Synthetic admin',@email,N'unusable-fixture-hash','admin',${ids.b});
            INSERT dbo.auxiliary_staff(name,firstName,lastName,email,role,school_id) VALUES(N'Synthetic',N'Synthetic',N'Auxiliary',@email,'clerk',${ids.a}),
                (N'Synthetic',N'Synthetic',N'Auxiliary',@email,'clerk',${ids.b});
        `);
        await assert.rejects(db.getPool().request().input('email',sql.NVarChar(255),`${prefix}@example.invalid`).query(`
            INSERT dbo.Admins(name,email,password,role,school_id) VALUES(N'Synthetic duplicate',@email,N'unusable-fixture-hash','admin',${ids.a})`));
        await assert.rejects(db.getPool().request().input('email',sql.NVarChar(255),`${prefix}@example.invalid`).query(`
            INSERT dbo.auxiliary_staff(name,firstName,lastName,email,role,school_id) VALUES(N'Synthetic',N'Synthetic',N'Duplicate',@email,'clerk',${ids.a})`));
        const unresolvedCode=prefix.slice(-16);
        ids.unresolved_subject=(await db.getPool().request().input('code',sql.NVarChar(20),unresolvedCode)
            .query("INSERT dbo.subjects(name,code) OUTPUT INSERTED.id VALUES(N'Synthetic unresolved subject',@code)")).recordset[0].id;
        await assert.rejects(db.getPool().request().input('code',sql.NVarChar(20),unresolvedCode)
            .query("INSERT dbo.subjects(name,code) VALUES(N'Synthetic duplicate unresolved subject',@code)"));
        const teacherSession=await identity.loginSchoolIdentity(`${prefix}A`,'teacher',teacherFields.email,password);
        const teacherContext=await access.resolve(teacherSession.token);
        const pupilSession=await identity.loginSchoolIdentity(`${prefix}A`,'student',pupilFields.matricule,password);
        const pupilContext=await access.resolve(pupilSession.token);
        assert.equal((await service.context(teacherContext)).currentYear.id,currentRows[0].id);
        assert.equal((await service.context(pupilContext)).currentYear.id,currentRows[0].id);
        await assert.rejects(service.list(teacherContext,'year'),err=>err.statusCode===403);
        await assert.rejects(service.create(pupilContext,'class',{ section:'Anglophone',name:'Forbidden',rank:1 }),err=>err.statusCode===403);
        const classFields={ section:'Anglophone',name:'Form 1 scoped',rank:1,class_master_id:teacherA.id };
        const classA=await service.create(a,'class',classFields);
        const classB=await service.create(b,'class',{ ...classFields,class_master_id:teacherB.id });
        await assert.rejects(service.create(a,'class',classFields),err=>err.statusCode===409);
        await assert.rejects(service.update(a,'class',classA.id,1,{ class_master_id:teacherB.id }),err=>err.statusCode===404);
        assert.equal((await service.list(a,'class'))[0].version,1);
        const subjectFields={ name:'Scoped mathematics',code:'MATH_SCOPED',coefficient:2,class_id:classA.id,subject_master:teacherA.id };
        const subjectA=await service.create(a,'subject',subjectFields);
        await service.create(b,'subject',{ ...subjectFields,class_id:classB.id,subject_master:teacherB.id });
        await assert.rejects(service.create(a,'subject',subjectFields),err=>err.statusCode===409);
        await assert.rejects(service.create(a,'subject',{ ...subjectFields,code:'FOREIGN_PARENT',class_id:classB.id }),err=>err.statusCode===404);
        const competing=await Promise.allSettled([
            service.update(a,'subject',subjectA.id,1,{ description:'Change one' }),
            service.update(a,'subject',subjectA.id,1,{ description:'Change two' }),
        ]);
        assert.equal(competing.filter(row=>row.status==='fulfilled').length,1);
        assert.equal(competing.find(row=>row.status==='rejected').reason.statusCode,409);
        assert.deepEqual((await service.list(a,'class')).map(row=>row.id),[classA.id]);
        assert.equal((await service.list(a,'subject')).length,1);
        await db.getPool().request().query(`INSERT dbo.time_slots(slot_number,start_time,end_time,is_break,sort_order,school_id)
            VALUES(1,'08:00','09:00',0,1,${ids.a}),(2,'09:00','10:00',0,2,${ids.b})`);
        assert.equal((await service.context(pupilContext)).timeSlots.length,1);
        assert.equal((await service.context(pupilContext)).timeSlots[0].slot_number,1);
        await personnel.setStatus(a,'teacher',teacherA.id,1,'suspended','employment_change');
        await assert.rejects(service.create(a,'class',{ section:'Anglophone',name:'Inactive master denied',rank:1,class_master_id:teacherA.id }),err=>err.statusCode===404);
        // A late audit failure must restore the original current-year state and versions.
        await db.getPool().request().batch(`CREATE TRIGGER dbo.[${trigger}] ON dbo.identity_audit_events AFTER INSERT AS BEGIN
            IF EXISTS(SELECT 1 FROM inserted WHERE school_id=${ids.a} AND action='academic_created') THROW 50040,'Synthetic audit failure',1; END;`);
        triggerInstalled=true;
        const before=await service.list(a,'year');
        await assert.rejects(service.create(a,'year',{ fromYear:2029,toYear:2030,isCurrent:true }),err=>err.statusCode===500);
        assert.deepEqual(await service.list(a,'year'),before);
        await db.getPool().request().query(`DROP TRIGGER dbo.[${trigger}]`);triggerInstalled=false;
        const origin='https://lms.example.invalid';
        const base=await serve(t,createApp({ logging:false,routes:[['/academic',createScopedAcademicRouter({ identityService:identity,database:db,publicOrigin:origin })]] }));
        const headers={ Origin:origin,'Content-Type':'application/json',Cookie:`__Host-lms_session=${sessionA.token}`,'X-CSRF-Token':sessionA.csrfToken };
        const httpCreated=await fetch(`${base}/academic/subjects`,{ method:'POST',headers,body:JSON.stringify({ name:'HTTP subject',code:'HTTP_SCOPED' }) });
        assert.equal(httpCreated.status,201);
        const httpId=(await httpCreated.json()).data.id;
        const httpEdit=await fetch(`${base}/academic/subjects/${httpId}`,{ method:'PATCH',headers,body:JSON.stringify({ version:1,name:'Edited subject' }) });
        assert.equal(httpEdit.status,200);
        const noCsrf=await fetch(`${base}/academic/classes`,{ method:'POST',headers:{ ...headers,'X-CSRF-Token':'' },body:JSON.stringify({ section:'Anglophone',name:'Denied',rank:1 }) });
        assert.equal(noCsrf.status,403);
        const foreign=await fetch(`${base}/academic/academic-years/${yearB.id}/current`,{ method:'POST',headers,body:'{"version":1}' });
        assert.equal(foreign.status,404);
        const minimal=await fetch(`${base}/academic/context`,{ headers:{ Cookie:`__Host-lms_session=${pupilSession.token}` } });
        assert.equal(minimal.status,200);assert.equal((await minimal.json()).data.timeSlots.length,1);
        const descriptor=await access.authorize(a,['admin']);
        await identity.revokeSession(sessionA.token);
        const revoked=createAcademicSetupService({ async authorize(){ return descriptor; } },db);
        await assert.rejects(revoked.create(a,'class',{ name:'Revoked',section:'Anglophone',rank:1 }),err=>err.statusCode===403);
        assert.equal((await revoked.list(a,'year')).length,0);
    } finally {
        if(triggerInstalled) await db.getPool().request().query(`DROP TRIGGER dbo.[${trigger}]`);
        if(ids) await db.getPool().request().query(`
            DECLARE @accounts TABLE(id INT PRIMARY KEY);
            INSERT @accounts SELECT account_id FROM dbo.legacy_account_map WHERE school_id IN(${ids.a},${ids.b});
            INSERT @accounts VALUES(${ids.admin_a}),(${ids.admin_b});
            DELETE dbo.identity_audit_events WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.subjects WHERE school_id IN(${ids.a},${ids.b});
            ${ids.unresolved_subject?`DELETE dbo.subjects WHERE id=${ids.unresolved_subject} AND school_id IS NULL;`:''}
            DELETE dbo.classes WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.students WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.time_slots WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.academic_years WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.Admins WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.auxiliary_staff WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.account_sessions WHERE account_id IN(SELECT id FROM @accounts);
            DELETE dbo.legacy_account_map WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.membership_roles WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.accounts WHERE id IN(SELECT id FROM @accounts);
            DELETE dbo.teachers WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.schools WHERE id IN(${ids.a},${ids.b});
        `);
    }
});
