const fs=require('node:fs');
const crypto=require('node:crypto');
const {sql}=require('../config/database');
const {assertSyntheticDatabase}=require('./testEnvironment');

async function prepareAttendanceSample(db,code){
    await assertSyntheticDatabase(db);
    if(!/^ATT_SAMPLE_[A-Z0-9]{1,24}$/.test(code))throw Error('Invalid sample school');
    const ddl=fs.readFileSync(require.resolve('../docs/implementation/staged/014_attendance_register.sql'),'utf8');
    const checksum=crypto.createHash('sha256').update(ddl.replace(/\r\n/g,'\n')).digest('hex');
    const tx=new sql.Transaction(db.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const request=()=>new sql.Request(tx);
    try{
        await request().query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='lms-attendance-sample',@LockMode='Exclusive',
            @LockOwner='Transaction',@LockTimeout=10000;IF @r<0 THROW 50400,'Sample busy',1;`);
        const state=(await request().query(`SELECT OBJECT_ID('dbo.attendance_sessions') AS sessions,
            OBJECT_ID('dbo.attendance_roster') AS roster,OBJECT_ID('dbo.attendance_revisions') AS revisions,
            (SELECT CONVERT(nvarchar(64),value) FROM sys.extended_properties WHERE class=1
            AND major_id=OBJECT_ID('dbo.attendance_sessions') AND name='LMS_ATTENDANCE_SAMPLE') AS checksum`)).recordset[0];
        if(!state.sessions&&!state.roster&&!state.revisions){
            await request().query(ddl);
            await request().input('hash',sql.NVarChar(64),checksum).query(`EXEC sys.sp_addextendedproperty
                @name='LMS_ATTENDANCE_SAMPLE',@value=@hash,@level0type='SCHEMA',@level0name='dbo',
                @level1type='TABLE',@level1name='attendance_sessions'`);
        }else if(!state.sessions||!state.roster||!state.revisions||state.checksum!==checksum)throw Error('Attendance sample schema requires review');
        const result=await request().input('code',sql.NVarChar(50),code).query(`
            DECLARE @s int=(SELECT id FROM dbo.schools WHERE code=@code);
            IF @s IS NULL BEGIN
              INSERT dbo.schools(code,name,education_system,status) VALUES(@code,'Attendance practice school','Bilingual','active');SET @s=SCOPE_IDENTITY();
              INSERT dbo.accounts(login_key,password_hash,status) VALUES(@code,'unusable-synthetic','active');DECLARE @a int=SCOPE_IDENTITY();
              INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@s,@a,'active');DECLARE @m int=SCOPE_IDENTITY();
              INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@s,@m,'discipline_master');
              INSERT dbo.academic_years(name,fromYear,toYear,school_id,created_by_account_id) VALUES('2026/2027',2026,2027,@s,@a);DECLARE @y int=SCOPE_IDENTITY();
              INSERT dbo.classes(section,name,rank,school_id) VALUES('Anglophone','Form 1',1,@s);DECLARE @c int=SCOPE_IDENTITY();
              INSERT dbo.students(firstName,lastName,matricule,password,section,sex,school_id)
                VALUES('Ari','Sample','DEMO01','unusable','Anglophone','Male',@s),('Maya','Sample','DEMO02','unusable','Anglophone','Female',@s),
                ('Noel','Sample','DEMO03','unusable','Anglophone','Male',@s);
              INSERT dbo.attendance_sessions(school_id,year_id,class_id,lesson_date,scheduled_periods,source_reference)
                VALUES(@s,@y,@c,'20261104',8,'Synthetic paper register 1'),(@s,@y,@c,'20261105',6,'Synthetic paper register 2');
              INSERT dbo.attendance_roster(school_id,session_id,student_id,pupil_name,matricule)
                SELECT @s,r.id,p.id,CONCAT(p.firstName,' ',p.lastName),p.matricule FROM dbo.attendance_sessions r
                JOIN dbo.students p ON p.school_id=r.school_id WHERE r.school_id=@s;
            END;
            SELECT m.school_id AS schoolId,m.account_id AS accountId,m.id AS membershipId
            FROM dbo.accounts a JOIN dbo.school_memberships m ON m.account_id=a.id
            JOIN dbo.membership_roles r ON r.membership_id=m.id AND r.school_id=m.school_id
            WHERE a.login_key=@code AND a.password_hash='unusable-synthetic' AND m.school_id=@s AND r.role='discipline_master'
                AND NOT EXISTS(SELECT 1 FROM dbo.membership_roles other WHERE other.membership_id=m.id AND other.role<>r.role);`);
        if(result.recordset.length!==1)throw Error('Sample identity mismatch');
        await tx.commit();return result.recordset[0];
    }catch(error){await tx.rollback().catch(()=>{});throw error;}
}
module.exports={prepareAttendanceSample};
