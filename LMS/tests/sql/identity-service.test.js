const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createDatabase, sql } = require('../../config/database');
const { createIdentityService } = require('../../model/identity/identityService');
const { loadTestEnvironment, assertSyntheticDatabase } = require('../../scripts/testEnvironment');

test('SQL identity sessions recheck status and grants; onboarding is atomic and protected', async t => {
    loadTestEnvironment();
    const db = createDatabase();
    t.after(() => db.close());
    await assertSyntheticDatabase(db);
    // This file sorts before identity.test.js: apply the reviewed expand ledger first.
    await require('../../scripts/migrate').migrate(db);
    const suffix = crypto.randomBytes(8).toString('hex');
    const prefix = `SERVICE_${suffix.toUpperCase()}`;
    const service = createIdentityService(db);
    let ids;
    try {
        const setup = await db.getPool().request().input('prefix', sql.NVarChar(50), prefix).query(`
            INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'A',N'Synthetic A','Anglophone','active');
            DECLARE @a INT=SCOPE_IDENTITY();
            INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'B',N'Synthetic B','Bilingual','active');
            DECLARE @b INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'operator',N'unusable-test-hash','active');
            DECLARE @operator INT=SCOPE_IDENTITY();
            INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'admin',N'unusable-test-hash','active');
            DECLARE @admin INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@operator,'active');
            DECLARE @ma INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@operator,'active');
            DECLARE @mb INT=SCOPE_IDENTITY();
            INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@admin,'active');
            DECLARE @mc INT=SCOPE_IDENTITY();
            INSERT dbo.membership_roles VALUES(@a,@ma,'teacher'),(@b,@mb,'librarian'),(@a,@mc,'admin');
            INSERT dbo.platform_role_grants(account_id,permission,granted_by) VALUES(@operator,'school_onboarding',@operator);
            SELECT @a AS a,@b AS b,@operator AS operator_id,@admin AS admin_id,@ma AS ma,@mb AS mb,@mc AS mc;
        `);
        ids = setup.recordset[0];
        const { a,b,operator_id: operator,admin_id: admin,ma,mb,mc } = ids;
        const platform = await service.createSession(operator);
        assert.equal((await service.resolveSession(platform.token)).schoolId, null);
        const schoolA = await service.createSession(operator,ma);
        const schoolB = await service.createSession(operator,mb);
        assert.equal((await service.resolveSession(schoolA.token)).schoolId,a);
        assert.deepEqual((await service.resolveSession(schoolB.token)).roles,['librarian']);
        assert.equal(await service.validateCsrf(schoolA.token,schoolA.csrfToken),true);
        const available=await service.memberships(schoolA.token);
        assert.equal(available.length,2);assert.equal(available.every(row=>[a,b].includes(row.schoolId)),true);
        const refreshed=await service.refreshCsrf(schoolA.token);
        assert.equal(await service.validateCsrf(schoolA.token,schoolA.csrfToken),false);
        assert.equal(await service.validateCsrf(schoolA.token,refreshed.csrfToken),true);
        schoolA.csrfToken=refreshed.csrfToken;
        assert.equal(await service.validateCsrf(schoolA.token,schoolB.csrfToken),false);
        await assert.rejects(service.createSession(admin,ma), /Access denied/);
        const adminSession = await service.createSession(admin,mc);
        const proposal = { code: `${prefix}C`,name: 'Synthetic invited school',educationSystem: 'Francophone',
            intendedLoginKey: `synthetic:${suffix}`,requestId: suffix };
        await assert.rejects(service.inviteSchool(adminSession.token,proposal), /Access denied/);
        const invited = await service.inviteSchool(platform.token,proposal);
        assert.ok(invited.schoolId > 0);
        await assert.rejects(service.inviteSchool(platform.token,proposal));
        const stored = await db.getPool().request().input('school',sql.Int,invited.schoolId).query(`
            SELECT s.status,i.token_hash FROM dbo.schools s JOIN dbo.school_invitations i ON i.school_id=s.id WHERE s.id=@school;
            SELECT COUNT(*) AS count FROM dbo.identity_audit_events WHERE school_id=@school;
        `);
        assert.equal(stored.recordsets[0][0].status,'pending');
        assert.equal(stored.recordsets[0][0].token_hash,crypto.createHash('sha256').update(invited.invitationToken).digest('hex'));
        assert.equal(stored.recordsets[1][0].count,1);
        const password = crypto.randomBytes(24).toString('base64url');
        const acceptance = await Promise.allSettled([
            service.acceptInvitation(invited.invitationToken,password,`${suffix}-one`),
            service.acceptInvitation(invited.invitationToken,password,`${suffix}-two`),
        ]);
        assert.equal(acceptance.filter(item => item.status==='fulfilled').length,1);
        assert.equal(acceptance.filter(item => item.status==='rejected').length,1);
        await assert.rejects(service.acceptInvitation(invited.invitationToken,password,suffix), /Access denied/);
        const acceptedLogin = await service.login(proposal.intendedLoginKey,password,proposal.code);
        assert.deepEqual((await service.resolveSession(acceptedLogin.token)).roles,['admin']);
        assert.deepEqual((await service.resolveSession(acceptedLogin.token)).platformPermissions,[]);
        await assert.rejects(service.login(proposal.intendedLoginKey,'incorrect-password',proposal.code), /Access denied/);
        await assert.rejects(service.login(proposal.intendedLoginKey,password,`${prefix}A`), /Access denied/);
        await assert.rejects(service.login(proposal.intendedLoginKey,password), /Access denied/);
        const expiredInvite = await service.inviteSchool(platform.token,{ ...proposal,code:`${prefix}D`,intendedLoginKey:`${prefix}unused` });
        await db.getPool().request().query(`UPDATE dbo.school_invitations SET created_at=DATEADD(day,-3,SYSUTCDATETIME()),expires_at=DATEADD(day,-1,SYSUTCDATETIME()) WHERE school_id=${expiredInvite.schoolId}`);
        await assert.rejects(service.acceptInvitation(expiredInvite.invitationToken,password,suffix), /Access denied/);
        await db.getPool().request().query(`UPDATE dbo.school_invitations SET expires_at=DATEADD(day,1,SYSUTCDATETIME()),revoked_at=SYSUTCDATETIME() WHERE school_id=${expiredInvite.schoolId}`);
        await assert.rejects(service.acceptInvitation(expiredInvite.invitationToken,password,suffix), /Access denied/);
        const collisionInvite = await service.inviteSchool(platform.token,{ ...proposal,code:`${prefix}E`,intendedLoginKey:`${prefix}operator` });
        await assert.rejects(service.acceptInvitation(collisionInvite.invitationToken,password,suffix), /Access denied/);
        const collisionState = await db.getPool().request().query(`SELECT consumed_at FROM dbo.school_invitations WHERE school_id=${collisionInvite.schoolId}`);
        assert.equal(collisionState.recordset[0].consumed_at,null);
        await assert.rejects(service.switchSchool(schoolA.token,proposal.code), /Access denied/);
        assert.equal((await service.resolveSession(schoolA.token)).schoolId,a);
        const switching = await Promise.allSettled([
            service.switchSchool(schoolA.token,`${prefix}B`),
            service.switchSchool(schoolA.token,`${prefix}B`),
        ]);
        assert.equal(switching.filter(item => item.status==='fulfilled').length,1);
        const switched = switching.find(item => item.status==='fulfilled').value;
        assert.equal(await service.resolveSession(schoolA.token),null);
        assert.equal((await service.resolveSession(switched.token)).schoolId,b);
        assert.equal(await service.validateCsrf(switched.token,schoolA.csrfToken),false);
        assert.equal(await service.validateCsrf(switched.token,switched.csrfToken),true);
        // Renew A for the existing status tests; the old token must remain unusable.
        Object.assign(schoolA, await service.createSession(operator,ma));
        const expiredSession = await service.createSession(operator,ma);
        await db.getPool().request().input('hash',sql.Char(64),crypto.createHash('sha256').update(expiredSession.token).digest('hex'))
            .query('UPDATE dbo.account_sessions SET created_at=DATEADD(day,-2,SYSUTCDATETIME()),expires_at=DATEADD(day,-1,SYSUTCDATETIME()) WHERE token_hash=@hash');
        assert.equal(await service.resolveSession(expiredSession.token),null);
        await assert.rejects(service.switchSchool(expiredSession.token,`${prefix}B`), /Access denied/);
        await db.getPool().request().query(`UPDATE dbo.school_invitations SET revoked_at=NULL WHERE school_id=${expiredInvite.schoolId}`);
        await db.getPool().request().query(`UPDATE dbo.platform_role_grants SET revoked_at=SYSUTCDATETIME() WHERE account_id=${operator}`);
        assert.equal(await service.resolveSession(platform.token),null);
        await assert.rejects(service.acceptInvitation(expiredInvite.invitationToken,password,suffix), /Access denied/);
        await assert.rejects(service.inviteSchool(platform.token,{ ...proposal,code: `${prefix}F` }), /Access denied/);
        assert.deepEqual((await service.resolveSession(schoolA.token)).platformPermissions,[]);
        await db.getPool().request().query(`UPDATE dbo.schools SET status='suspended' WHERE id=${a}`);
        assert.equal(await service.resolveSession(schoolA.token),null);
        assert.equal((await service.resolveSession(schoolB.token)).schoolId,b);
        await db.getPool().request().query(`UPDATE dbo.school_memberships SET status='revoked' WHERE id=${mb}`);
        assert.equal(await service.resolveSession(schoolB.token),null);
        await service.revokeSession(adminSession.token);
        assert.equal(await service.resolveSession(adminSession.token),null);
        await assert.rejects(service.refreshCsrf(adminSession.token),/Access denied/);
        await assert.rejects(service.memberships(adminSession.token),/Access denied/);
        assert.equal(await service.validateCsrf(adminSession.token,adminSession.csrfToken),false);
        await db.getPool().request().query(`UPDATE dbo.schools SET status='active' WHERE id=${a}; UPDATE dbo.accounts SET security_version=security_version+1 WHERE id=${operator}`);
        assert.equal(await service.resolveSession(schoolA.token),null);
        const renewed = await service.createSession(operator,ma);
        await db.getPool().request().query(`UPDATE dbo.accounts SET status='disabled' WHERE id=${operator}`);
        assert.equal(await service.resolveSession(renewed.token),null);
    } finally {
        // Delete only exact fixture-owned accounts/schools, including a partially completed setup.
        // No shared reference rows or operator accounts are targeted.
        await db.getPool().request().input('prefix',sql.NVarChar(50),prefix).query(`
            DECLARE @schools TABLE(id INT PRIMARY KEY);
            INSERT @schools SELECT id FROM dbo.schools WHERE code IN (@prefix+'A',@prefix+'B',@prefix+'C',@prefix+'D',@prefix+'E',@prefix+'F');
            DECLARE @accounts TABLE(id INT PRIMARY KEY);
            INSERT @accounts SELECT id FROM dbo.accounts WHERE login_key IN (@prefix+'operator',@prefix+'admin',N'synthetic:${suffix}');
            DELETE FROM dbo.identity_audit_events WHERE school_id IN (SELECT id FROM @schools);
            DELETE FROM dbo.school_invitations WHERE school_id IN (SELECT id FROM @schools);
            DELETE FROM dbo.account_sessions WHERE account_id IN (SELECT id FROM @accounts);
            DELETE FROM dbo.platform_role_grants WHERE account_id IN (SELECT id FROM @accounts);
            DELETE FROM dbo.membership_roles WHERE school_id IN (SELECT id FROM @schools);
            DELETE FROM dbo.school_memberships WHERE school_id IN (SELECT id FROM @schools);
            DELETE FROM dbo.accounts WHERE id IN (SELECT id FROM @accounts);
            DELETE FROM dbo.schools WHERE id IN (SELECT id FROM @schools);
        `);
    }
});
