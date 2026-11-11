const fs=require('node:fs'),crypto=require('node:crypto');
const {sql}=require('../config/database');
const {assertSyntheticDatabase}=require('./testEnvironment');
async function prepareFinanceSample(db,school,role='admin'){
 if(!['admin','bursar'].includes(role))throw Error('Invalid finance sample role');
 await assertSyntheticDatabase(db);
 const ddl=fs.readFileSync(require.resolve('../docs/implementation/staged/016_financial_management.sql'),'utf8');
 const checksum=crypto.createHash('sha256').update(ddl.replace(/\r\n/g,'\n')).digest('hex');
 const tx=new sql.Transaction(db.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 const request=()=>new sql.Request(tx).input('school',sql.Int,school.schoolId);
 try{
  await request().query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='lms-finance-sample',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
    IF @r<0 THROW 50402,'Finance practice workspace busy',1;`);
  const state=(await request().query(`SELECT (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') AND
    name IN ('finance_charges','finance_payments','finance_reversals','finance_cancellations')) tables,
    (SELECT CONVERT(varchar(64),value) FROM sys.extended_properties WHERE class=1 AND major_id=OBJECT_ID('dbo.finance_charges') AND name='LMS_FINANCE_SAMPLE') checksum`)).recordset[0];
  if(!state.tables){
   await request().query(ddl);
   await request().input('hash',sql.VarChar(64),checksum).query("EXEC sys.sp_addextendedproperty @name='LMS_FINANCE_SAMPLE',@value=@hash,@level0type='SCHEMA',@level0name='dbo',@level1type='TABLE',@level1name='finance_charges'");
  }else if(state.tables!==4||state.checksum!==checksum)throw Error('Finance practice schema requires review');
  const result=await request().input('role',sql.VarChar(30),role).query(`
    DECLARE @login nvarchar(255)=(SELECT code+'_finance_'+@role FROM dbo.schools WHERE id=@school AND code LIKE 'ATT[_]SAMPLE[_]%');
    IF @login IS NULL THROW 50403,'Unexpected sample school',1;
    IF NOT EXISTS(SELECT 1 FROM dbo.accounts WHERE login_key=@login) BEGIN
      INSERT dbo.accounts(login_key,password_hash,status) VALUES(@login,'unusable-finance-sample','active');
      DECLARE @a int=SCOPE_IDENTITY();INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@a,'active');
      DECLARE @m int=SCOPE_IDENTITY();INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@m,@role);
    END;
    SELECT a.id accountId,m.id membershipId FROM dbo.accounts a
    JOIN dbo.school_memberships m ON m.account_id=a.id AND m.school_id=@school
    JOIN dbo.membership_roles r ON r.school_id=m.school_id AND r.membership_id=m.id AND r.role=@role
    WHERE a.login_key=@login AND a.password_hash='unusable-finance-sample'
      AND NOT EXISTS(SELECT 1 FROM dbo.membership_roles other WHERE other.membership_id=m.id AND other.role<>@role);`);
  if(result.recordset.length!==1)throw Error('Sample finance identity requires review');
  await tx.commit();return result.recordset[0];
 }catch(error){await tx.rollback().catch(()=>{});throw error;}
}
module.exports={prepareFinanceSample};
