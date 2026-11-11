const fs=require('node:fs'),crypto=require('node:crypto');
const {sql}=require('../config/database');
const {prepareAttendanceSample}=require('./attendanceSample');
const {roles}=require('../model/identity/inventoryService');

async function prepareInventorySample(db,code){
    const school=await prepareAttendanceSample(db,code);
    const ddl=fs.readFileSync(require.resolve('../docs/implementation/staged/015_library_lab.sql'),'utf8');
    const hash=crypto.createHash('sha256').update(ddl.replace(/\r\n/g,'\n')).digest('hex');
    const tx=new sql.Transaction(db.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req=()=>new sql.Request(tx).input('school',sql.Int,school.schoolId);
    try{
        await req().query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='lms-inventory-preview',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
            IF @r<0 THROW 50401,'Practice workspace busy',1;`);
        const state=(await req().query(`SELECT (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') AND name IN
            ('library_copies','library_events','lab_items','lab_requests','lab_movements','inventory_operations')) tables,
            (SELECT CONVERT(varchar(64),value) FROM sys.extended_properties WHERE class=1 AND major_id=OBJECT_ID('dbo.inventory_operations') AND name='LMS_INVENTORY_SAMPLE') checksum`)).recordset[0];
        if(!state.tables){
            await req().query(ddl);
            await req().input('hash',sql.VarChar(64),hash).query("EXEC sys.sp_addextendedproperty @name='LMS_INVENTORY_SAMPLE',@value=@hash,@level0type='SCHEMA',@level0name='dbo',@level1type='TABLE',@level1name='inventory_operations'");
        }else if(state.tables!==6||state.checksum!==hash)throw Error('Practice inventory schema requires review.');
        const accounts={};
        for(const [area,role] of Object.entries(roles)){
            const result=await req().input('login',sql.NVarChar(255),code+'_'+role).input('role',sql.VarChar(30),role).query(`
                IF NOT EXISTS(SELECT 1 FROM dbo.accounts WHERE login_key=@login) BEGIN
                    INSERT dbo.accounts(login_key,password_hash,status) VALUES(@login,'unusable-inventory-sample','active');
                    DECLARE @a int=SCOPE_IDENTITY();INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@a,'active');
                    DECLARE @m int=SCOPE_IDENTITY();INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@m,@role);
                END;
                SELECT a.id accountId,m.id membershipId FROM dbo.accounts a JOIN dbo.school_memberships m ON m.account_id=a.id
                JOIN dbo.membership_roles r ON r.membership_id=m.id AND r.school_id=m.school_id
                WHERE a.login_key=@login AND a.password_hash='unusable-inventory-sample' AND m.school_id=@school AND r.role=@role
                AND NOT EXISTS(SELECT 1 FROM dbo.membership_roles x WHERE x.membership_id=m.id AND x.role<>r.role)`);
            if(result.recordset.length!==1)throw Error('Unexpected practice identity.');
            accounts[area]=result.recordset[0];
        }
        await req().input('actor',sql.Int,accounts.laboratory.membershipId).query(`
            IF NOT EXISTS(SELECT 1 FROM dbo.library_copies WHERE school_id=@school)
                INSERT dbo.library_copies(school_id,title,author,accession,shelf) VALUES
                (@school,'Practical Biology','Sample Science Department','BIO-01','Science A'),(@school,'Practical Biology','Sample Science Department','BIO-02','Science A');
            IF NOT EXISTS(SELECT 1 FROM dbo.lab_items WHERE school_id=@school) BEGIN
                INSERT dbo.lab_items(school_id,name,category,kind,unit,location,batch,minimum,restricted)
                VALUES(@school,'Microscope','Biology','equipment','pieces','Cabinet A','',2,0);
                INSERT dbo.lab_movements(school_id,item_id,action,delta,actor_id) VALUES(@school,SCOPE_IDENTITY(),'receive',4,@actor);
            END;`);
        await tx.commit();return {school,accounts};
    }catch(error){await tx.rollback().catch(()=>{});throw error;}
}
module.exports={prepareInventorySample};
