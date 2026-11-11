const { sql,pool,connect }=require('../../config/database');
const { authoritySql }=require('./schoolAccess');
const denied=()=>Object.assign(new Error('Access denied'),{ statusCode:403 });
function createPersonnelRepository(access,database={ connect,getPool:()=>pool }) {
    async function request(context,roles) {
        const identity=await access.authorize(context,roles);
        await database.connect();
        return database.getPool().request().input('school',sql.Int,identity.schoolId).input('account',sql.Int,identity.accountId)
            .input('membership',sql.Int,identity.membershipId).input('session_hash',sql.Char(64),identity.tokenHash)
            .input('role_one',sql.VarChar(30),roles[0]).input('role_two',sql.VarChar(30),roles[1] || null);
    }
    async function listStudents(context,{ search='',limit=50,offset=0 }={}) {
        if (typeof search!=='string' || search.length>100 || !Number.isInteger(limit) || limit<1 || limit>100 ||
            !Number.isInteger(offset) || offset<0 || offset>1000000) throw denied();
        const result=await (await request(context,['admin'])).input('search',sql.NVarChar(100),search)
            .input('limit',sql.Int,limit).input('offset',sql.Int,offset).query(`
                SELECT s.id,s.firstName,s.middleName,s.lastName,s.matricule,s.section,s.isWithdrawn,s.profile_version AS version
                FROM dbo.students s WHERE s.school_id=@school AND ${authoritySql}
                    AND (@search=N'' OR s.firstName LIKE N'%'+@search+N'%' OR s.lastName LIKE N'%'+@search+N'%' OR s.matricule LIKE N'%'+@search+N'%')
                ORDER BY s.id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
                SELECT COUNT(*) AS total FROM dbo.students s WHERE s.school_id=@school AND ${authoritySql}
                    AND (@search=N'' OR s.firstName LIKE N'%'+@search+N'%' OR s.lastName LIKE N'%'+@search+N'%' OR s.matricule LIKE N'%'+@search+N'%');
            `);
        return { data:result.recordsets[0],total:result.recordsets[1][0].total };
    }
    async function getStudent(context,id) {
        if (!Number.isSafeInteger(id) || id<1 || id>2147483647) throw denied();
        const result=await (await request(context,['admin','student'])).input('id',sql.Int,id).query(`
            SELECT s.id,s.firstName,s.middleName,s.lastName,s.matricule,s.section,s.sex,s.isWithdrawn,s.profile_version AS version
            FROM dbo.students s WHERE s.id=@id AND s.school_id=@school AND ${authoritySql}
                AND (EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=@school AND r.membership_id=@membership AND r.role='admin')
                    OR EXISTS(SELECT 1 FROM dbo.legacy_account_map l WHERE l.school_id=@school AND l.membership_id=@membership
                        AND l.account_id=@account AND l.source_table='students' AND l.legacy_id=s.id AND l.reconciliation_status='verified'));
        `);
        return result.recordset[0] || null;
    }
    async function getTeacher(context,id) {
        if (!Number.isSafeInteger(id) || id<1 || id>2147483647) throw denied();
        const result=await (await request(context,['admin','teacher'])).input('id',sql.Int,id).query(`
            SELECT t.id,t.firstName,t.middleName,t.lastName,t.email,t.phone,t.employmentType,t.matriculeFile,t.section,t.status,t.profile_version AS version
            FROM dbo.teachers t WHERE t.id=@id AND t.school_id=@school AND ${authoritySql}
                AND (EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=@school AND r.membership_id=@membership AND r.role='admin')
                    OR EXISTS(SELECT 1 FROM dbo.legacy_account_map l WHERE l.school_id=@school AND l.membership_id=@membership
                        AND l.account_id=@account AND l.source_table='teachers' AND l.legacy_id=t.id AND l.reconciliation_status='verified'));
        `);
        return result.recordset[0] || null;
    }
    async function listTeachers(context,{ search='',limit=50,offset=0 }={}) {
        if (typeof search!=='string' || search.length>100 || !Number.isInteger(limit) || limit<1 || limit>100 ||
            !Number.isInteger(offset) || offset<0 || offset>1000000) throw denied();
        const result=await (await request(context,['admin'])).input('search',sql.NVarChar(100),search)
            .input('limit',sql.Int,limit).input('offset',sql.Int,offset).query(`
                SELECT t.id,t.firstName,t.middleName,t.lastName,t.email,t.employmentType,t.section,t.status,t.profile_version AS version
                FROM dbo.teachers t WHERE t.school_id=@school AND ${authoritySql}
                    AND (@search=N'' OR t.firstName LIKE N'%'+@search+N'%' OR t.lastName LIKE N'%'+@search+N'%' OR t.email LIKE N'%'+@search+N'%')
                ORDER BY t.id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
                SELECT COUNT(*) AS total FROM dbo.teachers t WHERE t.school_id=@school AND ${authoritySql}
                    AND (@search=N'' OR t.firstName LIKE N'%'+@search+N'%' OR t.lastName LIKE N'%'+@search+N'%' OR t.email LIKE N'%'+@search+N'%');
            `);
        return { data:result.recordsets[0],total:result.recordsets[1][0].total };
    }
    async function editProfile(context,kind,id) {
        if(!['student','teacher'].includes(kind)||!Number.isSafeInteger(id)||id<1||id>2147483647)throw denied();
        const table=kind==='student'?'students':'teachers';
        const fields=kind==='student'?`firstName,middleName,lastName,matricule,section,sex,dateOfBirth,placeOfBirth,regionOfOrigin,division,address,
            parentName,parentPhone,parentPhone2,academicYearId,currentClassLevel,isWithdrawn`:
            `firstName,middleName,lastName,email,phone,section,employmentType,matriculeFile,address,idCardNo,dateOfIssue,gender,civilStatus,
            noOfChildren,telephone,secondaryContactName,secondaryContactPhone,status`;
        return(await(await request(context,['admin'])).input('id',sql.Int,id).query(`SELECT id,${fields},profile_version AS version FROM dbo.[${table}]
            WHERE id=@id AND school_id=@school AND ${authoritySql}`)).recordset[0]||null;
    }
    return { listStudents,listTeachers,getStudent,getTeacher,editProfile };
}
module.exports={ createPersonnelRepository };
