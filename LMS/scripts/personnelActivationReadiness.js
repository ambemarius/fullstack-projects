// Read-only aggregate review: adopted credentials and explicit native admin lineage remain separate.
const {sql}=require('../config/database');
async function personnelActivationReadiness(database,{schoolCode='LYCEE_BATOURI',exclusive=true}={}){
 if(typeof schoolCode!=='string'||!/^[A-Z0-9_-]{2,50}$/.test(schoolCode)||typeof exclusive!=='boolean')throw Error('Invalid personnel review scope');
 const result=(await database.getPool().request().input('schoolCode',sql.NVarChar(50),schoolCode).input('exclusive',sql.Bit,exclusive).query(`
  DECLARE @expected_school INT=(SELECT id FROM dbo.schools WHERE code=@schoolCode);
  WITH native_admins AS (
   SELECT p.id,p.school_id,p.role,l.id link_id,l.account_id,l.required_role,l.link_status,
    a.id canonical_id,a.login_key,a.status account_status,m.id member_id,m.status member_status,
    CASE WHEN EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=l.school_id AND r.membership_id=l.membership_id AND r.role='admin') THEN 1 ELSE 0 END admin_role
   FROM dbo.Admins p
   LEFT JOIN dbo.staff_profile_links l ON l.school_id=p.school_id AND l.admin_profile_id=p.id
   LEFT JOIN dbo.accounts a ON a.id=l.account_id
   LEFT JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.school_id=l.school_id AND m.account_id=l.account_id
   WHERE EXISTS(SELECT 1 FROM dbo.identity_audit_events e WHERE e.school_id=p.school_id AND e.action='native_admin_profile_created' AND e.resource_type='admin_profile' AND e.resource_id=CONVERT(nvarchar(100),p.id))
  ), profiles AS (
   SELECT 'teachers' source_table,id,school_id,password,'teacher' role,CASE WHEN status='active' THEN 'active' ELSE 'revoked' END membership_status FROM dbo.teachers
   UNION ALL SELECT 'students',id,school_id,password,'student',CASE WHEN isWithdrawn=0 THEN 'active' ELSE 'revoked' END FROM dbo.students
   UNION ALL SELECT 'Admins',p.id,p.school_id,p.password,'admin','active' FROM dbo.Admins p WHERE LOWER(LTRIM(RTRIM(p.role)))='admin' AND NOT EXISTS(SELECT 1 FROM native_admins n WHERE n.id=p.id)
  )
  SELECT legacy.*,native.nativeProfileDrift FROM dbo.schools s
  CROSS APPLY (
   SELECT COALESCE(SUM(CASE WHEN p.school_id IS NULL OR p.school_id<>@expected_school THEN 1 ELSE 0 END),0) unownedProfiles,
    COALESCE(SUM(CASE WHEN l.account_id IS NULL OR a.id IS NULL OR m.id IS NULL OR l.reconciliation_status<>'verified' OR l.school_id<>p.school_id THEN 1 ELSE 0 END),0) unmappedProfiles,
    COALESCE(SUM(CASE WHEN a.id IS NOT NULL AND a.password_hash COLLATE Latin1_General_100_BIN2<>p.password COLLATE Latin1_General_100_BIN2 THEN 1 ELSE 0 END),0) credentialDrift,
    COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.status<>p.membership_status THEN 1 ELSE 0 END),0) membershipDrift,
    COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND r.membership_id IS NULL THEN 1 ELSE 0 END),0) roleDrift
   FROM profiles p LEFT JOIN dbo.legacy_account_map l ON l.source_table=p.source_table AND l.legacy_id=p.id
   LEFT JOIN dbo.accounts a ON a.id=l.account_id
   LEFT JOIN dbo.school_memberships m ON m.id=l.membership_id AND m.account_id=l.account_id AND m.school_id=l.school_id
   LEFT JOIN dbo.membership_roles r ON r.school_id=m.school_id AND r.membership_id=m.id AND r.role=p.role
   WHERE @exclusive=1 OR p.school_id=@expected_school
  ) legacy
  CROSS APPLY (
   SELECT COUNT(*) nativeProfileDrift FROM native_admins n WHERE (@exclusive=1 OR n.school_id=@expected_school) AND (
    n.school_id IS NULL OR n.school_id<>@expected_school OR LOWER(LTRIM(RTRIM(n.role)))<>'admin'
    OR EXISTS(SELECT 1 FROM dbo.legacy_account_map old WHERE old.source_table='Admins' AND old.legacy_id=n.id)
    OR (n.link_id IS NOT NULL AND (n.canonical_id IS NULL OR n.member_id IS NULL OR n.login_key NOT LIKE N'native-staff:%' OR n.account_status NOT IN ('active','disabled') OR n.required_role<>'admin'
      OR EXISTS(SELECT 1 FROM dbo.legacy_account_map old WHERE old.account_id=n.account_id)
      OR NOT ((n.link_status='active' AND n.member_status='active' AND n.admin_role=1) OR(n.link_status='revoked' AND n.member_status='revoked'))))
   )
  ) native WHERE s.code=@schoolCode;`)).recordset[0];
 if(!result||Object.values(result).some(value=>Number(value)!==0))throw Object.assign(new Error('Personnel drift requires review before write activation'),{review:result});
 return result;
}
module.exports={personnelActivationReadiness};
