const { test }=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const bcrypt=require('bcrypt');
const { createDatabase,sql }=require('../../config/database');
const { loadTestEnvironment,assertSyntheticDatabase }=require('../../scripts/testEnvironment');
const { createReconciler,canonicalKey }=require('../../scripts/reconcileSchool');
const { createIdentityService }=require('../../model/identity/identityService');
const { createSchoolAccess }=require('../../model/identity/schoolAccess');
const { createPersonnelRepository }=require('../../model/identity/personnelRepository');

test('synthetic reconciliation dry-run, stale-plan refusal, atomic rollback and repeat-safe mappings',async t=>{
    loadTestEnvironment();
    const db=createDatabase();t.after(()=>db.close());
    await assertSyntheticDatabase(db);
    await require('../../scripts/migrate').migrate(db);
    const prefix=`RECON_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const password=await bcrypt.hash(crypto.randomBytes(24).toString('hex'),4);
    let ids;
    try {
        ids=(await db.getPool().request().input('p',sql.NVarChar(50),prefix).input('password',sql.NVarChar(255),password).query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'A',N'Synthetic A','Anglophone','active');
            DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'B',N'Synthetic B','Francophone','active');
            DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'operator',@password,'active');
            DECLARE @operator INT=SCOPE_IDENTITY();
            INSERT dbo.platform_role_grants(account_id,permission,granted_by) VALUES(@operator,'school_onboarding',@operator);
            INSERT dbo.Admins(name,email,password,role) VALUES(N'Synthetic',@p+'@example.invalid',@password,'admin');
            DECLARE @admin INT=SCOPE_IDENTITY();
            INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,status)
            VALUES(N'Synthetic',N'Synthetic',N'Teacher',@p+'@example.invalid',@password,'Part-time','Anglophone','suspended');
            DECLARE @teacher INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,class_master_id) VALUES('Anglophone',@p+'A',1,@teacher);
            DECLARE @class INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Francophone',@p+'B',1,@b);
            DECLARE @foreignClass INT=SCOPE_IDENTITY();
            INSERT dbo.academic_years(name,fromYear,toYear,createdBy) VALUES(RIGHT(@p,16),2026,2027,@admin);
            DECLARE @year INT=SCOPE_IDENTITY();
            INSERT dbo.students(firstName,lastName,matricule,password,section,sex,currentClassLevel,academicYearId,isWithdrawn)
            VALUES(N'Synthetic',N'Student',@p,@password,'Anglophone','Male',@class,@year,1);
            DECLARE @student INT=SCOPE_IDENTITY();
            INSERT dbo.student_fees(student_id,fee_type,amount) VALUES(@student,N'synthetic',100);
            DECLARE @fee INT=SCOPE_IDENTITY();
            INSERT dbo.subjects(name,code,class_id,subject_master) VALUES(N'Synthetic',RIGHT(@p,16),@class,@teacher);
            DECLARE @subject INT=SCOPE_IDENTITY();
            INSERT dbo.class_subjects(class_id,subject_id) VALUES(@class,@subject);
            DECLARE @offering INT=SCOPE_IDENTITY();
            INSERT dbo.subject_scores(student_id,class_subject_id,academic_year_id,term,sequence,score,created_by)
            VALUES(@student,@offering,@year,'First',1,20,@teacher);
            DECLARE @score INT=SCOPE_IDENTITY();
            INSERT dbo.students(firstName,lastName,matricule,password,section,sex,currentClassLevel,school_id,medicalStatus)
            VALUES(N'Synthetic',N'Other school',@p+'B',@password,'Francophone','Female',@foreignClass,@b,N'Synthetic restricted field');
            DECLARE @foreignStudent INT=SCOPE_IDENTITY();
            INSERT dbo.students(firstName,lastName,matricule,password,section,sex)
            VALUES(N'Synthetic',N'Unresolved',@p+'U',@password,'Anglophone','Male');
            DECLARE @unresolvedStudent INT=SCOPE_IDENTITY();
            INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,status,school_id)
            VALUES(N'Synthetic',N'Synthetic',N'Other teacher',@p+'B@example.invalid',@password,'Part-time','Francophone','active',@b);
            DECLARE @foreignTeacher INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'unmapped',@password,'active');
            DECLARE @unmapped INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@unmapped,'active');
            DECLARE @unmappedMembership INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles VALUES(@a,@unmappedMembership,'student');
            SELECT @a AS a,@b AS b,@operator AS operator_id,@admin AS admin_id,@teacher AS teacher_id,@class AS class_id,
                @foreignClass AS foreign_class,@year AS year_id,@student AS student_id,@fee AS fee_id,@subject AS subject_id,@offering AS offering_id,@score AS score_id,
                @foreignStudent AS foreign_student,@unresolvedStudent AS unresolved_student,@foreignTeacher AS foreign_teacher,@unmapped AS unmapped_account,@unmappedMembership AS unmapped_membership;
        `)).recordset[0];
        const reconciler=createReconciler(db);
        const scope={ schoolId:ids.a,actorAccountId:ids.operator_id,attestationRef:`synthetic:${prefix}`,records:[
            { table:'students',id:ids.student_id },{ table:'Admins',id:ids.admin_id },{ table:'teachers',id:ids.teacher_id },
            { table:'classes',id:ids.class_id },{ table:'academic_years',id:ids.year_id },{ table:'student_fees',id:ids.fee_id },
            { table:'subjects',id:ids.subject_id },{ table:'class_subjects',id:ids.offering_id },{ table:'subject_scores',id:ids.score_id },
        ] };
        await assert.rejects(reconciler.plan({ ...scope,records:[{ table:'students',id:ids.student_id }] }),/unresolved parent/);
        await assert.rejects(reconciler.plan({ ...scope,records:[{ table:'classes',id:ids.foreign_class }] }),/another school/);
        await db.getPool().request().query(`UPDATE dbo.students SET currentClassLevel=${ids.foreign_class} WHERE id=${ids.student_id}`);
        await assert.rejects(reconciler.plan(scope),/parent school conflict/);
        await db.getPool().request().query(`UPDATE dbo.students SET currentClassLevel=${ids.class_id} WHERE id=${ids.student_id}`);
        const plan=await reconciler.plan(scope);
        assert.equal(JSON.stringify(plan).includes(password),false);
        assert.equal(JSON.stringify(plan).includes('@example.invalid'),false);
        await assert.rejects(reconciler.apply({ ...plan,schoolId:ids.b }),/checksum mismatch/);
        const dry=await reconciler.apply(plan,{ dryRun:true });
        assert.equal(dry.dryRun,true);assert.equal(dry.mappedAccountCount,3);
        const unchanged=await db.getPool().request().query(`SELECT school_id FROM dbo.students WHERE id=${ids.student_id}; SELECT COUNT(*) AS count FROM dbo.ownership_reconciliation_runs WHERE school_id=${ids.a}`);
        assert.equal(unchanged.recordsets[0][0].school_id,null);assert.equal(unchanged.recordsets[1][0].count,0);
        await db.getPool().request().query(`UPDATE dbo.teachers SET status='active' WHERE id=${ids.teacher_id}`);
        await assert.rejects(reconciler.apply(plan),/source or schema changed/);
        await db.getPool().request().query(`UPDATE dbo.teachers SET status='suspended' WHERE id=${ids.teacher_id}`);
        // A collision introduced after planning must roll back earlier ownership/mapping writes too.
        await db.getPool().request().input('key',sql.NVarChar(255),canonicalKey('students',ids.student_id)).input('password',sql.NVarChar(255),password)
            .query("INSERT dbo.accounts(login_key,password_hash,status) VALUES(@key,@password,'disabled')");
        await assert.rejects(reconciler.apply(plan),/no changes committed/);
        const rollback=await db.getPool().request().query(`SELECT school_id FROM dbo.Admins WHERE id=${ids.admin_id}; SELECT COUNT(*) AS count FROM dbo.legacy_account_map WHERE source_table='Admins' AND legacy_id=${ids.admin_id}`);
        assert.equal(rollback.recordsets[0][0].school_id,null);assert.equal(rollback.recordsets[1][0].count,0);
        await db.getPool().request().input('key',sql.NVarChar(255),canonicalKey('students',ids.student_id)).query('DELETE FROM dbo.accounts WHERE login_key=@key');
        const concurrent=await Promise.all([reconciler.apply(plan),reconciler.apply(plan)]);
        assert.equal(concurrent.filter(result=>result.alreadyApplied).length,1);
        const applied=concurrent.find(result=>!result.alreadyApplied);
        assert.equal(applied.recordCount,9);assert.equal(applied.mappedAccountCount,3);
        const repeated=await reconciler.apply(plan);
        assert.equal(repeated.alreadyApplied,true);assert.equal(repeated.runId,applied.runId);
        const rows=await db.getPool().request().query(`
            SELECT l.source_table,a.status,a.password_hash,m.status AS membership_status
            FROM dbo.legacy_account_map l JOIN dbo.accounts a ON a.id=l.account_id JOIN dbo.school_memberships m ON m.id=l.membership_id
            WHERE l.school_id=${ids.a} ORDER BY l.source_table;
            SELECT score,created_by FROM dbo.subject_scores WHERE id=${ids.score_id};
            SELECT COUNT(*) AS count FROM dbo.platform_role_grants WHERE account_id IN(SELECT account_id FROM dbo.legacy_account_map WHERE school_id=${ids.a});
            SELECT COUNT(*) AS count FROM dbo.ownership_reconciliation_items WHERE run_id='${applied.runId}';
        `);
        assert.equal(rows.recordsets[0].length,3);
        for(const row of rows.recordsets[0]) {
            assert.equal(row.password_hash,password);
            assert.equal(row.status,row.source_table==='Admins'?'active':'disabled');
            assert.equal(row.membership_status,row.source_table==='Admins'?'active':'revoked');
        }
        assert.equal(rows.recordsets[1][0].created_by,ids.teacher_id);
        assert.equal(rows.recordsets[1][0].score,20);
        assert.equal(rows.recordsets[2][0].count,0);
        assert.equal(rows.recordsets[3][0].count,9);
        const newPlan=await reconciler.plan(scope);
        const existing=await reconciler.apply(newPlan);
        assert.equal(existing.mappedAccountCount,0);
        const identityService=createIdentityService(db);
        const access=createSchoolAccess(identityService);
        const personnel=createPersonnelRepository(access,db);
        const mappedAdmin=(await db.getPool().request().query(`SELECT account_id,membership_id FROM dbo.legacy_account_map WHERE source_table='Admins' AND legacy_id=${ids.admin_id}`)).recordset[0];
        const session=await identityService.createSession(mappedAdmin.account_id,mappedAdmin.membership_id);
        const context=await access.resolve(session.token);
        const list=await personnel.listStudents(context,{ search:prefix,schoolId:ids.b });
        assert.equal(list.total,1);assert.deepEqual(list.data.map(row=>row.id),[ids.student_id]);
        assert.equal(Object.hasOwn(list.data[0],'password'),false);
        assert.equal(Object.hasOwn(list.data[0],'medicalStatus'),false);
        assert.equal((await personnel.getStudent(context,ids.student_id)).id,ids.student_id);
        assert.equal(await personnel.getStudent(context,ids.foreign_student),null);
        assert.equal(await personnel.getStudent(context,ids.unresolved_student),null);
        assert.equal((await personnel.getTeacher(context,ids.teacher_id)).id,ids.teacher_id);
        assert.equal(await personnel.getTeacher(context,ids.foreign_teacher),null);
        await assert.rejects(personnel.listStudents({ ...context,schoolId:ids.b }),/Access denied/);
        const isolated=await Promise.all(Array.from({ length:8 },(_,index)=>personnel.getStudent(context,index%2?ids.foreign_student:ids.student_id)));
        assert.equal(isolated.filter(Boolean).length,4);
        const unmappedSession=await identityService.createSession(ids.unmapped_account,ids.unmapped_membership);
        const unmappedContext=await access.resolve(unmappedSession.token);
        assert.equal(await personnel.getStudent(unmappedContext,ids.student_id),null);
        await assert.rejects(personnel.listStudents(unmappedContext),/Access denied/);
        const platformSession=await identityService.createSession(ids.operator_id);
        await assert.rejects(access.resolve(platformSession.token),/Access denied/);
        // Simulate revocation after the service check: the data statement must independently deny it.
        const descriptor=await access.authorize(context,['admin']);
        await identityService.revokeSession(session.token);
        await assert.rejects(personnel.listStudents(context),/Access denied/);
        const revokedRepository=createPersonnelRepository({ async authorize(){ return descriptor; } },db);
        assert.equal((await revokedRepository.listStudents(context)).total,0);
        assert.equal(await revokedRepository.getStudent(context,ids.student_id),null);
        await assert.rejects(reconciler.plan({ ...scope,schoolId:ids.b }),/another school/);
        await db.getPool().request().query(`UPDATE dbo.platform_role_grants SET revoked_at=SYSUTCDATETIME() WHERE account_id=${ids.operator_id}`);
        await assert.rejects(reconciler.apply(plan),/not authorised/);
    } finally {
        if(ids) {
            await db.getPool().request().input('p',sql.NVarChar(50),prefix).query(`
                DECLARE @accounts TABLE(id INT PRIMARY KEY);
                INSERT @accounts SELECT account_id FROM dbo.legacy_account_map WHERE school_id=${ids.a};
                INSERT @accounts SELECT id FROM dbo.accounts WHERE login_key IN(@p+'operator',@p+'unmapped') OR login_key IN
                    ('${canonicalKey('Admins',ids.admin_id)}','${canonicalKey('teachers',ids.teacher_id)}','${canonicalKey('students',ids.student_id)}')
                    AND id NOT IN(SELECT id FROM @accounts);
                DELETE dbo.ownership_reconciliation_items WHERE school_id=${ids.a};
                DELETE dbo.ownership_reconciliation_runs WHERE school_id=${ids.a};
                DELETE dbo.identity_audit_events WHERE school_id=${ids.a};
                DELETE dbo.account_sessions WHERE account_id IN(SELECT id FROM @accounts);
                DELETE dbo.legacy_account_map WHERE school_id=${ids.a};
                DELETE dbo.membership_roles WHERE school_id=${ids.a};
                DELETE dbo.school_memberships WHERE school_id=${ids.a};
                DELETE dbo.platform_role_grants WHERE account_id IN(SELECT id FROM @accounts);
                DELETE dbo.accounts WHERE id IN(SELECT id FROM @accounts);
                DELETE dbo.subject_scores WHERE id=${ids.score_id};
                DELETE dbo.class_subjects WHERE id=${ids.offering_id};
                DELETE dbo.student_fees WHERE id=${ids.fee_id};
                DELETE dbo.students WHERE id=${ids.student_id};
                DELETE dbo.students WHERE id IN(${ids.foreign_student},${ids.unresolved_student});
                DELETE dbo.subjects WHERE id=${ids.subject_id};
                DELETE dbo.classes WHERE id IN(${ids.class_id},${ids.foreign_class});
                DELETE dbo.academic_years WHERE id=${ids.year_id};
                DELETE dbo.teachers WHERE id IN(${ids.teacher_id},${ids.foreign_teacher});
                DELETE dbo.Admins WHERE id=${ids.admin_id};
                DELETE dbo.schools WHERE id IN(${ids.a},${ids.b});
            `);
        }
    }
});
