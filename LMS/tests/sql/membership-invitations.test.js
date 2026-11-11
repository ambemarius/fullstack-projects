const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');const {createDatabase,sql}=require('../../config/database');const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');const {createIdentityService}=require('../../model/identity/identityService');const {createMembershipInvitationService}=require('../../model/identity/membershipInvitationService');
test('authenticated existing-account admin invitations preserve identity, isolate platform authority and handle replay/revocation/races atomically',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);const prefix='INV_'+crypto.randomBytes(6).toString('hex').toUpperCase(),trigger='invite_audit_'+crypto.randomBytes(6).toString('hex');let ids,installed=false;
 const request=()=>db.getPool().request();const query=text=>request().query(text);
 try{
  ids=(await request().input('prefix',sql.NVarChar(50),prefix).query(`
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'A','Synthetic A','Bilingual','active');DECLARE @a INT=SCOPE_IDENTITY();
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'B','Synthetic B','Bilingual','active');DECLARE @b INT=SCOPE_IDENTITY();
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'C','Synthetic pending','Bilingual','pending');DECLARE @c INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'O','unusable-fixture-hash','active');DECLARE @o INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'R','unusable-fixture-hash','active');DECLARE @r INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'S','unusable-fixture-hash','active');DECLARE @s INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'U','unusable-fixture-hash','active');DECLARE @u INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'P','unusable-fixture-hash','active');DECLARE @p INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'V','unusable-fixture-hash','active');DECLARE @v INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@o,'active');DECLARE @mo INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@r,'active');DECLARE @mr INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@s,'active');DECLARE @ms INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@u,'active');DECLARE @mu INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@p,'active');DECLARE @mp INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@v,'active');DECLARE @mv INT=SCOPE_IDENTITY();
   INSERT dbo.membership_roles VALUES(@a,@mo,'admin'),(@a,@mr,'teacher'),(@a,@ms,'teacher'),(@a,@mu,'admin'),(@a,@mp,'student'),(@a,@mv,'teacher');
   INSERT dbo.platform_role_grants(account_id,permission,granted_by) VALUES(@o,'platform_operator',@o);
   SELECT @a a,@b b,@c c,@o o,@r r,@s s,@u u,@p p,@v v,@mo mo,@mr mr,@ms ms,@mu mu,@mp mp,@mv mv;`)).recordset[0];
  // The unrestricted engine branch is tested explicitly, but never exposed by the mounted runtime.
  const identity=createIdentityService(db),service=createMembershipInvitationService(identity,db,{requireSchoolProfile:false}),sessions={};for(const key of ['o','r','s','u','p','v'])sessions[key]=(await identity.createSession(ids[key],ids['m'+key])).token;
  const accountSnapshot=async()=>(await query(`SELECT id,login_key,password_hash,status,security_version FROM dbo.accounts WHERE id IN(${ids.o},${ids.r},${ids.s},${ids.u},${ids.p},${ids.v}) ORDER BY id`)).recordset;const before=await accountSnapshot();
  // Production policy: only an already-verified active local staff profile can gain admin.
  await query(`INSERT dbo.Admins(name,email,password,role,school_id) VALUES('Synthetic operator','${prefix}O@example.invalid','unusable-fixture-hash','Admin',${ids.a});DECLARE @op INT=SCOPE_IDENTITY();
   INSERT dbo.legacy_account_map VALUES('Admins',@op,${ids.o},${ids.a},${ids.mo},'verified',SYSUTCDATETIME());
   INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,status,school_id) VALUES('Synthetic recipient','Synthetic','Recipient','${prefix}R@example.invalid','unusable-fixture-hash','Part-time','Anglophone','active',${ids.a});DECLARE @teacher INT=SCOPE_IDENTITY();
   INSERT dbo.legacy_account_map VALUES('teachers',@teacher,${ids.r},${ids.a},${ids.mr},'verified',SYSUTCDATETIME());`);
  const guarded=require('../../scripts/canonicalSchool').guardedIdentity(db);
  const local=createMembershipInvitationService(guarded,db,{requireSchoolProfile:true,schoolCode:prefix+'A'});
  const profilePolicy=createMembershipInvitationService(identity,db,{requireSchoolProfile:true});
  assert.deepEqual((await local.eligible(sessions.o,ids.a)).map(r=>r.accountId),[ids.r]);
  await assert.rejects(local.issue(sessions.o,{schoolId:ids.b,accountId:ids.r}),e=>e.statusCode===403);
  await assert.rejects(profilePolicy.issue(sessions.o,{schoolId:ids.b,accountId:ids.r}),e=>e.statusCode===409);
  const localInvite=await local.issue(sessions.o,{schoolId:ids.a,accountId:ids.r});
  await query(`UPDATE dbo.teachers SET status='suspended' WHERE school_id=${ids.a}`);await assert.rejects(profilePolicy.accept(sessions.r,localInvite.invitationToken),e=>e.statusCode===409);await assert.rejects(local.accept(sessions.r,localInvite.invitationToken),e=>e.statusCode===403);await query(`UPDATE dbo.teachers SET status='active' WHERE school_id=${ids.a}`);
  await query(`UPDATE dbo.legacy_account_map SET reconciliation_status='pending' WHERE account_id=${ids.r}`);await assert.rejects(profilePolicy.accept(sessions.r,localInvite.invitationToken),e=>e.statusCode===409);await query(`UPDATE dbo.legacy_account_map SET reconciliation_status='verified' WHERE account_id=${ids.r}`);
  await query(`UPDATE dbo.teachers SET password='synthetic-drift-only' WHERE school_id=${ids.a}`);await assert.rejects(profilePolicy.accept(sessions.r,localInvite.invitationToken),e=>e.statusCode===409);await query(`UPDATE dbo.teachers SET password='unusable-fixture-hash' WHERE school_id=${ids.a}`);
  await local.accept(sessions.r,localInvite.invitationToken);assert.deepEqual([...((await guarded.resolveSession(sessions.r)).roles)].sort(),['admin','teacher']);assert.equal((await local.eligible(sessions.o,ids.a)).length,0);
  await assert.rejects(service.issue(sessions.u,{schoolId:ids.b,accountId:ids.r}),e=>e.statusCode===403); // school admin has no platform permission
  await assert.rejects(service.issue(sessions.o,{schoolId:ids.c,accountId:ids.r}),e=>e.statusCode===403); // pending-school bootstrap is separate
  await assert.rejects(service.issue(sessions.o,{schoolId:ids.b,accountId:ids.p}),e=>e.statusCode===403); // pupil cannot be invited as school administrator
  const invite=await service.issue(sessions.o,{schoolId:ids.b,accountId:ids.r});assert.equal(invite.role,'admin');assert.equal(invite.invitationToken.length,43);
  const saved=(await request().input('id',sql.Char(64),invite.id).query('SELECT token_hash,intended_login_key,consumed_at FROM dbo.school_invitations WHERE token_hash=@id')).recordset[0];assert.equal(saved.token_hash,crypto.createHash('sha256').update(invite.invitationToken).digest('hex'));assert.equal(JSON.stringify(saved).includes(invite.invitationToken),false);
  await assert.rejects(service.issue(sessions.o,{schoolId:ids.b,accountId:ids.r}),e=>e.statusCode===409);
  await assert.rejects(service.accept(sessions.s,invite.invitationToken),e=>e.statusCode===403);await assert.rejects(service.accept(sessions.r,invite.id),e=>e.statusCode===403);
  const race=await Promise.allSettled([service.accept(sessions.r,invite.invitationToken),service.accept(sessions.r,invite.invitationToken)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.statusCode,403);
  await assert.rejects(service.accept(sessions.r,invite.invitationToken),e=>e.statusCode===403);
  const switched=await identity.switchSchool(sessions.r,prefix+'B');assert.deepEqual((await identity.resolveSession(switched.token)).roles,['admin']);assert.equal((await identity.resolveSession(switched.token)).platformPermissions.length,0);await assert.rejects(service.issue(switched.token,{schoolId:ids.a,accountId:ids.s}),e=>e.statusCode===403);
  // Explicitly add admin to an already-active school membership without deleting its teacher role.
  await query(`INSERT dbo.school_memberships(school_id,account_id,status) VALUES(${ids.b},${ids.s},'active');DECLARE @m INT=SCOPE_IDENTITY();INSERT dbo.membership_roles VALUES(${ids.b},@m,'teacher');`);
  const staffInvite=await service.issue(sessions.o,{schoolId:ids.b,accountId:ids.s});const accepted=await service.accept(sessions.s,staffInvite.invitationToken);
  const roles=(await query(`SELECT role FROM dbo.membership_roles WHERE school_id=${ids.b} AND membership_id=${accepted.membershipId} ORDER BY role`)).recordset.map(r=>r.role);assert.deepEqual(roles,['admin','teacher']);
  const revoked=await service.issue(sessions.o,{schoolId:ids.b,accountId:ids.u});const catalog=await service.list(sessions.o,ids.b);assert.equal(JSON.stringify(catalog).includes(revoked.invitationToken),false);assert.ok(catalog.some(row=>row.id===revoked.id&&row.status==='pending'));
  await service.revoke(sessions.o,revoked.id);await assert.rejects(service.accept(sessions.u,revoked.invitationToken),e=>e.statusCode===403);
  const expired=await service.issue(sessions.o,{schoolId:ids.b,accountId:ids.u});await request().input('id',sql.Char(64),expired.id).query("UPDATE dbo.school_invitations SET created_at=DATEADD(day,-2,SYSUTCDATETIME()),expires_at=DATEADD(day,-1,SYSUTCDATETIME()) WHERE token_hash=@id");await assert.rejects(service.accept(sessions.u,expired.invitationToken),e=>e.statusCode===403);
  const authorityInvite=await service.issue(sessions.o,{schoolId:ids.b,accountId:ids.u});await query(`UPDATE dbo.platform_role_grants SET revoked_at=SYSUTCDATETIME() WHERE account_id=${ids.o}`);await assert.rejects(service.accept(sessions.u,authorityInvite.invitationToken),e=>e.statusCode===403);await query(`UPDATE dbo.platform_role_grants SET revoked_at=NULL WHERE account_id=${ids.o}`);
  await query(`UPDATE dbo.accounts SET status='disabled' WHERE id=${ids.o}`);await assert.rejects(service.accept(sessions.u,authorityInvite.invitationToken),e=>e.statusCode===403);await query(`UPDATE dbo.accounts SET status='active' WHERE id=${ids.o}`);
  await query(`INSERT dbo.school_memberships(school_id,account_id,status) VALUES(${ids.b},${ids.u},'revoked')`);await assert.rejects(service.accept(sessions.u,authorityInvite.invitationToken),e=>e.statusCode===409);await assert.rejects(service.issue(sessions.o,{schoolId:ids.b,accountId:ids.u}),e=>e.statusCode===409);
  const finalInvite=await service.issue(sessions.o,{schoolId:ids.b,accountId:ids.v});await request().input('key',sql.NVarChar(255),prefix+'V_CHANGED').query(`UPDATE dbo.accounts SET login_key=@key WHERE id=${ids.v}`);await assert.rejects(service.accept(sessions.v,finalInvite.invitationToken),e=>e.statusCode===403);await request().input('key',sql.NVarChar(255),prefix+'V').query(`UPDATE dbo.accounts SET login_key=@key WHERE id=${ids.v}`);
  await query(`UPDATE dbo.accounts SET status='disabled' WHERE id=${ids.v}`);await assert.rejects(service.accept(sessions.v,finalInvite.invitationToken),e=>e.statusCode===403);await query(`UPDATE dbo.accounts SET status='active' WHERE id=${ids.v}`);
  await query(`CREATE TRIGGER dbo.[${trigger}] ON dbo.identity_audit_events AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE school_id=${ids.b} AND action='existing_admin_invitation_accepted') THROW 50000,'Synthetic audit failure',1; END`);installed=true;
  await assert.rejects(service.accept(sessions.v,finalInvite.invitationToken),e=>e.statusCode===500);assert.equal((await query(`SELECT COUNT(*) count FROM dbo.school_memberships WHERE school_id=${ids.b} AND account_id=${ids.v}`)).recordset[0].count,0);
  assert.equal((await request().input('id',sql.Char(64),finalInvite.id).query('SELECT consumed_at FROM dbo.school_invitations WHERE token_hash=@id')).recordset[0].consumed_at,null);
  await query(`DROP TRIGGER dbo.[${trigger}]`);installed=false;await service.accept(sessions.v,finalInvite.invitationToken);assert.deepEqual(await accountSnapshot(),before);
  assert.equal((await query(`SELECT COUNT(*) count FROM dbo.platform_role_grants WHERE account_id IN(${ids.o},${ids.r},${ids.s},${ids.u},${ids.p},${ids.v})`)).recordset[0].count,1);
  // Public acceptance requires fresh login: grant, security-version bump and all-session revocation are atomic.
  await query(`INSERT dbo.teachers(name,firstName,lastName,email,password,employmentType,section,status,school_id) VALUES('Synthetic public recipient','Synthetic','Public','${prefix}S@example.invalid','unusable-fixture-hash','Part-time','Anglophone','active',${ids.a});DECLARE @teacher INT=SCOPE_IDENTITY();INSERT dbo.legacy_account_map VALUES('teachers',@teacher,${ids.s},${ids.a},${ids.ms},'verified',SYSUTCDATETIME());`);
  const publicInvite=await local.issue(sessions.o,{schoolId:ids.a,accountId:ids.s}),otherDevice=await identity.createSession(ids.s,ids.ms);
  const publicRace=await Promise.allSettled([local.accept(sessions.s,publicInvite.invitationToken,{signOut:true}),local.accept(sessions.s,publicInvite.invitationToken,{signOut:true})]);assert.equal(publicRace.filter(r=>r.status==='fulfilled').length,1);assert.equal(publicRace.find(r=>r.status==='rejected').reason.statusCode,403);
  assert.equal(await identity.resolveSession(sessions.s),null);assert.equal(await identity.resolveSession(otherDevice.token),null);
  const afterPublic=await accountSnapshot();assert.equal(afterPublic.find(r=>r.id===ids.s).security_version,2);assert.deepEqual(afterPublic.map(r=>({...r,security_version:1})),before);
  // Operator can remove only a verified teacher's accepted additional admin role.
  const directory=await local.administrators(sessions.o,ids.a),review=directory.find(r=>r.accountId===ids.s);assert.equal(review.canRemove,1);assert.equal(directory.find(r=>r.accountId===ids.o).canRemove,0);assert.equal(JSON.stringify(directory).includes('password'),false);
  await assert.rejects(local.administrators(sessions.u,ids.a),e=>e.statusCode===403);
  await assert.rejects(local.administrators(sessions.o,ids.b),e=>e.statusCode===403);
  await assert.rejects(local.removeAdministrator(sessions.o,{schoolId:ids.a,accountId:ids.o,version:1}),e=>e.statusCode===409);
  await assert.rejects(local.removeAdministrator(sessions.o,{schoolId:ids.a,accountId:ids.s,version:1}),e=>e.statusCode===409);
  await query(`CREATE TRIGGER dbo.[${trigger}] ON dbo.identity_audit_events AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE school_id=${ids.a} AND action='invited_admin_role_removed') THROW 50000,'Synthetic audit failure',1; END`);installed=true;
  const renewed=await identity.createSession(ids.s,ids.ms),removeInput={schoolId:ids.a,accountId:ids.s,version:review.version};
  await assert.rejects(local.removeAdministrator(sessions.o,removeInput),e=>e.statusCode===500);assert.ok((await identity.resolveSession(renewed.token)).roles.includes('admin'));assert.equal((await accountSnapshot()).find(r=>r.id===ids.s).security_version,2);
  await query(`DROP TRIGGER dbo.[${trigger}]`);installed=false;
  const removalRace=await Promise.allSettled([local.removeAdministrator(sessions.o,removeInput),local.removeAdministrator(sessions.o,removeInput)]);assert.equal(removalRace.filter(r=>r.status==='fulfilled').length,1);assert.equal(removalRace.find(r=>r.status==='rejected').reason.statusCode,409);
  assert.equal(await identity.resolveSession(renewed.token),null);
  assert.deepEqual((await query(`SELECT role FROM dbo.membership_roles WHERE school_id=${ids.a} AND membership_id=${ids.ms} ORDER BY role`)).recordset.map(r=>r.role),['teacher']);
  assert.deepEqual((await query(`SELECT role FROM dbo.membership_roles WHERE school_id=${ids.b} AND membership_id=${accepted.membershipId} ORDER BY role`)).recordset.map(r=>r.role),['admin','teacher']);
  const afterRemoval=await accountSnapshot();assert.equal(afterRemoval.find(r=>r.id===ids.s).security_version,3);assert.deepEqual(afterRemoval.map(r=>({...r,security_version:1})),before);
 }finally{if(installed)await query(`DROP TRIGGER dbo.[${trigger}]`);if(ids)await query(`
  DELETE dbo.identity_audit_events WHERE school_id IN(${ids.a},${ids.b},${ids.c});DELETE dbo.school_invitations WHERE school_id IN(${ids.a},${ids.b},${ids.c});
  DELETE dbo.account_sessions WHERE account_id IN(${ids.o},${ids.r},${ids.s},${ids.u},${ids.p},${ids.v});DELETE dbo.platform_role_grants WHERE account_id=${ids.o};
  DELETE dbo.legacy_account_map WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.teachers WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.Admins WHERE school_id IN(${ids.a},${ids.b});
  DELETE dbo.membership_roles WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.accounts WHERE id IN(${ids.o},${ids.r},${ids.s},${ids.u},${ids.p},${ids.v});DELETE dbo.schools WHERE id IN(${ids.a},${ids.b},${ids.c});`);}
});
