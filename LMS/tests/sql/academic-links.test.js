const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createDatabase,sql}=require('../../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const {createIdentityService}=require('../../model/identity/identityService');
const {createSchoolAccess}=require('../../model/identity/schoolAccess');
const {createPersonnelService}=require('../../model/identity/personnelService');
const {createAcademicSetupService}=require('../../model/identity/academicSetupService');
const {createAcademicLinksService}=require('../../model/identity/academicLinksService');
const {createScopedAcademicLinksRouter}=require('../../routes/identity/academicLinksRouter');
const {createMarksService}=require('../../model/identity/marksService');
const {createScopedMarksRouter}=require('../../routes/identity/marksRouter');
const {createApp}=require('../../app/app');
const {serve}=require('../helpers/http');

test('scoped offerings, enrolment batches and explicit-year teaching permissions preserve history and isolate schools',async t=>{
    loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());
    await assertSyntheticDatabase(db);await require('../../scripts/migrate').migrate(db);
    const prefix=`LINK_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    let ids;
    try {
        ids=(await db.getPool().request().input('p',sql.NVarChar(50),prefix).query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'A',N'Synthetic A','Anglophone','active');DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'B',N'Synthetic B','Bilingual','active');DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'A',N'unusable-fixture-hash','active');DECLARE @aa INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'B',N'unusable-fixture-hash','active');DECLARE @ab INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@aa,'active');DECLARE @ma INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@ab,'active');DECLARE @mb INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@b,@mb,'admin');
            SELECT @a AS a,@b AS b,@aa AS admin_a,@ab AS admin_b,@ma AS ma,@mb AS mb;
        `)).recordset[0];
        const identity=createIdentityService(db),access=createSchoolAccess(identity);
        const setup=createAcademicSetupService(access,db),people=createPersonnelService(access,db),links=createAcademicLinksService(access,db);
        const marks=createMarksService(access,db);
        const sessionA=await identity.createSession(ids.admin_a,ids.ma),sessionB=await identity.createSession(ids.admin_b,ids.mb);
        const a=await access.resolve(sessionA.token),b=await access.resolve(sessionB.token);
        const yearA=await setup.create(a,'year',{fromYear:2026,toYear:2027,isCurrent:true});
        const priorA=await setup.create(a,'year',{fromYear:2025,toYear:2026});
        const yearB=await setup.create(b,'year',{fromYear:2026,toYear:2027,isCurrent:true});
        const classA=await setup.create(a,'class',{section:'Anglophone',name:'Links class',rank:1});
        const classB=await setup.create(b,'class',{section:'Anglophone',name:'Links class',rank:1});
        const subjectA=await setup.create(a,'subject',{name:'Links subject',code:'LINK_SUB'});
        const subjectB=await setup.create(b,'subject',{name:'Links subject',code:'LINK_SUB'});
        const offeringA=await links.createOffering(a,{classId:classA.id,subjectId:subjectA.id,coefficient:1.5});
        const offeringB=await links.createOffering(b,{classId:classB.id,subjectId:subjectB.id});
        await assert.rejects(links.createOffering(a,{classId:classA.id,subjectId:subjectB.id}),err=>err.statusCode===404);
        await assert.rejects(links.createOffering(a,{classId:classA.id,subjectId:subjectA.id}),err=>err.statusCode===409);
        assert.deepEqual((await links.listOfferings(a)).map(row=>row.id),[offeringA.id]);
        const password=crypto.randomBytes(24).toString('base64url');
        const pupilInput={firstName:'Synthetic',lastName:'Pupil',matricule:prefix,section:'Anglophone',sex:'Male',password};
        const pupilA=await people.register(a,'student',pupilInput);
        const peerA=await people.register(a,'student',{...pupilInput,matricule:prefix+'PEER'});
        const pupilB=await people.register(b,'student',pupilInput);
        const teacherInput={firstName:'Synthetic',lastName:'Teacher',email:`${prefix}@example.invalid`,section:'Anglophone',employmentType:'Part-time',password};
        const teacherA=await people.register(a,'teacher',teacherInput);
        const teacherB=await people.register(b,'teacher',teacherInput);
        const coTeacherInput={...teacherInput,email:`${prefix}CO@example.invalid`};
        const coTeacher=await people.register(a,'teacher',coTeacherInput);
        const coTeacherSession=await identity.loginSchoolIdentity(prefix+'A','teacher',coTeacherInput.email,password);
        const coTeacherContext=await access.resolve(coTeacherSession.token);
        const teacherSession=await identity.loginSchoolIdentity(prefix+'A','teacher',teacherInput.email,password);
        const teacherContext=await access.resolve(teacherSession.token);
        const pupilSession=await identity.loginSchoolIdentity(prefix+'A','student',pupilInput.matricule,password);
        const pupilContext=await access.resolve(pupilSession.token);
        const enrolInput={offeringId:offeringA.id,yearId:yearA.id,changes:[{studentId:pupilA.id,action:'enrol',version:0}]};
        await assert.rejects(links.enrol(a,enrolInput),err=>err.statusCode===409);
        // Explicit synthetic present-day placement only; this is not historical backfill logic.
        await db.getPool().request().query(`UPDATE dbo.students SET currentClassLevel=${classA.id},academicYearId=${yearA.id} WHERE id IN(${pupilA.id},${peerA.id});
            UPDATE dbo.students SET currentClassLevel=${classB.id},academicYearId=${yearB.id} WHERE id=${pupilB.id};
            INSERT dbo.class_subject_teachers(class_subject_id,teacher_id,term,school_id) VALUES(${offeringA.id},${teacherA.id},'First',${ids.a});`);
        assert.equal((await links.myAssignments(teacherContext,yearA.id,'First')).length,0);
        await assert.rejects(links.roster(teacherContext,offeringA.id,yearA.id,'First'),err=>err.statusCode===404);
        await assert.rejects(links.enrol(a,{...enrolInput,changes:[...enrolInput.changes,{studentId:pupilB.id,action:'enrol',version:0}]}),err=>err.statusCode===404);
        assert.equal((await links.linkList(a,offeringA.id,yearA.id)).length,0);
        const emptyBatch=(await db.getPool().request().query(`SELECT COUNT(*) AS count FROM dbo.academic_year_students WHERE school_id=${ids.a};
            SELECT COUNT(*) AS count FROM dbo.identity_audit_events WHERE school_id=${ids.a} AND resource_type='subject_enrolment'`)).recordsets;
        assert.equal(emptyBatch[0][0].count,0);assert.equal(emptyBatch[1][0].count,0);
        const enrolled=(await links.enrol(a,enrolInput))[0];assert.equal(enrolled.version,1);
        assert.equal((await links.myEnrolments(pupilContext,yearA.id)).length,1);
        assert.equal((await links.myEnrolments(pupilContext,yearB.id)).length,0);
        await assert.rejects(links.enrol(a,{...enrolInput,yearId:priorA.id}),err=>err.statusCode===409);
        const assignmentInput={offeringId:offeringA.id,yearId:yearA.id,teacherId:teacherA.id,term:'First',action:'assign',version:0};
        await assert.rejects(links.assign(a,{...assignmentInput,teacherId:teacherB.id}),err=>err.statusCode===404);
        const assignment=await links.assign(a,assignmentInput);assert.equal(assignment.version,1);
        await links.assign(a,{...assignmentInput,teacherId:coTeacher.id});
        assert.equal((await links.roster(coTeacherContext,offeringA.id,yearA.id,'First')).length,1);
        assert.equal((await links.myAssignments(teacherContext,yearA.id,'First')).length,1);
        assert.equal((await links.myAssignments(teacherContext,yearA.id,'Second')).length,0);
        assert.equal((await links.myAssignments(teacherContext,priorA.id,'First')).length,0);
        assert.deepEqual((await links.roster(teacherContext,offeringA.id,yearA.id,'First')).map(row=>row.id),[pupilA.id]);
        await assert.rejects(links.roster(teacherContext,offeringA.id,yearA.id,'Second'),err=>err.statusCode===404);
        await assert.rejects(links.roster(teacherContext,offeringB.id,yearB.id,'First'),err=>err.statusCode===404);
        await assert.rejects(links.roster(pupilContext,offeringA.id,yearA.id,'First'),err=>err.statusCode===403);
        await assert.rejects(links.assign(teacherContext,assignmentInput),err=>err.statusCode===403);
        const competing=await Promise.allSettled([
            links.enrol(a,{...enrolInput,changes:[{studentId:peerA.id,action:'enrol',version:0}]}),
            links.enrol(a,{...enrolInput,changes:[{studentId:peerA.id,action:'enrol',version:0}]}),
        ]);
        assert.equal(competing.filter(row=>row.status==='fulfilled').length,1);
        assert.equal(competing.find(row=>row.status==='rejected').reason.statusCode,409);
        const revoked=(await links.enrol(a,{...enrolInput,changes:[{studentId:peerA.id,action:'revoke',version:1}]}))[0];
        assert.equal(revoked.version,2);assert.equal(revoked.status,'revoked');
        assert.equal((await links.linkList(a,offeringA.id,yearA.id)).length,2);
        assert.equal((await links.roster(teacherContext,offeringA.id,yearA.id,'First')).length,1);
        const markScope={offeringId:offeringA.id,yearId:yearA.id,term:'First'};
        const markInput={...markScope,scores:[{studentId:pupilA.id,sequence:1,score:25,maxScore:50,version:0}]};
        await assert.rejects(marks.sheet(pupilContext,markScope),err=>err.statusCode===403);
        await assert.rejects(marks.sheet(teacherContext,{...markScope,term:'Second'}),err=>err.statusCode===404);
        await assert.rejects(marks.sheet(b,markScope),err=>err.statusCode===404);
        await assert.rejects(marks.save(teacherContext,{...markInput,scores:[...markInput.scores,{studentId:pupilB.id,sequence:1,score:20,maxScore:50,version:0}]}),err=>err.statusCode===404);
        assert.equal((await marks.sheet(teacherContext,markScope))[0].markId,null);
        await assert.rejects(marks.save(teacherContext,{...markInput,scores:[{studentId:peerA.id,sequence:1,score:20,maxScore:50,version:0}]}),err=>err.statusCode===404);
        await marks.save(teacherContext,markInput);
        const scoreEditor=(await db.getPool().request().query(`SELECT created_by,last_editor_account_id,last_editor_membership_id,score FROM dbo.subject_scores WHERE school_id=${ids.a}`)).recordset[0];
        assert.equal(scoreEditor.created_by,null);assert.equal(scoreEditor.last_editor_account_id,teacherContext.accountId);assert.equal(scoreEditor.last_editor_membership_id,teacherContext.membershipId);
        const scoreEdits=await Promise.allSettled([
            marks.save(teacherContext,{...markInput,scores:[{...markInput.scores[0],score:26,version:1}]}),
            marks.save(coTeacherContext,{...markInput,scores:[{...markInput.scores[0],score:27,version:1}]}),
        ]);
        assert.equal(scoreEdits.filter(row=>row.status==='fulfilled').length,1);
        assert.equal(scoreEdits.find(row=>row.status==='rejected').reason.statusCode,409);
        assert.equal((await marks.sheet(coTeacherContext,markScope))[0].version,2);
        await assert.rejects(links.enrol(a,{...enrolInput,changes:[{studentId:pupilA.id,action:'revoke',version:1}]}),err=>err.statusCode===409);
        assert.equal((await links.roster(teacherContext,offeringA.id,yearA.id,'First')).length,1);
        await links.assign(a,{...assignmentInput,action:'revoke',version:1});
        assert.equal((await links.myAssignments(teacherContext,yearA.id,'First')).length,0);
        await assert.rejects(links.roster(teacherContext,offeringA.id,yearA.id,'First'),err=>err.statusCode===404);
        await assert.rejects(marks.sheet(teacherContext,markScope),err=>err.statusCode===404);
        assert.equal((await links.roster(coTeacherContext,offeringA.id,yearA.id,'First')).length,1);
        const old=(await db.getPool().request().query(`SELECT academic_year_id FROM dbo.class_subject_teachers WHERE school_id=${ids.a} AND academic_year_id IS NULL`)).recordset;
        assert.equal(old.length,1);assert.equal(old[0].academic_year_id,null);
        assert.equal((await links.linkList(a,offeringA.id,yearA.id,'First'))[0].status,'revoked');
        const origin='https://lms.example.invalid';
        const base=await serve(t,createApp({logging:false,routes:[['/links',createScopedAcademicLinksRouter({identityService:identity,database:db,publicOrigin:origin})],
            ['/marks',createScopedMarksRouter({identityService:identity,database:db,publicOrigin:origin})]]}));
        const headers={Origin:origin,'Content-Type':'application/json',Cookie:`__Host-lms_session=${sessionA.token}`,'X-CSRF-Token':sessionA.csrfToken};
        const denied=await fetch(base+'/links/assignments',{method:'POST',headers:{...headers,'X-CSRF-Token':''},body:JSON.stringify({...assignmentInput,version:2})});assert.equal(denied.status,403);
        const reassigned=await fetch(base+'/links/assignments',{method:'POST',headers,body:JSON.stringify({...assignmentInput,version:2})});assert.equal(reassigned.status,200);
        const rosterResponse=await fetch(`${base}/links/offerings/${offeringA.id}/roster?yearId=${yearA.id}&term=First`,{headers:{Cookie:`__Host-lms_session=${teacherSession.token}`}});
        assert.equal(rosterResponse.status,200);const payload=await rosterResponse.json();assert.equal(payload.data.length,1);assert.equal(Object.hasOwn(payload.data[0],'password'),false);
        const ownResponse=await fetch(`${base}/links/my-enrolments?yearId=${yearA.id}`,{headers:{Cookie:`__Host-lms_session=${pupilSession.token}`}});
        assert.equal(ownResponse.status,200);assert.equal((await ownResponse.json()).data.length,1);
        // Two schools deliberately use the same subject name and lesson time. Only room identifies the fixture.
        const query=text=>db.getPool().request().query(text);
        await query(`INSERT dbo.Admins(name,email,password,role,school_id) VALUES('Fixture','${prefix}TA@example.invalid','unusable','Admin',${ids.a});
            DECLARE @da INT=SCOPE_IDENTITY();
            INSERT dbo.Admins(name,email,password,role,school_id) VALUES('Fixture','${prefix}TB@example.invalid','unusable','Admin',${ids.b});
            DECLARE @db INT=SCOPE_IDENTITY();
            INSERT dbo.timetables(school_id,class_id,subject_id,teacher_id,day_of_week,start_time,end_time,room,academic_term,academic_year_id,created_by)
            VALUES (${ids.a},${classA.id},${subjectA.id},${teacherA.id},'Monday','08:00','09:00','A1','First',${yearA.id},@da),
                   (${ids.a},${classA.id},${subjectA.id},${coTeacher.id},'Friday','08:00','09:00','A2','First',${yearA.id},@da),
                   (${ids.b},${classB.id},${subjectB.id},${teacherB.id},'Monday','08:00','09:00','B1','First',${yearB.id},@db);`);
        await links.assign(b,{offeringId:offeringB.id,yearId:yearB.id,teacherId:teacherB.id,term:'First',action:'assign',version:0});
        await links.enrol(b,{offeringId:offeringB.id,yearId:yearB.id,changes:[{studentId:pupilB.id,action:'enrol',version:0}]});
        const mySchedule=(session,year=yearA.id,term='First',extra='')=>fetch(
            `${base}/links/my-timetable?yearId=${year}&term=${term}${extra}`,{headers:{Cookie:'__Host-lms_session='+session.token}});
        const rooms=async(...args)=>{
            const response=await mySchedule(...args);
            assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
            return (await response.json()).data.map(row=>row.room);
        };
        const pupilBSession=await identity.loginSchoolIdentity(prefix+'B','student',pupilInput.matricule,password);
        const longName='=SUM(1,2) "École" <script>example</script> '+ 'x'.repeat(55);
        await db.getPool().request().input('subject',sql.Int,subjectA.id).input('label',sql.NVarChar(100),longName)
            .query('UPDATE dbo.subjects SET name=@label WHERE id=@subject');
        const exportSchedule=(session,format,year=yearA.id,extra='')=>mySchedule(session,year,'First','&format='+format+extra);
        for(const format of ['csv','print']){
            const response=await exportSchedule(teacherSession,format);
            assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
            const body=await response.text();
            assert.match(body,/A1/);assert.doesNotMatch(body,/A2|B1/);
            assert.ok(body.includes('x'.repeat(55)));
            if(format==='csv'){
                assert.match(response.headers.get('content-type'),/^text\/csv/);
                assert.match(response.headers.get('content-disposition'),/attachment; filename="my-timetable-\d+-First\.csv"/);
                assert.ok(body.includes('"\'=SUM(1,2) ""École""'));
            }else{
                assert.match(response.headers.get('content-type'),/^text\/html/);
                assert.match(body,/&lt;script&gt;example&lt;\/script&gt;/);
                assert.doesNotMatch(body,/<script>example<\/script>/);
            }
            const pupilText=await (await exportSchedule(pupilSession,format)).text();
            assert.match(pupilText,/A2/);assert.doesNotMatch(pupilText,/B1/);
            const foreignText=await (await exportSchedule(pupilBSession,format,yearB.id)).text();
            assert.match(foreignText,/B1/);assert.doesNotMatch(foreignText,/A1|A2/);
            assert.equal((await exportSchedule(teacherSession,format,yearA.id,'&schoolId='+ids.b)).status,422);
            assert.equal((await exportSchedule(sessionA,format)).status,403);
        }
        assert.equal((await exportSchedule(teacherSession,'unknown')).status,422);
        assert.deepEqual(await rooms(pupilBSession,yearB.id),['B1']);
        assert.deepEqual(await rooms(teacherSession),['A1']);
        assert.deepEqual(await rooms(coTeacherSession),['A2']);
        assert.deepEqual(await rooms(pupilSession),['A1','A2']);
        assert.deepEqual(await rooms(pupilSession,yearB.id),[]);
        assert.deepEqual(await rooms(pupilSession,priorA.id),[]);
        assert.deepEqual(await rooms(teacherSession,yearA.id,'Second'),[]);
        const peerSession=await identity.loginSchoolIdentity(prefix+'A','student',prefix+'PEER',password);
        assert.deepEqual(await rooms(peerSession),[]);
        assert.equal((await mySchedule(sessionA)).status,403);
        assert.equal((await mySchedule(teacherSession,yearA.id,'First','&teacherId='+coTeacher.id)).status,422);
        await query(`UPDATE dbo.students SET academicYearId=NULL WHERE id=${pupilA.id}`);
        assert.deepEqual(await rooms(pupilSession),[]);
        await query(`UPDATE dbo.students SET academicYearId=${yearA.id} WHERE id=${pupilA.id}`);
        if((await query("SELECT OBJECT_ID('dbo.student_enrolment_revisions') AS installed")).recordset[0].installed){
            // The live sample preview may own this schema. Only read it using the synthetic pupil in this test.
            const datedLinks=createAcademicLinksService(access,db,{datedPlacement:true});
            assert.deepEqual(await datedLinks.myTimetable(pupilContext,yearA.id,'First'),[]);
        }
        await links.assign(a,{...assignmentInput,teacherId:coTeacher.id,action:'revoke',version:1});
        assert.deepEqual(await rooms(coTeacherSession),[]);
        assert.deepEqual(await rooms(pupilSession),['A1']);
        await identity.revokeSession(pupilSession.token);
        for(const format of ['csv','print']){
            assert.doesNotMatch(await (await exportSchedule(coTeacherSession,format)).text(),/A1|A2/);
            assert.equal((await exportSchedule(pupilSession,format)).status,403);
        }
        assert.equal((await mySchedule(pupilSession)).status,403);
        const sheetResponse=await fetch(`${base}/marks/sheet?offeringId=${offeringA.id}&yearId=${yearA.id}&term=First`,{headers:{Cookie:`__Host-lms_session=${teacherSession.token}`}});
        assert.equal(sheetResponse.status,200);assert.equal((await sheetResponse.json()).data[0].version,2);
        const noScoreCsrf=await fetch(base+'/marks/scores',{method:'POST',headers:{...headers,'X-CSRF-Token':''},body:JSON.stringify(markInput)});assert.equal(noScoreCsrf.status,403);
        const beforeBatch=await marks.sheet(a,markScope);
        const audits=async()=>(await db.getPool().request().query(`SELECT request_id,resource_id FROM dbo.identity_audit_events WHERE school_id=${ids.a} AND action='score_saved' ORDER BY id`)).recordset;
        const beforeAudit=await audits();
        const scoreBatch=version=>fetch(base+'/marks/scores',{method:'POST',headers,body:JSON.stringify({...markScope,scores:[
            {studentId:pupilA.id,sequence:2,score:0,maxScore:20,version:0},
            {studentId:pupilA.id,sequence:1,score:22.5,maxScore:50,version}
        ]})});
        assert.equal((await scoreBatch(1)).status,409);
        assert.deepEqual(await marks.sheet(a,markScope),beforeBatch);assert.deepEqual(await audits(),beforeAudit);
        const accepted=await scoreBatch(2);assert.equal(accepted.status,200);
        const written=(await accepted.json()).data;assert.deepEqual(written.map(r=>[r.studentId,r.sequence,r.version]),[[pupilA.id,2,1],[pupilA.id,1,3]]);
        const receipts=(await audits()).slice(beforeAudit.length);
        assert.equal(receipts.length,2);assert.equal(receipts[0].request_id,receipts[1].request_id);
        assert.deepEqual(receipts.map(r=>Number(r.resource_id)),written.map(r=>r.id));
        const descriptor=await access.authorize(a,['admin']);await identity.revokeSession(sessionA.token);
        const revokedService=createAcademicLinksService({async authorize(){return descriptor;}},db);
        await assert.rejects(revokedService.assign(a,{...assignmentInput,version:3}),err=>err.statusCode===403);
        assert.equal((await revokedService.listOfferings(a)).length,0);
    } finally {
        if(ids) await db.getPool().request().query(`
            DECLARE @accounts TABLE(id INT PRIMARY KEY);
            INSERT @accounts SELECT account_id FROM dbo.legacy_account_map WHERE school_id IN(${ids.a},${ids.b});INSERT @accounts VALUES(${ids.admin_a}),(${ids.admin_b});
            DELETE dbo.identity_audit_events WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.timetables WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.Admins WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.subject_scores WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.class_subject_students WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.class_subject_teachers WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.academic_year_students WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.academic_year_teachers WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.class_subjects WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.students WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.subjects WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.classes WHERE school_id IN(${ids.a},${ids.b});
            DELETE dbo.academic_years WHERE school_id IN(${ids.a},${ids.b});
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
