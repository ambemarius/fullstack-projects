const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createDatabase,sql}=require('../../config/database');const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const {createIdentityService}=require('../../model/identity/identityService');const {createAuxiliaryInvitationService}=require('../../model/identity/auxiliaryInvitationService');
const {createStaffProfileResolver}=require('../../model/identity/staffProfileResolver');const {auxiliaryVersion}=require('../../model/identity/auxiliaryService');
test('staged auxiliary invitations bind exact account/profile/role, preserve credentials and atomically create only a second-school membership',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
 const query=text=>db.getPool().request().query(text),prefix='AUXINV_'+crypto.randomBytes(6).toString('hex'),trigger='aux_invite_audit_'+crypto.randomBytes(6).toString('hex');let ids,created=false,installed=false;
 const existed=(await query("SELECT OBJECT_ID('dbo.staff_profile_links') id")).recordset[0].id;
 try{
  if(!existed){const ddl=new sql.Transaction(db.getPool());await ddl.begin();try{await new sql.Request(ddl).query(fs.readFileSync(require.resolve('../../docs/implementation/staged/009_staff_profile_links.sql'),'utf8'));await ddl.commit();created=true;}catch(error){await ddl.rollback();throw error;}}
  ids=(await db.getPool().request().input('prefix',sql.NVarChar(50),prefix).query(`
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'A','Synthetic A','Bilingual','active');DECLARE @a INT=SCOPE_IDENTITY();
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'B','Synthetic B','Bilingual','active');DECLARE @b INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'O','unusable-test-hash','active');DECLARE @o INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'R','unusable-test-hash','active');DECLARE @r INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'S','unusable-test-hash','active');DECLARE @s INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'T','unusable-test-hash','active');DECLARE @t INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@o,'active');DECLARE @mo INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@r,'active');DECLARE @mr INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@s,'active');DECLARE @ms INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@t,'active');DECLARE @mt INT=SCOPE_IDENTITY();
   INSERT dbo.membership_roles VALUES(@a,@mo,'admin'),(@a,@mr,'teacher'),(@a,@ms,'teacher'),(@a,@mt,'teacher');
   INSERT dbo.platform_role_grants(account_id,permission,granted_by) VALUES(@o,'platform_operator',@o);
   INSERT dbo.auxiliary_staff(name,firstName,lastName,email,role,status,school_id) VALUES('Synthetic recipient','Synthetic','Recipient',@prefix+'@example.invalid','Platform operator','active',@b);DECLARE @p INT=SCOPE_IDENTITY();
   INSERT dbo.auxiliary_staff(name,firstName,lastName,email,role,status,school_id) VALUES('Synthetic second','Synthetic','Second',@prefix+'2@example.invalid','Admin','active',@b);DECLARE @q INT=SCOPE_IDENTITY();
   SELECT @a a,@b b,@o o,@r r,@s s,@t t,@mo mo,@mr mr,@ms ms,@mt mt,@p p,@q q;`)).recordset[0];
  const identity=createIdentityService(db),service=createAuxiliaryInvitationService(identity,db),resolver=createStaffProfileResolver(identity,db),sessions={};
  for(const key of ['o','r','s','t'])sessions[key]=(await identity.createSession(ids[key],ids['m'+key])).token;
  const profile=async id=>(await query(`SELECT id,school_id,name,firstName,middleName,lastName,email,phone,role,status,createdAt FROM dbo.auxiliary_staff WHERE id=${id}`)).recordset[0];
  const input=async(accountId=ids.r,profileId=ids.p)=>({schoolId:ids.b,accountId,profileId,role:'librarian',profileVersion:auxiliaryVersion(await profile(profileId))});
  const snapshot=async()=>(await query(`SELECT id,login_key,password_hash,status,security_version FROM dbo.accounts WHERE id IN(${ids.o},${ids.r},${ids.s},${ids.t}) ORDER BY id`)).recordset;const before=await snapshot();
  await assert.rejects(service.issue(sessions.r,await input()),e=>e.statusCode===403);
  await assert.rejects(service.issue(sessions.o,{...await input(),schoolId:ids.a}),e=>e.statusCode===409);
  await assert.rejects(service.issue(sessions.o,{...await input(),profileVersion:'0'.repeat(64)}),e=>e.statusCode===409);
  const stale=await service.issue(sessions.o,await input());await assert.rejects(service.issue(sessions.o,await input(ids.s)),e=>e.statusCode===409);await assert.rejects(service.accept(sessions.s,stale.invitationToken),e=>e.statusCode===403);
  const stored=(await db.getPool().request().input('id',sql.Char(64),stale.id).query('SELECT token_hash,intended_login_key FROM dbo.school_invitations WHERE token_hash=@id')).recordset[0];assert.equal(stored.token_hash,crypto.createHash('sha256').update(stale.invitationToken).digest('hex'));assert.equal(JSON.stringify(stored).includes(stale.invitationToken),false);
  await query(`UPDATE dbo.auxiliary_staff SET phone='changed' WHERE id=${ids.p}`);await assert.rejects(service.accept(sessions.r,stale.invitationToken),e=>e.statusCode===409);await service.revoke(sessions.o,stale.id);await assert.rejects(service.accept(sessions.r,stale.invitationToken),e=>e.statusCode===403);
  const invite=await service.issue(sessions.o,await input());await query(`UPDATE dbo.auxiliary_staff SET status='suspended' WHERE id=${ids.p}`);await assert.rejects(service.accept(sessions.r,invite.invitationToken),e=>e.statusCode===409);await query(`UPDATE dbo.auxiliary_staff SET status='active' WHERE id=${ids.p}`);
  await query(`UPDATE dbo.platform_role_grants SET revoked_at=SYSUTCDATETIME() WHERE account_id=${ids.o}`);await assert.rejects(service.accept(sessions.r,invite.invitationToken),e=>e.statusCode===403);await query(`UPDATE dbo.platform_role_grants SET revoked_at=NULL WHERE account_id=${ids.o}`);
  await query(`CREATE TRIGGER dbo.[${trigger}] ON dbo.identity_audit_events AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE school_id=${ids.b} AND action='auxiliary_profile_invitation_accepted') THROW 50000,'Synthetic audit failure',1; END`);installed=true;
  await assert.rejects(service.accept(sessions.r,invite.invitationToken),e=>e.statusCode===500);assert.equal((await query(`SELECT COUNT(*) count FROM dbo.school_memberships WHERE school_id=${ids.b}`)).recordset[0].count,0);assert.deepEqual(await snapshot(),before);assert.ok(await identity.resolveSession(sessions.r));
  await query(`DROP TRIGGER dbo.[${trigger}]`);installed=false;const device=await identity.createSession(ids.r,ids.mr);
  const race=await Promise.allSettled([service.accept(sessions.r,invite.invitationToken),service.accept(sessions.r,invite.invitationToken)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.statusCode,403);const accepted=race.find(r=>r.status==='fulfilled').value;
  assert.equal(accepted.signedOut,true);assert.equal(await identity.resolveSession(sessions.r),null);assert.equal(await identity.resolveSession(device.token),null);
  assert.deepEqual((await query(`SELECT role FROM dbo.membership_roles WHERE school_id=${ids.b} AND membership_id=${accepted.membershipId}`)).recordset.map(r=>r.role),['librarian']);
  assert.deepEqual((await query(`SELECT role FROM dbo.membership_roles WHERE school_id=${ids.a} AND membership_id=${ids.mr}`)).recordset.map(r=>r.role),['teacher']);
  const newSession=await identity.createSession(ids.r,accepted.membershipId);assert.equal((await resolver.resolve(newSession.token)).profileId,ids.p);
  const after=await snapshot();assert.equal(after.find(r=>r.id===ids.r).security_version,2);assert.deepEqual(after.map(r=>({...r,security_version:1})),before);
  await assert.rejects(service.issue(sessions.o,await input(ids.s)),e=>e.statusCode===409);await assert.rejects(service.issue(sessions.o,await input(ids.r,ids.q)),e=>e.statusCode===409);
  const expired=await service.issue(sessions.o,await input(ids.s,ids.q));await db.getPool().request().input('id',sql.Char(64),expired.id).query('UPDATE dbo.school_invitations SET created_at=DATEADD(day,-2,SYSUTCDATETIME()),expires_at=DATEADD(day,-1,SYSUTCDATETIME()) WHERE token_hash=@id');await assert.rejects(service.accept(sessions.s,expired.invitationToken),e=>e.statusCode===403);await service.revoke(sessions.o,expired.id);
  await query(`INSERT dbo.school_memberships(school_id,account_id,status) VALUES(${ids.b},${ids.t},'revoked')`);await assert.rejects(service.issue(sessions.o,await input(ids.t,ids.q)),e=>e.statusCode===409);
  await query(`INSERT dbo.membership_roles VALUES(${ids.a},${ids.ms},'student')`);await assert.rejects(service.issue(sessions.o,await input(ids.s,ids.q)),e=>e.statusCode===403);
 }finally{
  if(installed)await query(`DROP TRIGGER dbo.[${trigger}]`);
  if(ids&&!created)await query(`DELETE dbo.staff_profile_links WHERE school_id IN(${ids.a},${ids.b})`);if(created)await query('DROP TABLE dbo.staff_profile_links');
  if(ids)await query(`DELETE dbo.identity_audit_events WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.school_invitations WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.account_sessions WHERE account_id IN(${ids.o},${ids.r},${ids.s},${ids.t});DELETE dbo.platform_role_grants WHERE account_id=${ids.o};DELETE dbo.membership_roles WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.auxiliary_staff WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.accounts WHERE id IN(${ids.o},${ids.r},${ids.s},${ids.t});DELETE dbo.schools WHERE id IN(${ids.a},${ids.b});`);
 }
 assert.equal(!!(await query("SELECT OBJECT_ID('dbo.staff_profile_links') id")).recordset[0].id,!!existed);
});
