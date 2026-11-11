const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createDatabase, sql } = require('../../config/database');
const { loadTestEnvironment, assertSyntheticDatabase } = require('../../scripts/testEnvironment');
const { createIdentityService } = require('../../model/identity/identityService');
const { createSchoolAccess } = require('../../model/identity/schoolAccess');
const { createAcademicHistoryReviewService } = require('../../model/identity/academicHistoryReviewService');
const { createSchoolApp } = require('../../scripts/canonicalSchool');
const { serve } = require('../helpers/http');

test('M2 history review preserves unknown evidence across current placement changes and isolates schools and roles', async t => {
    loadTestEnvironment();
    const db = createDatabase(); t.after(() => db.close()); await assertSyntheticDatabase(db);
    const counts = async () => (await db.getPool().request().query(`SELECT
        (SELECT COUNT(*) FROM dbo.students) students,(SELECT COUNT(*) FROM dbo.subject_scores) scores,
        (SELECT COUNT(*) FROM dbo.schools) schools,(SELECT COUNT(*) FROM dbo.schema_migrations) migrations`)).recordset[0];
    const before = await counts();
    const tx = new sql.Transaction(db.getPool()); await tx.begin();
    const query = text => new sql.Request(tx).query(text);
    const transactionDb = { connect: async () => {}, getPool: () => ({ request: () => new sql.Request(tx) }) };
    try {
        const ids = (await new sql.Request(tx).input('prefix', sql.NVarChar(40), 'HIST_' + crypto.randomBytes(5).toString('hex')).query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'A','History A','Anglophone','active');DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'B','History B','Anglophone','active');DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'A','unusable-fixture-hash','active');DECLARE @aa INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'B','unusable-fixture-hash','active');DECLARE @ab INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'T','unusable-fixture-hash','active');DECLARE @at INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@aa,'active');DECLARE @ma INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@ab,'active');DECLARE @mb INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@at,'active');DECLARE @mt INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@b,@mb,'admin'),(@a,@mt,'teacher');
            INSERT dbo.academic_years(name,fromYear,toYear,school_id,created_by_account_id) VALUES('2024/2025',2024,2025,@a,@aa);DECLARE @ya INT=SCOPE_IDENTITY();
            INSERT dbo.academic_years(name,fromYear,toYear,school_id,created_by_account_id) VALUES('2025/2026',2025,2026,@a,@aa);DECLARE @yn INT=SCOPE_IDENTITY();
            INSERT dbo.academic_years(name,fromYear,toYear,school_id,created_by_account_id) VALUES('2024/2025',2024,2025,@b,@ab);DECLARE @yb INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone','Form1',1,@a);DECLARE @ca INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone','Form2',2,@a);DECLARE @cn INT=SCOPE_IDENTITY();
            INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone','Form1',1,@b);DECLARE @cb INT=SCOPE_IDENTITY();
            INSERT dbo.subjects(name,code,school_id) VALUES('Maths','MATHS',@a);DECLARE @sa INT=SCOPE_IDENTITY();
            INSERT dbo.class_subjects(class_id,subject_id,school_id) VALUES(@ca,@sa,@a);DECLARE @oa INT=SCOPE_IDENTITY();
            INSERT dbo.class_subjects(class_id,subject_id,school_id) VALUES(@cn,@sa,@a);DECLARE @onext INT=SCOPE_IDENTITY();
            INSERT dbo.students(firstName,lastName,matricule,password,section,sex,school_id,currentClassLevel,academicYearId)
                VALUES('Synthetic','A','SAME','unusable-fixture-hash','Anglophone','Male',@a,@ca,@ya);DECLARE @pa INT=SCOPE_IDENTITY();
            INSERT dbo.students(firstName,lastName,matricule,password,section,sex,school_id,currentClassLevel,academicYearId)
                VALUES('Synthetic','B','SAME','unusable-fixture-hash','Anglophone','Male',@b,@cb,@yb);DECLARE @pb INT=SCOPE_IDENTITY();
            INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,school_id)
                VALUES('Synthetic Teacher','Synthetic','Teacher','same@example.invalid','unusable-fixture-hash','Government','Anglophone',@a);DECLARE @ta INT=SCOPE_IDENTITY();
            INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,school_id)
                VALUES('Synthetic Teacher','Synthetic','Teacher','same@example.invalid','unusable-fixture-hash','Government','Anglophone',@b);DECLARE @tb INT=SCOPE_IDENTITY();
            INSERT dbo.academic_year_students(academic_year_id,student_id,school_id) VALUES(@ya,@pa,@a);
            SELECT @a a,@b b,@aa aa,@ab ab,@at at,@ma ma,@mb mb,@mt mt,@ya ya,@yn yn,@yb yb,@ca ca,@cn cn,@oa oa,@onext onext,@pa pa,@pb pb,@ta ta,@tb tb;`)).recordset[0];
        const identity = createIdentityService(transactionDb), access = createSchoolAccess(identity);
        const sessionA = await identity.createSession(ids.aa, ids.ma), sessionB = await identity.createSession(ids.ab, ids.mb);
        const sessionT = await identity.createSession(ids.at, ids.mt);
        const a = await access.resolve(sessionA.token), b = await access.resolve(sessionB.token), teacher = await access.resolve(sessionT.token);
        const service = createAcademicHistoryReviewService(access, transactionDb);
        const unknown = await service.student(a, ids.pa, ids.ya);
        assert.equal(unknown.yearMembershipRecorded, true); assert.equal(unknown.placement.status, 'unknown');
        assert.equal(unknown.currentPlacement.classId, ids.ca); assert.equal(unknown.currentPlacement.historicalEvidence, false);
        await assert.rejects(service.student(a, ids.pb, ids.ya), e => e.statusCode === 404);
        await assert.rejects(service.student(a, ids.pa, ids.yb), e => e.statusCode === 404);
        await assert.rejects(service.student(b, ids.pa, ids.ya), e => e.statusCode === 404);
        await assert.rejects(service.student(teacher, ids.pa, ids.ya), e => e.statusCode === 403);
        await assert.rejects(service.teacher(a, ids.tb, ids.ya), e => e.statusCode === 404);
        await assert.rejects(service.teacher(a, ids.ta, ids.yb), e => e.statusCode === 404);
        await query(`INSERT dbo.class_subject_students(class_subject_id,student_id,academic_year_id,school_id,enrolment_status)
            VALUES(${ids.oa},${ids.pa},${ids.ya},${ids.a},'revoked');
            INSERT dbo.class_subject_teachers(class_subject_id,teacher_id,term,school_id,academic_year_id)
            VALUES(${ids.oa},${ids.ta},'First',${ids.a},NULL),(${ids.oa},${ids.ta},'First',${ids.a},${ids.ya}),(${ids.onext},${ids.ta},'Second',${ids.a},${ids.yn});`);
        const recorded = await service.student(a, ids.pa, ids.ya);
        assert.equal(recorded.placement.status, 'requires_confirmation'); assert.equal(recorded.subjectLinks[0].sourceStatus, 'revoked');
        const teaching = await service.teacher(a, ids.ta, ids.ya);
        assert.equal(teaching.assignments.length, 1); assert.equal(teaching.assignments[0].yearId, ids.ya);
        assert.equal(teaching.unresolvedYearAssignments.length, 1); assert.equal(teaching.unresolvedYearAssignments[0].yearId, null);
        assert.equal(teaching.grantsAccess, false);
        await query(`UPDATE dbo.students SET currentClassLevel=${ids.cn},academicYearId=${ids.yn},isWithdrawn=1 WHERE id=${ids.pa};`);
        const moved = await service.student(a, ids.pa, ids.ya);
        assert.deepEqual(moved.placement, recorded.placement); assert.deepEqual(moved.subjectLinks, recorded.subjectLinks);
        assert.equal(moved.currentPlacement.classId, ids.cn);
        // A score association can disagree with a subject link. It must remain evidence, not overwrite either fact.
        await query(`INSERT dbo.subject_scores(student_id,class_subject_id,academic_year_id,school_id,term,sequence,score,created_by)
            VALUES(${ids.pa},${ids.onext},${ids.ya},${ids.a},'First',1,25,123);`);
        const conflict = await service.student(a, ids.pa, ids.ya);
        assert.equal(conflict.placement.status, 'multiple_candidates'); assert.equal(conflict.placement.authoritative, false);
        assert.deepEqual(conflict.placement.candidateClassIds, [ids.ca, ids.cn]);
        assert.equal(conflict.scoreReferences.length, 1); assert.equal('score' in conflict.scoreReferences[0], false);
        assert.equal((await service.student(a, ids.pa, ids.yn)).placement.status, 'unknown');

        const origin = 'https://localhost:2027';
        const base = await serve(t, createSchoolApp(transactionDb, {
            identityService:identity,personnelWrites:true,academicHistoryReview:true
        }));
        const path = `/api/academic-history/students/${ids.pa}?yearId=${ids.ya}`;
        const headers = { Cookie: `__Host-lms_session=${sessionA.token}` };
        const registration=await fetch(base+'/registration',{headers});
        assert.equal(registration.status,200);const html=await registration.text();
        assert.match(html,/id="sourceReview"/);assert.match(html,/id="placementReview"/);
        const ok = await fetch(base + path, { headers }); assert.equal(ok.status, 200); assert.match(ok.headers.get('cache-control'), /no-store/);
        assert.deepEqual((await ok.json()).data, conflict);
        assert.equal((await fetch(base + path)).status, 403);
        assert.equal((await fetch(base + path, { headers: { Cookie: `__Host-lms_session=${sessionT.token}` } })).status, 403);
        assert.equal((await fetch(base + path, { headers: { Cookie: `__Host-lms_session=${sessionB.token}` } })).status, 404);
        assert.equal((await fetch(base + path + '&schoolId=' + ids.b, { headers })).status, 422);
        assert.equal((await fetch(base + `/api/academic-history/students/2147483648?yearId=${ids.ya}`, { headers })).status, 422);
        assert.equal((await fetch(base + path, { method: 'POST', headers: { ...headers, Origin: origin } })).status, 405);
        const ownTeacher = await fetch(base + `/api/academic-history/teachers/${ids.ta}?yearId=${ids.ya}`, { headers });
        assert.equal(ownTeacher.status, 200); assert.deepEqual((await ownTeacher.json()).data, teaching);
        await query(`UPDATE dbo.academic_years SET isCurrent=1 WHERE id IN(${ids.ya},${ids.yb});`);
        const review=(year,token=sessionA.token,suffix='')=>fetch(base+'/api/academic-history/placement-review?yearId='+year+suffix,{headers:{Cookie:'__Host-lms_session='+token}});
        assert.equal((await review(ids.ya,sessionT.token)).status,403);assert.equal((await review(ids.ya,sessionB.token)).status,404);
        assert.equal((await review(ids.yn)).status,409);assert.equal((await review(ids.ya,sessionA.token,'&schoolId=2')).status,422);
        assert.equal((await review(ids.ya,sessionA.token,'&afterStudentId=-1')).status,422);
        const page=async(year,token,suffix)=>(await (await review(year,token,suffix)).json()).data;
        assert.deepEqual((await page(ids.yb,sessionB.token)).pupils,[]);
        await query(`UPDATE dbo.students SET isWithdrawn=1 WHERE school_id=${ids.a} AND id=${ids.pa};
            DECLARE @n int=1;WHILE @n<=51 BEGIN
                INSERT dbo.students(firstName,lastName,matricule,password,section,sex,school_id,academicYearId)
                VALUES('Synthetic','Queue',CONCAT('QUEUE_',@n),'unusable-fixture-hash','Anglophone','Male',${ids.a},${ids.yn});
                SET @n+=1;END`);
        const first=await page(ids.ya);assert.equal(first.pupils.length,50);assert.equal(first.pupils[0].profileClass,null);
        assert.equal(first.pupils[0].profileYear,'2025/2026');assert.equal(first.nextAfterStudentId,first.pupils.at(-1).id);
        const last=await page(ids.ya,sessionA.token,'&afterStudentId='+first.nextAfterStudentId);
        assert.equal(last.pupils.length,1);assert.equal(last.nextAfterStudentId,null);
        assert.equal(new Set([...first.pupils,...last.pupils].map(p=>p.id)).size,51);
        assert.ok([...first.pupils,...last.pupils].every(p=>p.id!==ids.pa && p.id!==ids.pb && !('password' in p)));
        const staleDescriptor = await access.authorize(a, ['admin']);
        await identity.revokeSession(sessionA.token);
        const stale = createAcademicHistoryReviewService({ authorize: async () => staleDescriptor }, transactionDb);
        await assert.rejects(stale.student(a, ids.pa, ids.ya), e => e.statusCode === 404);
        await assert.rejects(stale.teacher(a, ids.ta, ids.ya), e => e.statusCode === 404);
        assert.equal((await fetch(base + path, { headers })).status, 403);
    } finally { await tx.rollback(); }
    assert.deepEqual(await counts(), before);
});
