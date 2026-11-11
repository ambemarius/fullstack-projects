const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createDatabase, sql } = require('../../config/database');
const { loadTestEnvironment, assertSyntheticDatabase } = require('../../scripts/testEnvironment');
const { createIdentityService } = require('../../model/identity/identityService');
const { createSchoolAccess } = require('../../model/identity/schoolAccess');
const { createEnrolmentLedgerService } = require('../../model/identity/enrolmentLedgerService');
const { createEnrolmentLedgerRouter } = require('../../routes/identity/enrolmentLedgerRouter');
const { seedEnrolmentFixture, removeEnrolmentFixture } = require('../helpers/enrolmentFixture');
const { createApp } = require('../../app/app');
const { serve } = require('../helpers/http');

test('staged enrolment ledger rehearses rollback, preserves dated history, serializes transfers and isolates actual HTTP/SQL', async t => {
    loadTestEnvironment(); const db = createDatabase(); t.after(() => db.close()); await assertSyntheticDatabase(db);
    const query = text => db.getPool().request().query(text);
    const exists = async () => (await query("SELECT OBJECT_ID('dbo.student_enrolments') root,OBJECT_ID('dbo.student_enrolment_revisions') revisions")).recordset[0];
    // Never dispose an installed or pre-existing ledger; this test owns only the schema it creates.
    assert.deepEqual(await exists(), { root: null, revisions: null }, 'Staged test requires absent ledger tables');
    const baseline = async () => (await query(`SELECT (SELECT COUNT(*) FROM dbo.students) pupils,(SELECT COUNT(*) FROM dbo.schools) schools,
        (SELECT COUNT(*) FROM dbo.subject_scores) scores,(SELECT COUNT(*) FROM dbo.identity_audit_events) audits;
        SELECT version,checksum FROM dbo.schema_migrations ORDER BY version;`)).recordsets;
    const before = await baseline(), ddl = fs.readFileSync(require.resolve('../../docs/implementation/staged/010_enrolment_ledger.sql'), 'utf8');
    const rehearsal = new sql.Transaction(db.getPool()); await rehearsal.begin();
    try {
        await new sql.Request(rehearsal).query(ddl);
        const constraints = (await new sql.Request(rehearsal).query(`SELECT COUNT(*) bad FROM sys.foreign_keys
            WHERE parent_object_id IN(OBJECT_ID('dbo.student_enrolments'),OBJECT_ID('dbo.student_enrolment_revisions')) AND (is_disabled=1 OR is_not_trusted=1)`)).recordset[0];
        assert.equal(constraints.bad, 0);
    } finally { await rehearsal.rollback().catch(() => {}); }
    assert.deepEqual(await exists(), { root: null, revisions: null }); assert.deepEqual(await baseline(), before);
    let created = false, ids, auditTrigger = false;
    const trigger = 'enrolment_test_audit_' + crypto.randomBytes(5).toString('hex');
    try {
        const install = new sql.Transaction(db.getPool()); await install.begin();
        try { await new sql.Request(install).query(ddl); await install.commit(); created = true; }
        catch (e) { await install.rollback().catch(() => {}); throw e; }
        ids = await seedEnrolmentFixture(db);
        const identity = createIdentityService(db), access = createSchoolAccess(identity), service = createEnrolmentLedgerService(access, db);
        const sa = await identity.createSession(ids.aa, ids.ma), sb = await identity.createSession(ids.ab, ids.mb), st = await identity.createSession(ids.at, ids.mt);
        const a = await access.resolve(sa.token), b = await access.resolve(sb.token), teacher = await access.resolve(st.token);
        const input = { studentId: ids.pa, classId: ids.ca, yearId: ids.ya, fromDate: '2024-09-01', toDate: null, status: 'enrolled', sourceReference: 'Synthetic admission register 1', reason: 'Verified record' };
        const snapshot = async () => (await query(`SELECT * FROM dbo.students WHERE school_id IN(${ids.a},${ids.b}) ORDER BY id`)).recordset;
        const sourceBefore = await snapshot();
        await assert.rejects(service.record(teacher, input), e => e.statusCode === 403);
        await assert.rejects(service.record(b, input), e => e.statusCode === 404);
        await assert.rejects(service.record(a, { ...input, studentId: ids.pb }), e => e.statusCode === 404);
        await assert.rejects(service.record(a, { ...input, classId: ids.cb }), e => e.statusCode === 404);
        await assert.rejects(service.record(a, { ...input, yearId: ids.yb }), e => e.statusCode === 404);
        const competing = await Promise.allSettled([service.record(a, input), service.record(a, input)]);
        assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(competing.find(r => r.status === 'rejected').reason.statusCode, 409);
        const original = competing.find(r => r.status === 'fulfilled').value;
        assert.equal(original.version, 1);
        assert.deepEqual(await snapshot(), sourceBefore);
        const oldRoster = date => service.roster(a, { classId: ids.ca, yearId: ids.ya, onDate: date });
        assert.deepEqual((await oldRoster('2024-08-31')).rows, []);
        assert.equal((await oldRoster('2024-09-01')).rows[0].studentId, ids.pa);
        await assert.rejects(service.history(b, ids.pa), e => e.statusCode === 404);
        await assert.rejects(service.roster(a, { classId: ids.cb, yearId: ids.ya, onDate: '2024-10-01' }), e => e.statusCode === 404);
        // Overlap is checked across years as well as classes, including bounded intervals.
        await assert.rejects(service.record(a, { ...input, classId: ids.cn, yearId: ids.yn, fromDate: '2025-01-01', toDate: '2025-03-01' }), e => e.statusCode === 409);
        const transfer = { version: 1, classId: ids.cn, yearId: ids.ya, onDate: '2025-01-01', toDate: '2025-07-01', sourceReference: 'Synthetic transfer 2', reason: 'Class transfer' };
        await assert.rejects(service.transfer(a, original.id, { ...transfer, onDate: '2024-09-01' }), e => e.statusCode === 409);
        await assert.rejects(service.transfer(b, original.id, transfer), e => e.statusCode === 404);
        // Force an audit failure after ledger append: neither half of the transfer may remain.
        await query(`CREATE TRIGGER dbo.${trigger} ON dbo.identity_audit_events AFTER INSERT AS
            IF EXISTS(SELECT 1 FROM inserted WHERE school_id=${ids.a} AND action='enrolment_revision_recorded' AND resource_id<>N'${original.id}') THROW 50190,'Synthetic audit failure',1;`);
        auditTrigger = true;
        await assert.rejects(service.transfer(a, original.id, transfer), e => e.statusCode === 500);
        assert.equal((await service.history(a, ids.pa)).length, 1);
        assert.equal((await query(`SELECT COUNT(*) n FROM dbo.student_enrolments WHERE school_id=${ids.a}`)).recordset[0].n, 1);
        await query(`DROP TRIGGER dbo.${trigger}`); auditTrigger = false;
        const transfers = await Promise.allSettled([service.transfer(a, original.id, transfer), service.transfer(a, original.id, transfer)]);
        assert.equal(transfers.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(transfers.find(r => r.status === 'rejected').reason.statusCode, 409);
        const moved = transfers.find(r => r.status === 'fulfilled').value;
        const history = await service.history(a, ids.pa);
        assert.equal(history.length, 3); assert.equal(history[0].isLatest, false); assert.equal(history[0].toDate, null);
        assert.equal(history[1].status, 'transferred'); assert.equal(history[1].toDate, '2025-01-01');
        assert.equal(history[1].operationId, history[2].operationId); assert.equal(history[1].actorAccountId, ids.aa);
        assert.equal((await oldRoster('2024-12-31')).rows.length, 1); assert.equal((await oldRoster('2025-01-01')).rows.length, 0);
        const nextRoster = date => service.roster(a, { classId: ids.cn, yearId: ids.ya, onDate: date });
        assert.equal((await nextRoster('2025-01-01')).rows.length, 1); assert.equal((await nextRoster('2025-07-01')).rows.length, 0);
        assert.deepEqual(await snapshot(), sourceBefore); // ledger does not change current/fee/account compatibility fields
        await query(`UPDATE dbo.students SET currentClassLevel=${ids.cn},academicYearId=${ids.yn},isWithdrawn=1 WHERE id=${ids.pa};`);
        assert.equal((await oldRoster('2024-12-31')).rows.length, 1); assert.equal((await nextRoster('2025-02-01')).rows.length, 1);
        await assert.rejects(query(`UPDATE dbo.student_enrolment_revisions SET reason='rewrite' WHERE enrolment_id=${original.id}`));
        await assert.rejects(query(`DELETE dbo.student_enrolment_revisions WHERE enrolment_id=${original.id}`));
        await assert.rejects(query(`UPDATE dbo.student_enrolments SET student_id=${ids.pb},school_id=${ids.b} WHERE id=${original.id}`));
        // Direct composite FK violation is rejected even outside the service.
        await assert.rejects(query(`INSERT dbo.student_enrolments(school_id,student_id) VALUES(${ids.a},${ids.pb})`));
        const rawRevision = (year, classId, revision, previous, from = '2024-09-01', to = '2025-01-01') => query(`
            INSERT dbo.student_enrolment_revisions(school_id,enrolment_id,revision,previous_revision,academic_year_id,class_id,
                effective_from,effective_to,status,source_reference,reason,actor_account_id,actor_membership_id,operation_id)
            VALUES(${ids.a},${original.id},${revision},${previous},${year},${classId},'${from}','${to}','completed','Synthetic source','Constraint test',${ids.aa},${ids.ma},NEWID())`);
        await assert.rejects(rawRevision(ids.yb, ids.ca, 3, 2));
        await assert.rejects(rawRevision(ids.ya, ids.cb, 3, 2));
        await assert.rejects(rawRevision(ids.ya, ids.ca, 4, 3)); // missing previous revision
        await assert.rejects(rawRevision(ids.ya, ids.ca, 3, 1)); // cannot branch revision lineage
        await assert.rejects(rawRevision(ids.ya, ids.ca, 3, 2, '2025-01-01', '2025-01-01'));
        const { studentId, ...fields } = input;
        const correction = { ...fields, version: 1, classId: ids.cn, fromDate: '2025-01-01', toDate: '2025-06-01', status: 'withdrawn', reason: 'Explicit withdrawal date' };
        const corrected = await service.revise(a, moved.destination.id, correction); assert.equal(corrected.version, 2);
        assert.equal((await nextRoster('2025-05-31')).rows.length, 1); assert.equal((await nextRoster('2025-06-01')).rows.length, 0);
        await assert.rejects(service.revise(a, moved.destination.id, correction), e => e.statusCode === 409);
        await assert.rejects(service.revise(a, moved.destination.id, { ...correction, version: 2, fromDate: '2024-12-31' }), e => e.statusCode === 409);
        const newYear = await service.record(a, { ...input, yearId: ids.yn, classId: ids.cn, fromDate: '2025-09-01' });
        assert.equal(newYear.version, 1); assert.equal((await oldRoster('2024-12-31')).rows.length, 1);

        const origin = 'https://lms.example.invalid';
        const base = await serve(t, createApp({ logging: false, routes: [['/ledger', createEnrolmentLedgerRouter({ identityService: identity, database: db, publicOrigin: origin })]] }));
        const headers = { Cookie: `__Host-lms_session=${sa.token}`, Origin: origin, 'X-CSRF-Token': sa.csrfToken, 'Content-Type': 'application/json' };
        const get = await fetch(`${base}/ledger/students/${ids.pa}/history`, { headers }); assert.equal(get.status, 200); assert.match(get.headers.get('cache-control'), /no-store/);
        assert.equal((await get.json()).data.length, 5);
        const httpTransfer = await fetch(`${base}/ledger/${newYear.id}/transfers`, { method: 'POST', headers,
            body: JSON.stringify({ ...transfer, yearId: ids.yn, classId: ids.ca, onDate: '2026-01-01', toDate: null }) });
        assert.equal(httpTransfer.status, 200);
        assert.equal((await httpTransfer.json()).data.source.version, 2);
        const other = { ...input, studentId: ids.pb, classId: ids.cb, yearId: ids.yb };
        const post = (body, extra = {}) => fetch(base + '/ledger', { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
        assert.equal((await post(other, { 'X-CSRF-Token': '' })).status, 403);
        assert.equal((await post(other)).status, 404);
        assert.equal((await post({ ...input, schoolId: ids.b })).status, 422);
        assert.equal((await post(input, { Origin: 'https://other.invalid' })).status, 403);
        assert.equal((await fetch(`${base}/ledger/students/${ids.pa}/history`, { headers: { Cookie: `__Host-lms_session=${st.token}` } })).status, 403);
        const bHeaders = { Cookie: `__Host-lms_session=${sb.token}`, Origin: origin, 'X-CSRF-Token': sb.csrfToken, 'Content-Type': 'application/json' };
        const bCreated = await fetch(base + '/ledger', { method: 'POST', headers: bHeaders, body: JSON.stringify(other) }); assert.equal(bCreated.status, 201);
        const bRecord = (await bCreated.json()).data;
        const bCorrection = { ...fields, version: 1, classId: ids.cb, yearId: ids.yb, status: 'voided', reason: 'Duplicate paper entry corrected' };
        const amend = await fetch(`${base}/ledger/${bRecord.id}/revisions`, { method: 'POST', headers: bHeaders, body: JSON.stringify(bCorrection) }); assert.equal(amend.status, 200);
        assert.equal((await service.history(b, ids.pb)).length, 2);
        assert.equal((await service.roster(b, { classId: ids.cb, yearId: ids.yb, onDate: '2024-10-01' })).rows.length, 0);
        // Exercise keyset boundaries with distinct synthetic pupils, no credentials/accounts created.
        await query(`DECLARE @n INT=1;WHILE @n<=101 BEGIN
            INSERT dbo.students(firstName,lastName,matricule,password,section,sex,school_id)
                VALUES('Synthetic','Pagination',CONCAT('LEDGER_PAGE_',@n),'unusable-fixture-hash','Anglophone','Male',${ids.a});
            DECLARE @student INT=SCOPE_IDENTITY();
            INSERT dbo.student_enrolments(school_id,student_id) VALUES(${ids.a},@student);DECLARE @enrolment INT=SCOPE_IDENTITY();
            INSERT dbo.student_enrolment_revisions(school_id,enrolment_id,revision,previous_revision,academic_year_id,class_id,
                effective_from,effective_to,status,source_reference,reason,actor_account_id,actor_membership_id,operation_id)
                VALUES(${ids.a},@enrolment,1,NULL,${ids.ya},${ids.ca},'2024-04-01','2024-08-01','completed','Synthetic page register','Pagination fixture',${ids.aa},${ids.ma},NEWID());
            SET @n=@n+1;END;`);
        const page1 = await oldRoster('2024-06-01'); assert.equal(page1.rows.length, 100); assert.ok(page1.nextAfterStudentId);
        const page2 = await service.roster(a, { classId: ids.ca, yearId: ids.ya, onDate: '2024-06-01', afterStudentId: page1.nextAfterStudentId });
        assert.equal(page2.rows.length, 1); assert.equal(page2.nextAfterStudentId, null);
        assert.equal(new Set([...page1.rows, ...page2.rows].map(r => r.studentId)).size, 101);
        const descriptor = await access.authorize(a, ['admin']); await identity.revokeSession(sa.token);
        const stale = createEnrolmentLedgerService({ authorize: async () => descriptor }, db);
        await assert.rejects(stale.record(a, { ...input, fromDate: '2027-01-01' }), e => e.statusCode === 403);
        await assert.rejects(stale.history(a, ids.pa), e => e.statusCode === 404);
        assert.equal((await fetch(`${base}/ledger/students/${ids.pa}/history`, { headers })).status, 403);
    } finally {
        if (auditTrigger) await query(`DROP TRIGGER dbo.${trigger}`);
        if (created) {
            const foreign = (await query(`SELECT COUNT(*) n FROM dbo.student_enrolments ${ids ? `WHERE school_id NOT IN(${ids.a},${ids.b})` : ''}`)).recordset[0].n;
            assert.equal(foreign, 0, 'Refuse cleanup of any non-fixture ledger data');
            await query('DROP TABLE dbo.student_enrolment_revisions; DROP TABLE dbo.student_enrolments;');
        }
        if (ids) await removeEnrolmentFixture(db, ids);
    }
    assert.deepEqual(await exists(), { root: null, revisions: null }); assert.deepEqual(await baseline(), before);
});
