const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createDatabase, sql } = require('../../config/database');
const { loadTestEnvironment, assertSyntheticDatabase } = require('../../scripts/testEnvironment');
const { createIdentityService } = require('../../model/identity/identityService');
const { createSchoolAccess } = require('../../model/identity/schoolAccess');
const { createEnrolmentLedgerService } = require('../../model/identity/enrolmentLedgerService');
const { createPersonnelService } = require('../../model/identity/personnelService');
const { createAcademicSetupService } = require('../../model/identity/academicSetupService');
const { createAcademicLinksService } = require('../../model/identity/academicLinksService');
const { createMarksService } = require('../../model/identity/marksService');
const { createPupilPlacementRouter } = require('../../routes/identity/pupilPlacementRouter');
const { seedEnrolmentFixture, removeEnrolmentFixture } = require('../helpers/enrolmentFixture');
const { createApp } = require('../../app/app');
const { serve } = require('../helpers/http');

test('current transfers atomically preserve history and courses while updating versioned placement across classes and years', async t => {
    loadTestEnvironment(); const db = createDatabase(); t.after(() => db.close()); await assertSyntheticDatabase(db);
    const query = text => db.getPool().request().query(text);
    assert.deepEqual((await query("SELECT OBJECT_ID('dbo.student_enrolments') a,OBJECT_ID('dbo.student_enrolment_revisions') b")).recordset[0], { a: null, b: null });
    const baseline = async () => (await query(`SELECT (SELECT COUNT(*) FROM dbo.students) pupils,(SELECT COUNT(*) FROM dbo.accounts) accounts,
        (SELECT COUNT(*) FROM dbo.subject_scores) scores,(SELECT COUNT(*) FROM dbo.class_subject_students) links,
        (SELECT COUNT(*) FROM dbo.identity_audit_events) audits,(SELECT COUNT(*) FROM dbo.student_fees) fees;
        SELECT version,checksum FROM dbo.schema_migrations ORDER BY version;`)).recordsets;
    const before = await baseline(); let installed = false, ids, triggerInstalled = false;
    const trigger = 'placement_audit_' + crypto.randomBytes(5).toString('hex');
    try {
        const tx = new sql.Transaction(db.getPool()); await tx.begin();
        try { await new sql.Request(tx).query(fs.readFileSync(require.resolve('../../docs/implementation/staged/010_enrolment_ledger.sql'), 'utf8')); await tx.commit(); installed = true; }
        catch (e) { await tx.rollback().catch(() => {}); throw e; }
        ids = await seedEnrolmentFixture(db);
        await query(`UPDATE dbo.academic_years SET isCurrent=1 WHERE id IN(${ids.ya},${ids.yb})`);
        const identity = createIdentityService(db), access = createSchoolAccess(identity);
        const ledger = createEnrolmentLedgerService(access, db), people = createPersonnelService(access, db, { enrolmentLedger: true });
        const setup = createAcademicSetupService(access, db), links = createAcademicLinksService(access, db), marks = createMarksService(access, db);
        const sa = await identity.createSession(ids.aa, ids.ma), sb = await identity.createSession(ids.ab, ids.mb), st = await identity.createSession(ids.at, ids.mt);
        const a = await access.resolve(sa.token), b = await access.resolve(sb.token), teacher = await access.resolve(st.token);
        const pupil = await people.register(a, 'student', { firstName: 'Synthetic', lastName: 'Transfer', matricule: 'TRANSFER', sex: 'Male', section: 'Anglophone',
            password: crypto.randomBytes(24).toString('base64url'), placement: { classId: ids.ca, yearId: ids.ya, fromDate: '2024-09-01', sourceReference: 'Register 1', reason: 'Reviewed admission' } });
        const root = pupil.enrolment.id;
        const subject = await setup.create(a, 'subject', { name: 'Transfer subject', code: 'MOVE' });
        const oldOffering = await links.createOffering(a, { classId: ids.ca, subjectId: subject.id });
        const newOffering = await links.createOffering(a, { classId: ids.cn, subjectId: subject.id });
        await links.enrol(a, { offeringId: oldOffering.id, yearId: ids.ya, changes: [{ studentId: pupil.id, action: 'enrol', version: 0 }] });
        const scoreInput = { offeringId: oldOffering.id, yearId: ids.ya, term: 'First', scores: [{ studentId: pupil.id, sequence: 1, score: 15, maxScore: 20, version: 0 }] };
        await marks.save(a, scoreInput);
        const stable = async () => (await query(`SELECT * FROM dbo.subject_scores WHERE student_id=${pupil.id} ORDER BY id;
            SELECT * FROM dbo.class_subject_students WHERE student_id=${pupil.id} ORDER BY id;
            SELECT a.* FROM dbo.accounts a JOIN dbo.legacy_account_map l ON l.account_id=a.id WHERE l.source_table='students' AND l.legacy_id=${pupil.id};
            SELECT * FROM dbo.school_memberships WHERE id IN(SELECT membership_id FROM dbo.legacy_account_map WHERE source_table='students' AND legacy_id=${pupil.id});
            SELECT password,isWithdrawn FROM dbo.students WHERE id=${pupil.id};
            SELECT * FROM dbo.student_fees WHERE student_id=${pupil.id};`)).recordsets;
        const stableBefore = await stable();
        // Private hashes are compared in memory; never printed as fixture output.
        const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
        const stableHash = digest(stableBefore);
        const snapshot = async () => digest((await query(`SELECT * FROM dbo.students WHERE id=${pupil.id};
            SELECT * FROM dbo.student_enrolments WHERE school_id=${ids.a} ORDER BY id;
            SELECT * FROM dbo.student_enrolment_revisions WHERE school_id=${ids.a} ORDER BY enrolment_id,revision;
            SELECT * FROM dbo.academic_year_students WHERE school_id=${ids.a} ORDER BY academic_year_id,student_id;
            SELECT * FROM dbo.identity_audit_events WHERE school_id=${ids.a} ORDER BY id;`)).recordsets);
        const input = { version: 1, profileVersion: 1, classId: ids.cn, yearId: ids.ya, onDate: '2025-01-01', sourceReference: 'Transfer register 2', reason: 'Reviewed class transfer' };
        const initial = await snapshot();
        for (const [context, patch, status] of [[b, {}, 404], [teacher, {}, 403], [a, { classId: ids.cb }, 404], [a, { yearId: ids.yb }, 404],
            [a, { yearId: ids.yn }, 404], [a, { profileVersion: 2 }, 409], [a, { version: 2 }, 409], [a, { onDate: '9999-01-01' }, 422],
            [a, { onDate: '2024-09-01' }, 409], [a, { classId: ids.ca }, 409]])
            await assert.rejects(ledger.transferCurrent(context, root, { ...input, ...patch }), e => e.statusCode === status);
        assert.equal(await snapshot(), initial);
        // Refuse unexplained projections, withdrawals, section changes and missing source year facts.
        for (const change of [`currentClassLevel=${ids.cn}`, 'isWithdrawn=1', "section='Francophone'"]) {
            await query(`UPDATE dbo.students SET ${change} WHERE id=${pupil.id}`);
            await assert.rejects(ledger.transferCurrent(a, root, input), e => [404, 409].includes(e.statusCode));
            await query(`UPDATE dbo.students SET currentClassLevel=${ids.ca},isWithdrawn=0,section='Anglophone' WHERE id=${pupil.id}`);
        }
        await query(`DELETE dbo.academic_year_students WHERE school_id=${ids.a} AND student_id=${pupil.id}`);
        await assert.rejects(ledger.transferCurrent(a, root, input), e => e.statusCode === 409);
        await query(`INSERT dbo.academic_year_students(school_id,student_id,academic_year_id) VALUES(${ids.a},${pupil.id},${ids.ya})`);
        await people.update(a, 'student', pupil.id, 1, { lastName: 'Corrected' });
        await assert.rejects(ledger.transferCurrent(a, root, input), e => e.statusCode === 409);
        const currentInput = { ...input, profileVersion: 2 }, beforeFailure = await snapshot();
        await query(`CREATE TRIGGER dbo.${trigger} ON dbo.identity_audit_events AFTER INSERT AS IF EXISTS(
            SELECT 1 FROM inserted WHERE school_id=${ids.a} AND action='pupil_placement_transferred') THROW 50192,'Synthetic transfer audit failure',1;`); triggerInstalled = true;
        await assert.rejects(ledger.transferCurrent(a, root, currentInput), e => e.statusCode === 500);
        assert.equal(await snapshot(), beforeFailure); assert.equal(digest(await stable()), stableHash);
        await query(`DROP TRIGGER dbo.${trigger}`); triggerInstalled = false;
        const race = await Promise.allSettled([ledger.transferCurrent(a, root, currentInput), ledger.transferCurrent(a, root, currentInput)]);
        assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(race.find(r => r.status === 'rejected').reason.statusCode, 409);
        const moved = race.find(r => r.status === 'fulfilled').value;
        assert.deepEqual(moved.pupil, { id: pupil.id, version: 3 }); assert.equal(digest(await stable()), stableHash);
        assert.deepEqual((await query(`SELECT currentClassLevel,academicYearId,profile_version FROM dbo.students WHERE id=${pupil.id}`)).recordset[0],
            { currentClassLevel: ids.cn, academicYearId: ids.ya, profile_version: 3 });
        assert.equal((await ledger.roster(a, { classId: ids.ca, yearId: ids.ya, onDate: '2024-12-31' })).rows[0].studentId, pupil.id);
        assert.equal((await ledger.roster(a, { classId: ids.ca, yearId: ids.ya, onDate: '2025-01-01' })).rows.length, 0);
        assert.equal((await ledger.roster(a, { classId: ids.cn, yearId: ids.ya, onDate: '2025-01-01' })).rows[0].studentId, pupil.id);
        assert.equal((await marks.sheet(a, { offeringId: oldOffering.id, yearId: ids.ya, term: 'First' }))[0].score, 15);
        await assert.rejects(marks.save(a, { ...scoreInput, scores: [{ ...scoreInput.scores[0], version: 1, score: 16 }] }), e => e.statusCode === 404);
        const beforeReturn = await snapshot();
        await assert.rejects(ledger.transferCurrent(a, moved.destination.id, { ...input, profileVersion: 3, classId: ids.ca, onDate: '2025-04-01' }),
            e => e.statusCode === 409 && /destination course/.test(e.message));
        assert.equal(await snapshot(), beforeReturn); assert.equal(digest(await stable()), stableHash);
        const destinationLinks = await links.linkList(a, newOffering.id, ids.ya); assert.deepEqual(destinationLinks, []);
        // New course access is an explicit action against the new current placement.
        await links.enrol(a, { offeringId: newOffering.id, yearId: ids.ya, changes: [{ studentId: pupil.id, action: 'enrol', version: 0 }] });
        const afterExplicitLink = digest(await stable());
        await query(`UPDATE dbo.academic_years SET isCurrent=CASE WHEN id=${ids.yn} THEN 1 ELSE 0 END WHERE school_id=${ids.a}`);
        const origin = 'https://lms.example.invalid';
        const base = await serve(t, createApp({ logging: false, routes: [['/placement', createPupilPlacementRouter({ identityService: identity, database: db, publicOrigin: origin })]] }));
        const headers = { Cookie: `__Host-lms_session=${sa.token}`, Origin: origin, 'X-CSRF-Token': sa.csrfToken, 'Content-Type': 'application/json' };
        const yearInput = { ...input, profileVersion: 3, classId: ids.ca, yearId: ids.yn, onDate: '2025-09-01' };
        const post = (body = yearInput, extra = {}, suffix = '') => fetch(`${base}/placement/${moved.destination.id}/transfers${suffix}`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
        assert.equal((await post(yearInput, { 'X-CSRF-Token': '' })).status, 403);
        assert.equal((await post(yearInput, { Origin: 'https://other.invalid' })).status, 403);
        assert.equal((await post(yearInput, { Cookie: `__Host-lms_session=${st.token}` })).status, 403);
        assert.equal((await post(yearInput, { Cookie: `__Host-lms_session=${sb.token}`, 'X-CSRF-Token': sb.csrfToken })).status, 404);
        assert.equal((await post({ ...yearInput, schoolId: ids.b })).status, 422);
        assert.equal((await post(yearInput, {}, '?schoolId=1')).status, 422);
        const beforeYearMove = await snapshot();
        await query(`CREATE TRIGGER dbo.${trigger} ON dbo.identity_audit_events AFTER INSERT AS IF EXISTS(
            SELECT 1 FROM inserted WHERE school_id=${ids.a} AND action='pupil_placement_transferred') THROW 50192,'Synthetic year transfer audit failure',1;`); triggerInstalled = true;
        assert.equal((await post()).status, 500); assert.equal(await snapshot(), beforeYearMove);
        await query(`DROP TRIGGER dbo.${trigger}`); triggerInstalled = false;
        const response = await post(); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
        const yearMove = (await response.json()).data; assert.equal(yearMove.pupil.version, 4);
        assert.equal(digest(await stable()), afterExplicitLink);
        assert.deepEqual((await query(`SELECT academic_year_id FROM dbo.academic_year_students WHERE student_id=${pupil.id} ORDER BY academic_year_id`)).recordset.map(r => r.academic_year_id), [ids.ya, ids.yn]);
        const history = await ledger.history(a, pupil.id); assert.equal(history.length, 5);
        assert.equal(history[0].fromDate, '2024-09-01'); assert.equal(history[0].toDate, null);
        assert.equal(history[3].operationId, history[4].operationId);
        const audit = (await query(`SELECT request_id,resource_version_before,resource_version_after FROM dbo.identity_audit_events
            WHERE school_id=${ids.a} AND action='pupil_placement_transferred' ORDER BY id`)).recordset;
        assert.deepEqual(audit.map(r => [r.resource_version_before, r.resource_version_after]), [[2, 3], [3, 4]]);
        assert.equal(audit[1].request_id.toLowerCase(), yearMove.operationId.toLowerCase());
        assert.equal((await post()).status, 409);
        assert.equal((await fetch(base + '/placement', { method: 'POST', headers, body: '{}' })).status, 404);
        await identity.revokeSession(sa.token);
        await assert.rejects(ledger.transferCurrent(a, yearMove.destination.id, { ...input, profileVersion: 4 }), e => e.statusCode === 403);
        assert.equal((await post()).status, 403);
    } finally {
        if (triggerInstalled) await query(`DROP TRIGGER dbo.${trigger}`);
        if (installed) {
            assert.equal((await query(`SELECT COUNT(*) n FROM dbo.student_enrolments ${ids ? `WHERE school_id NOT IN(${ids.a},${ids.b})` : ''}`)).recordset[0].n, 0);
            await query('DROP TABLE dbo.student_enrolment_revisions;DROP TABLE dbo.student_enrolments;');
        }
        if (ids) {
            await query(`DELETE dbo.subject_scores WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.class_subject_students WHERE school_id IN(${ids.a},${ids.b});
                DELETE dbo.class_subjects WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.subjects WHERE school_id IN(${ids.a},${ids.b});`);
            await removeEnrolmentFixture(db, ids);
        }
    }
    assert.deepEqual(await baseline(), before);
});
