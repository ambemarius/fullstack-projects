const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createDatabase,sql}=require('../../config/database');const {loadTestEnvironment,assertSyntheticDatabase}=require('../../scripts/testEnvironment');
const {createIdentityService}=require('../../model/identity/identityService');const {createStaffProfileResolver}=require('../../model/identity/staffProfileResolver');
test('staged staff links rehearse and roll back: same account, explicit school profiles, no email or job-title authority',async t=>{
 loadTestEnvironment();const db=createDatabase();t.after(()=>db.close());await assertSyntheticDatabase(db);
 const count=async()=>(await db.getPool().request().query('SELECT (SELECT COUNT(*) FROM dbo.accounts) accounts,(SELECT COUNT(*) FROM dbo.membership_roles) roles,(SELECT COUNT(*) FROM dbo.platform_role_grants) grants')).recordset[0];
 const before=await count(),existed=(await db.getPool().request().query("SELECT OBJECT_ID('dbo.staff_profile_links') id")).recordset[0].id;
 const tx=new sql.Transaction(db.getPool());await tx.begin();const query=text=>new sql.Request(tx).query(text);
 try{
  if(!existed)await query(fs.readFileSync(require.resolve('../../docs/implementation/staged/009_staff_profile_links.sql'),'utf8'));
  const prefix='LINK_'+crypto.randomBytes(6).toString('hex');
  const ids=(await new sql.Request(tx).input('prefix',sql.NVarChar(50),prefix).query(`
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'A','Synthetic A','Bilingual','active');DECLARE @a INT=SCOPE_IDENTITY();
   INSERT dbo.schools(code,name,education_system,status) VALUES(@prefix+'B','Synthetic B','Bilingual','active');DECLARE @b INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'1','unusable-test-hash','active');DECLARE @one INT=SCOPE_IDENTITY();
   INSERT dbo.accounts(login_key,password_hash,status) VALUES(@prefix+'2','unusable-test-hash','active');DECLARE @two INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@a,@one,'active');DECLARE @ma INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@one,'active');DECLARE @mb INT=SCOPE_IDENTITY();
   INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@b,@two,'active');DECLARE @mt INT=SCOPE_IDENTITY();
   INSERT dbo.membership_roles VALUES(@a,@ma,'teacher'),(@b,@mb,'librarian'),(@b,@mt,'librarian');
   INSERT dbo.auxiliary_staff(name,firstName,lastName,email,role,status,school_id) VALUES('Synthetic A','Synthetic','A',@prefix+'@example.invalid','Platform operator','active',@a);DECLARE @pa INT=SCOPE_IDENTITY();
   INSERT dbo.auxiliary_staff(name,firstName,lastName,email,role,status,school_id) VALUES('Synthetic B','Synthetic','B',@prefix+'@example.invalid','Admin','active',@b);DECLARE @pb INT=SCOPE_IDENTITY();
   SELECT @a a,@b b,@one one,@two two,@ma ma,@mb mb,@mt mt,@pa pa,@pb pb;`)).recordset[0];
  const insert=(school,member,account,profile,role='librarian')=>query(`INSERT dbo.staff_profile_links(school_id,membership_id,account_id,auxiliary_profile_id,required_role,created_by) VALUES(${school},${member},${account},${profile},'${role}',${ids.one})`);
  await assert.rejects(insert(ids.a,ids.ma,ids.one,ids.pb)); // foreign-school profile
  await assert.rejects(insert(ids.a,ids.mb,ids.one,ids.pa)); // foreign membership
  await assert.rejects(insert(ids.a,ids.ma,ids.two,ids.pa)); // wrong account/member
  await assert.rejects(insert(ids.a,ids.ma,ids.one,ids.pa,'admin')); // auxiliary job title cannot select admin
  await assert.rejects(insert(ids.a,ids.ma,ids.one,ids.pa,'platform_operator'));
  await query(`INSERT dbo.staff_profile_links(school_id,membership_id,account_id,auxiliary_profile_id,required_role,created_by) VALUES(${ids.a},${ids.ma},${ids.one},${ids.pa},'librarian',${ids.one}),(${ids.b},${ids.mb},${ids.one},${ids.pb},'librarian',${ids.one})`);
  await assert.rejects(insert(ids.b,ids.mt,ids.two,ids.pb)); // cannot claim another account's profile
  const transactionDb={connect:async()=>{},getPool:()=>({request:()=>new sql.Request(tx)})};
  const identity=createIdentityService(transactionDb),resolver=createStaffProfileResolver(identity,transactionDb);
  const sa=await identity.createSession(ids.one,ids.ma),sb=await identity.createSession(ids.one,ids.mb);
  assert.equal(await resolver.resolve(sa.token),null); // link alone grants no membership role
  await query(`INSERT dbo.membership_roles VALUES(${ids.a},${ids.ma},'librarian')`);
  assert.equal((await resolver.resolve(sa.token)).profileId,ids.pa);assert.equal((await resolver.resolve(sb.token)).profileId,ids.pb);
  assert.equal((await resolver.resolve(sa.token)).schoolId,ids.a);
  const forged=createStaffProfileResolver({resolveSession:async()=>({accountId:ids.one,schoolId:ids.b,membershipId:ids.mb})},transactionDb);assert.equal(await forged.resolve(sa.token),null);
  await query(`UPDATE dbo.auxiliary_staff SET status='suspended' WHERE id=${ids.pa}`);assert.equal(await resolver.resolve(sa.token),null);assert.equal((await resolver.resolve(sb.token)).profileId,ids.pb);
  await query(`UPDATE dbo.auxiliary_staff SET status='active' WHERE id=${ids.pa};DELETE dbo.membership_roles WHERE school_id=${ids.a} AND membership_id=${ids.ma} AND role='librarian'`);assert.equal(await resolver.resolve(sa.token),null);
  await query(`INSERT dbo.membership_roles VALUES(${ids.a},${ids.ma},'librarian');UPDATE dbo.staff_profile_links SET link_status='revoked' WHERE school_id=${ids.a}`);assert.equal(await resolver.resolve(sa.token),null);
  await query(`UPDATE dbo.accounts SET security_version=security_version+1 WHERE id=${ids.one}`);assert.equal(await resolver.resolve(sb.token),null);
 }finally{await tx.rollback();}
 assert.equal(!!(await db.getPool().request().query("SELECT OBJECT_ID('dbo.staff_profile_links') id")).recordset[0].id,!!existed);assert.deepEqual(await count(),before);
});
