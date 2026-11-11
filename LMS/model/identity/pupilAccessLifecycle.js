const { sql } = require('../../config/database');
const { authoritySql } = require('./schoolAccess');
const conflict = message => Object.assign(new Error(message), {statusCode:409});

async function loadPupil(request, studentId, placement, profileVersion, returning) {
    const rows = (await request().input('student',sql.Int,studentId).query(`
        SELECT s.id,s.section,s.profile_version,s.currentClassLevel,s.academicYearId,s.isWithdrawn,z.timezone,
            m.id AS memberId,m.status AS memberStatus,a.id AS accountId,a.security_version AS accountVersion
        FROM dbo.students s WITH(UPDLOCK) JOIN dbo.schools z ON z.id=s.school_id
        JOIN dbo.legacy_account_map l ON l.school_id=s.school_id AND l.legacy_id=s.id AND l.source_table='students' AND l.reconciliation_status='verified'
        JOIN dbo.school_memberships m WITH(UPDLOCK) ON m.school_id=s.school_id AND m.id=l.membership_id AND m.account_id=l.account_id
        JOIN dbo.accounts a ON a.id=m.account_id AND a.status='active' AND a.password_hash COLLATE Latin1_General_100_BIN2=s.password COLLATE Latin1_General_100_BIN2
        JOIN dbo.academic_year_students y ON y.school_id=s.school_id AND y.student_id=s.id AND y.academic_year_id=s.academicYearId
        WHERE s.school_id=@school AND s.id=@student AND s.role='student' AND m.id<>@membership
            AND EXISTS(SELECT 1 FROM dbo.membership_roles WHERE membership_id=m.id AND school_id=@school AND role='student')
            AND NOT EXISTS(SELECT 1 FROM dbo.membership_roles WHERE membership_id=m.id AND school_id=@school AND role<>'student')
            AND NOT EXISTS(SELECT 1 FROM dbo.platform_role_grants WHERE account_id=a.id AND revoked_at IS NULL)
            AND ${authoritySql}`)).recordset;
    const pupil = rows[0];
    if (rows.length !== 1 || pupil.profile_version !== profileVersion || Boolean(pupil.isWithdrawn) !== returning ||
        pupil.currentClassLevel !== placement.classId || pupil.academicYearId !== placement.yearId ||
        pupil.memberStatus !== (returning ? 'revoked' : 'active')) throw conflict('Current placement and pupil membership require review');
    return pupil;
}

async function applyChange(request, pupil, source, entry, input, returning, operationId) {
    const membership = request().input('member',sql.Int,pupil.memberId).input('owner',sql.Int,pupil.accountId)
        .input('accountVersion',sql.Int,pupil.accountVersion).input('root',sql.Int,source.id);
    if (returning) {
        const restored = (await membership.input('revision',sql.Int,source.version).query(`
            UPDATE m SET status='active' OUTPUT INSERTED.id
            FROM dbo.school_memberships m JOIN dbo.pupil_withdrawal_access w ON w.school_id=m.school_id AND w.membership_id=m.id AND w.account_id=m.account_id
            WHERE m.school_id=@school AND m.id=@member AND m.account_id=@owner AND m.status='revoked'
                AND w.enrolment_id=@root AND w.revision=@revision AND w.account_version=@accountVersion
                AND m.pupil_access_stamp=w.revoked_stamp AND ${authoritySql}`)).recordset;
        if (restored.length !== 1) throw conflict('The withdrawal no longer authorizes this membership to return');
    } else {
        const stamp = (await membership.query(`
            UPDATE dbo.school_memberships SET status='revoked' OUTPUT INSERTED.pupil_access_stamp AS stamp
            WHERE school_id=@school AND id=@member AND account_id=@owner AND status='active' AND ${authoritySql}`)).recordset[0];
        if (!stamp) throw conflict('Pupil membership has changed');
        await request().input('member',sql.Int,pupil.memberId).input('owner',sql.Int,pupil.accountId).input('version',sql.Int,pupil.accountVersion)
            .input('stamp',sql.Binary(8),stamp.stamp).input('root',sql.Int,entry.id).input('revision',sql.Int,entry.version).query(`
            INSERT dbo.pupil_withdrawal_access(school_id,enrolment_id,revision,membership_id,account_id,account_version,revoked_stamp)
            SELECT @school,@root,@revision,@member,@owner,@version,@stamp WHERE ${authoritySql};
            IF @@ROWCOUNT<>1 THROW 50115,'Access evidence not recorded',1;`);
    }
    const change = await request().input('student',sql.Int,pupil.id).input('member',sql.Int,pupil.memberId).input('owner',sql.Int,pupil.accountId)
        .input('withdrawn',sql.Bit,!returning).input('version',sql.Int,input.profileVersion)
        .input('class',sql.Int,returning ? input.classId : source.classId).input('year',sql.Int,returning ? input.yearId : source.yearId).query(`
        UPDATE dbo.students SET isWithdrawn=@withdrawn,currentClassLevel=@class,academicYearId=@year,profile_version=profile_version+1
        OUTPUT INSERTED.id WHERE school_id=@school AND id=@student AND profile_version=@version AND ${authoritySql};
        UPDATE dbo.account_sessions SET revoked_at=SYSUTCDATETIME() WHERE account_id=@owner AND active_membership_id=@member AND revoked_at IS NULL AND ${authoritySql};
        IF @withdrawn=0 AND NOT EXISTS(SELECT 1 FROM dbo.academic_year_students WHERE school_id=@school AND student_id=@student AND academic_year_id=@year)
            INSERT dbo.academic_year_students(school_id,student_id,academic_year_id) SELECT @school,@student,@year WHERE ${authoritySql};`);
    if (change.recordset.length !== 1) throw conflict('Pupil has changed');
    await request().input('student',sql.NVarChar(100),String(pupil.id)).input('operation',sql.NVarChar(100),operationId)
        .input('action',sql.VarChar(60),returning ? 'pupil_returned' : 'pupil_withdrawn').input('before',sql.Int,input.profileVersion)
        .query(`INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id,
                resource_version_before,resource_version_after,changed_fields)
            SELECT @school,@account,@membership,@action,'student',@student,@operation,@before,@before+1,'isWithdrawn,placement,membership' WHERE ${authoritySql};
            IF @@ROWCOUNT<>1 THROW 50115,'Pupil status authority lost',1;`);
}
module.exports = { loadPupil, applyChange };
