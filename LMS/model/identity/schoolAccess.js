const crypto=require('node:crypto');
const validId=value=>Number.isSafeInteger(value) && value>0 && value<=2147483647;
const denied=()=>Object.assign(new Error('Access denied'),{ statusCode:403 });

function createSchoolAccess(identityService) {
    const contexts=new WeakMap();
    async function resolve(token) {
        const identity=await identityService.resolveSession(token);
        if (!identity || ![identity.accountId,identity.schoolId,identity.membershipId].every(validId)) throw denied();
        const context=Object.freeze({ accountId:identity.accountId,schoolId:identity.schoolId,membershipId:identity.membershipId });
        contexts.set(context,{ token,tokenHash:crypto.createHash('sha256').update(token).digest('hex') });
        return context;
    }
    async function authorize(context,roles) {
        const stored=context && contexts.get(context);
        if (!stored || !Array.isArray(roles) || !roles.length) throw denied();
        const current=await identityService.resolveSession(stored.token);
        if (!current || current.accountId!==context.accountId || current.schoolId!==context.schoolId ||
            current.membershipId!==context.membershipId || !roles.some(role=>current.roles.includes(role))) throw denied();
        return { ...context,tokenHash:stored.tokenHash,authorizedRole:roles.find(role=>current.roles.includes(role)) };
    }
    return { resolve,authorize };
}

// Rechecked in each data statement as well as the service layer. No pooled SESSION_CONTEXT state.
const authoritySql=`EXISTS (
    SELECT 1 FROM dbo.account_sessions auth_session
    JOIN dbo.accounts auth_account ON auth_account.id=auth_session.account_id
    JOIN dbo.school_memberships auth_member ON auth_member.id=auth_session.active_membership_id AND auth_member.account_id=auth_account.id
    JOIN dbo.schools auth_school ON auth_school.id=auth_member.school_id
    JOIN dbo.membership_roles auth_role ON auth_role.school_id=auth_member.school_id AND auth_role.membership_id=auth_member.id
    WHERE auth_session.token_hash=@session_hash AND auth_session.revoked_at IS NULL AND auth_session.expires_at>SYSUTCDATETIME()
        AND auth_account.id=@account AND auth_account.status='active' AND auth_account.security_version=auth_session.security_version
        AND auth_member.id=@membership AND auth_member.school_id=@school AND auth_member.status='active' AND auth_school.status='active'
        AND auth_role.role IN (@role_one,@role_two)
)`;

module.exports={ createSchoolAccess,authoritySql };
