const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createDatabase,sql}=require('../../config/database');
const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const {createNativeStaffService}=require('../../model/identity/nativeStaffService');
test('two school super administrators manage only their school without platform authority',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
 const query=text=>db.getPool().request().query(text),prefix='SCHADM_'+crypto.randomBytes(6).toString('hex').toUpperCase();let ids,created=false;
 try{
  if(!(await query("SELECT OBJECT_ID('dbo.school_administrator_grants') id")).recordset[0].id){await query(fs.readFileSync(require.resolve('../../docs/implementation/staged/017_school_administration.sql'),'utf8'));created=true;}
  ids=(await db.getPool().request().input('p',sql.NVarChar(50),prefix).query(`
   INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'A','Synthetic school A','Bilingual','active');DECLARE @a int=SCOPE_IDENTITY();
   INSERT dbo.schools(code,name,education_system,status) VALUES(@p+'B','Synthetic school B','Bilingual','active');DECLARE @b int=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'A','unusable-test-hash','active');DECLARE @aa int=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'B','unusable-test-hash','active');DECLARE @ab int=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@p+'P','unusable-test-hash','active');DECLARE @provider int=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@aa,'active');DECLARE @ma int=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@ab,'active');DECLARE @mb int=SCOPE_IDENTITY();
   INSERT dbo.membership_roles VALUES(@a,@ma,'admin'),(@b,@mb,'admin');
   INSERT dbo.platform_role_grants(account_id,permission,granted_by) VALUES(@provider,'platform_operator',@provider);
   INSERT dbo.school_administrator_grants(school_id,membership_id,account_id,permission,granted_by) VALUES(@a,@ma,@aa,'school_super_admin',@provider),(@b,@mb,@ab,'school_super_admin',@provider);
   SELECT @a a,@b b,@aa aa,@ab ab,@ma ma,@mb mb,@provider provider;`)).recordset[0];
  const identity=require('../../model/identity/identityService').createIdentityService(db),service=createNativeStaffService(identity,db,{schoolAdministration:true});
  const ta=(await identity.createSession(ids.aa,ids.ma)).token,tb=(await identity.createSession(ids.ab,ids.mb)).token,tp=(await identity.createSession(ids.provider)).token;
  assert.deepEqual((await identity.resolveSession(ta)).platformPermissions,[]);
  assert.equal((await service.managementContext(ta)).schoolName,'Synthetic school A');
  await assert.rejects(service.managementContext(tp),e=>e.statusCode===403);
  for(const fn of ['directory','administrators','tokens','existingAccounts'])await assert.rejects(service[fn](ta,ids.b),e=>e.statusCode===403);
  const email=prefix+'@example.invalid';
  const pa=await service.createAdministrator(ta,{schoolId:ids.a,name:'School A administrator',email});
  await service.createAdministrator(tb,{schoolId:ids.b,name:'Private School B administrator',email});
  assert.deepEqual((await service.administrators(ta,ids.a)).map(x=>x.name),['School A administrator']);
  assert.deepEqual(await service.existingAccounts(ta,ids.a),[]);
  let review=(await service.administrators(ta,ids.a))[0];
  const input={schoolId:ids.a,profileId:pa.profileId,profileVersion:review.profileVersion,role:'admin'};
  await assert.rejects(service.issue(tb,input),e=>e.statusCode===403);
  const invite=await service.issue(ta,input);
  await assert.rejects(service.revoke(tb,invite.id),e=>e.statusCode===409);
  assert.equal((await service.tokens(tb,ids.b)).length,0);
  // Revoked issuer grants cannot be used by an outstanding invitation.
  await query(`UPDATE dbo.school_administrator_grants SET revoked_at=SYSUTCDATETIME() WHERE school_id=${ids.a}`);
  await assert.rejects(service.accept(invite.invitationToken,'Synthetic-school-password-2026!'),e=>e.statusCode===403);
  await assert.rejects(service.directory(ta,ids.a),e=>e.statusCode===403);
  await query(`UPDATE dbo.school_administrator_grants SET revoked_at=NULL WHERE school_id=${ids.a}`);
  const accepted=await service.accept(invite.invitationToken,'Synthetic-school-password-2026!');assert.equal(accepted.accountType,'admin');
  await assert.rejects(service.accept(invite.invitationToken,'Synthetic-school-password-2026!'),e=>e.statusCode===403);
  const guarded=require('../../scripts/canonicalSchool').guardedIdentity(db,{staffAccounts:true});
  const signed=await guarded.loginSchoolIdentity(prefix+'A','admin',email,'Synthetic-school-password-2026!');
  const admin=await guarded.resolveSession(signed.token);assert.deepEqual(admin.roles,['admin']);assert.deepEqual(admin.platformPermissions,[]);
  await assert.rejects(service.managementContext(signed.token),e=>e.statusCode===403);
  await assert.rejects(service.createAdministrator(signed.token,{schoolId:ids.a,name:'Escalation',email:prefix+'OTHER@example.invalid'}),e=>e.statusCode===403);
  await assert.rejects(guarded.loginSchoolIdentity(prefix+'B','admin',email,'Synthetic-school-password-2026!'),e=>e.statusCode===403);
  review=(await service.administrators(ta,ids.a))[0];
  const recoveryInput={schoolId:ids.a,profileId:pa.profileId,profileVersion:review.profileVersion,profileType:'admin'};
  const recovery=await service.issueRecovery(ta,recoveryInput);await service.reset(recovery.invitationToken,'Synthetic-next-password-2026!');assert.equal(await guarded.resolveSession(signed.token),null);
  // A shared account must not have its credentials changed by one school.
  await query(`INSERT dbo.school_memberships(school_id,account_id,status) VALUES(${ids.b},${admin.accountId},'active');`);
  await assert.rejects(service.issueRecovery(ta,recoveryInput),e=>e.statusCode===409);
  await query(`DELETE dbo.school_memberships WHERE school_id=${ids.b} AND account_id=${admin.accountId};`);
  // Even a valid super admin cannot remove a super-admin grant through ordinary administrator removal.
  await query(`INSERT dbo.school_administrator_grants(school_id,membership_id,account_id,permission,granted_by) VALUES(${ids.a},${admin.membershipId},${admin.accountId},'school_super_admin',${ids.aa});`);
  const disable={schoolId:ids.a,profileId:pa.profileId,profileVersion:review.profileVersion,linkVersion:review.linkVersion};
  await assert.rejects(service.disableAdministrator(ta,disable),e=>e.statusCode===409);
  await query(`DELETE dbo.school_administrator_grants WHERE account_id=${admin.accountId};`);
  await service.disableAdministrator(ta,disable);
  await assert.rejects(guarded.loginSchoolIdentity(prefix+'A','admin',email,'Synthetic-next-password-2026!'),e=>e.statusCode===403);
  // Cross-school grant binding is rejected by the composite FK.
  await assert.rejects(query(`INSERT dbo.school_administrator_grants(school_id,membership_id,account_id,permission,granted_by) VALUES(${ids.b},${ids.ma},${ids.aa},'school_super_admin',${ids.provider});`));
 }finally{
  if(ids){const accounts=(await query(`SELECT account_id FROM dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b})`)).recordset.map(r=>r.account_id);const all=[...new Set([...accounts,ids.provider])].join(',');
   await query(`DELETE dbo.school_administrator_grants WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.staff_profile_links WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.identity_audit_events WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.school_invitations WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.account_sessions WHERE account_id IN(${all});DELETE dbo.platform_role_grants WHERE account_id IN(${all});DELETE dbo.membership_roles WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.school_memberships WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.Admins WHERE school_id IN(${ids.a},${ids.b});DELETE dbo.accounts WHERE id IN(${all});DELETE dbo.schools WHERE id IN(${ids.a},${ids.b});`);}
  if(created)await query('DROP TABLE dbo.school_administrator_grants');
 }
});
