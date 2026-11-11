const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { sql, pool, connect } = require('../../config/database');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const tokenValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
function denied() { return Object.assign(new Error('Access denied'), { statusCode: 403 }); }
const passwordValid = value => typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value, 'utf8') <= 72;
const loginValid = value => typeof value === 'string' && value.length > 0 && value.length <= 255 && value === value.trim();
const schoolCodeValid = value => typeof value === 'string' && /^[A-Z0-9_-]{2,50}$/.test(value);

// Internal service only. No route uses this until all legacy repositories are scoped.
// Callers must authenticate credentials before creating a session; IDs are never request authority.
function createIdentityService(database = { connect, getPool: () => pool }) {
    const request = async () => { await database.connect(); return database.getPool().request(); };

    async function createSession(accountId, membershipId = null) {
        if (!Number.isSafeInteger(accountId) || accountId <= 0 ||
            (membershipId !== null && (!Number.isSafeInteger(membershipId) || membershipId <= 0))) throw denied();
        const token = crypto.randomBytes(32).toString('base64url');
        const csrfToken = crypto.randomBytes(32).toString('base64url');
        const result = await (await request()).input('account', sql.Int, accountId)
            .input('membership', sql.Int, membershipId).input('token', sql.Char(64), hash(token))
            .input('csrf', sql.Char(64), hash(csrfToken)).query(`
                INSERT dbo.account_sessions(token_hash,account_id,active_membership_id,csrf_hash,security_version,expires_at)
                OUTPUT INSERTED.expires_at
                SELECT @token,a.id,@membership,@csrf,a.security_version,DATEADD(hour,8,SYSUTCDATETIME())
                FROM dbo.accounts a WHERE a.id=@account AND a.status='active' AND (
                    (@membership IS NULL AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=a.id AND g.revoked_at IS NULL)) OR
                    EXISTS(SELECT 1 FROM dbo.school_memberships m JOIN dbo.schools s ON s.id=m.school_id
                        WHERE m.id=@membership AND m.account_id=a.id AND m.status='active' AND s.status='active'
                        AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id))
                );
            `);
        if (result.recordset.length !== 1) throw denied();
        return { token, csrfToken, expiresAt: result.recordset[0].expires_at };
    }

    async function resolveSession(token) {
        if (!tokenValid(token)) return null;
        const result = await (await request()).input('token', sql.Char(64), hash(token)).query(`
            SELECT a.id AS account_id,x.active_membership_id AS membership_id,m.school_id,r.role,g.permission
            FROM dbo.account_sessions x JOIN dbo.accounts a ON a.id=x.account_id
            LEFT JOIN dbo.school_memberships m ON m.id=x.active_membership_id AND m.account_id=a.id
            LEFT JOIN dbo.schools s ON s.id=m.school_id
            LEFT JOIN dbo.membership_roles r ON r.membership_id=m.id AND r.school_id=m.school_id
            LEFT JOIN dbo.platform_role_grants g ON g.account_id=a.id AND g.revoked_at IS NULL
            WHERE x.token_hash=@token AND x.revoked_at IS NULL AND x.expires_at>SYSUTCDATETIME()
                AND a.status='active' AND x.security_version=a.security_version
                AND ((x.active_membership_id IS NULL AND g.permission IS NOT NULL)
                    OR (m.status='active' AND s.status='active' AND r.role IS NOT NULL));
        `);
        if (!result.recordset.length) return null;
        const first = result.recordset[0];
        return Object.freeze({ accountId: first.account_id, membershipId: first.membership_id,
            schoolId: first.school_id ?? null,
            roles: Object.freeze([...new Set(result.recordset.map(row => row.role).filter(Boolean))]),
            platformPermissions: Object.freeze([...new Set(result.recordset.map(row => row.permission).filter(Boolean))]) });
    }

    async function validateCsrf(token, csrfToken) {
        if (!tokenValid(token) || !tokenValid(csrfToken)) return false;
        const result = await (await request()).input('token', sql.Char(64), hash(token))
            .query('SELECT csrf_hash FROM dbo.account_sessions WHERE token_hash=@token AND revoked_at IS NULL AND expires_at>SYSUTCDATETIME()');
        if (!result.recordset.length) return false;
        return crypto.timingSafeEqual(Buffer.from(hash(csrfToken), 'hex'), Buffer.from(result.recordset[0].csrf_hash, 'hex'));
    }

    async function revokeSession(token) {
        if (!tokenValid(token)) return;
        await (await request()).input('token', sql.Char(64), hash(token))
            .query('UPDATE dbo.account_sessions SET revoked_at=SYSUTCDATETIME() WHERE token_hash=@token AND revoked_at IS NULL');
    }

    async function refreshCsrf(token) {
        if (!await resolveSession(token)) throw denied();
        const csrfToken=crypto.randomBytes(32).toString('base64url');
        const result=await (await request()).input('token',sql.Char(64),hash(token)).input('csrf',sql.Char(64),hash(csrfToken))
            .query('UPDATE dbo.account_sessions SET csrf_hash=@csrf WHERE token_hash=@token AND revoked_at IS NULL AND expires_at>SYSUTCDATETIME()');
        if(result.rowsAffected[0]!==1) throw denied();
        return { csrfToken };
    }

    async function memberships(token) {
        if (!await resolveSession(token)) throw denied();
        const rows=(await (await request()).input('token',sql.Char(64),hash(token)).query(`
            SELECT m.id AS membershipId,s.id AS schoolId,s.code,s.name,r.role FROM dbo.account_sessions x
            JOIN dbo.accounts a ON a.id=x.account_id AND a.status='active' AND a.security_version=x.security_version
            JOIN dbo.school_memberships m ON m.account_id=a.id AND m.status='active'
            JOIN dbo.schools s ON s.id=m.school_id AND s.status='active'
            JOIN dbo.membership_roles r ON r.school_id=m.school_id AND r.membership_id=m.id
            WHERE x.token_hash=@token AND x.revoked_at IS NULL AND x.expires_at>SYSUTCDATETIME() ORDER BY s.id,r.role;
        `)).recordset;
        const grouped=new Map();
        for(const row of rows) {
            if(!grouped.has(row.membershipId)) grouped.set(row.membershipId,{ membershipId:row.membershipId,schoolId:row.schoolId,code:row.code,name:row.name,roles:[] });
            grouped.get(row.membershipId).roles.push(row.role);
        }
        return [...grouped.values()];
    }

    async function acceptInvitation(invitationToken, password, requestId) {
        if (!tokenValid(invitationToken) || !passwordValid(password) || typeof requestId !== 'string' ||
            !requestId || requestId.length > 100) throw denied();
        const passwordHash = await bcrypt.hash(password, 12);
        await database.connect();
        const tx = new sql.Transaction(database.getPool());
        await tx.begin();
        try {
            // Lock the single-use invitation and pending school until all provisioning commits.
            const invitation = await new sql.Request(tx).input('hash', sql.Char(64), hash(invitationToken)).query(`
                SELECT i.school_id,i.intended_login_key,i.role FROM dbo.school_invitations i WITH (UPDLOCK,HOLDLOCK)
                JOIN dbo.schools s WITH (UPDLOCK,HOLDLOCK) ON s.id=i.school_id
                JOIN dbo.accounts a WITH (UPDLOCK,HOLDLOCK) ON a.id=i.invited_by
                WHERE i.token_hash=@hash AND i.consumed_at IS NULL AND i.revoked_at IS NULL
                    AND i.expires_at>SYSUTCDATETIME() AND s.status='pending' AND i.role='admin' AND a.status='active'
                    AND i.intended_login_key NOT LIKE N'existing-admin:%'
                    AND i.intended_login_key NOT LIKE N'staff-profile:%' AND i.intended_login_key NOT LIKE N'new-staff:%' AND i.intended_login_key NOT LIKE N'reset-staff:%' AND i.intended_login_key NOT LIKE N'native-staff:%' AND i.intended_login_key NOT LIKE N'new-admin:%' AND i.intended_login_key NOT LIKE N'reset-admin:%'
                    AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WITH (UPDLOCK,HOLDLOCK)
                        WHERE g.account_id=a.id AND g.permission IN ('school_onboarding','platform_operator') AND g.revoked_at IS NULL);
            `);
            if (invitation.recordset.length !== 1) throw denied();
            const row = invitation.recordset[0];
            // Never overwrite or merge an existing account: authenticated existing-account invitations are a separate flow.
            const result = await new sql.Request(tx).input('school', sql.Int, row.school_id)
                .input('login', sql.NVarChar(255), row.intended_login_key).input('password', sql.NVarChar(255), passwordHash)
                .input('hash', sql.Char(64), hash(invitationToken)).input('request', sql.NVarChar(100), requestId).query(`
                    IF EXISTS(SELECT 1 FROM dbo.accounts WITH (UPDLOCK,HOLDLOCK) WHERE login_key=@login)
                        THROW 50002, 'Canonical identity already exists', 1;
                    INSERT dbo.accounts(login_key,password_hash,status) VALUES(@login,@password,'active');
                    DECLARE @account INT=SCOPE_IDENTITY();
                    INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@account,'active');
                    DECLARE @membership INT=SCOPE_IDENTITY();
                    INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@membership,'admin');
                    UPDATE dbo.school_invitations SET consumed_at=SYSUTCDATETIME() WHERE token_hash=@hash;
                    UPDATE dbo.schools SET status='active' WHERE id=@school;
                    INSERT dbo.identity_audit_events(school_id,actor_account_id,actor_membership_id,action,resource_type,resource_id,request_id)
                    VALUES(@school,@account,@membership,'invitation_accepted','school',CONVERT(nvarchar(100),@school),@request);
                    SELECT @account AS account_id,@membership AS membership_id,@school AS school_id;
                `);
            await tx.commit();
            return { accountId: result.recordset[0].account_id, membershipId: result.recordset[0].membership_id, schoolId: row.school_id };
        } catch (err) {
            await tx.rollback().catch(() => {});
            // Duplicate canonical identity is a refusal, never an implicit password reset.
            if ([2601,2627,50002].includes(err.number)) throw denied();
            throw err;
        }
    }

    async function login(loginKey, password, schoolCode = null) {
        if (!loginValid(loginKey) || typeof password !== 'string' || Buffer.byteLength(password,'utf8') > 72 ||
            (schoolCode !== null && !schoolCodeValid(schoolCode))) throw denied();
        const result = await (await request()).input('login', sql.NVarChar(255), loginKey)
            .query("SELECT id,password_hash FROM dbo.accounts WHERE login_key=@login AND status='active'");
        // Use a fixed work factor for missing identities as well; no secret or credential leaves this method.
        const dummyHash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
        const account = result.recordset[0];
        const matches = await bcrypt.compare(password, account?.password_hash || dummyHash);
        if (!account || !matches) throw denied();
        let membership = null;
        if (schoolCode !== null) {
            const selected = await (await request()).input('account', sql.Int, account.id).input('code', sql.NVarChar(50), schoolCode).query(`
                SELECT m.id FROM dbo.school_memberships m JOIN dbo.schools s ON s.id=m.school_id
                WHERE m.account_id=@account AND s.code=@code AND m.status='active' AND s.status='active';
            `);
            if (selected.recordset.length !== 1) throw denied();
            membership = selected.recordset[0].id;
        }
        return createSession(account.id, membership);
    }

    async function switchSchool(token, schoolCode) {
        if (!tokenValid(token) || !schoolCodeValid(schoolCode)) throw denied();
        await database.connect();
        const tx = new sql.Transaction(database.getPool());
        await tx.begin();
        try {
            const tokenHash = hash(token);
            const freshToken = crypto.randomBytes(32).toString('base64url');
            const csrfToken = crypto.randomBytes(32).toString('base64url');
            const result = await new sql.Request(tx).input('old',sql.Char(64),tokenHash)
                .input('code',sql.NVarChar(50),schoolCode).input('fresh',sql.Char(64),hash(freshToken))
                .input('csrf',sql.Char(64),hash(csrfToken)).query(`
                    DECLARE @account INT,@version INT,@expiry DATETIME2,@membership INT;
                    SELECT @account=a.id,@version=a.security_version,@expiry=x.expires_at
                    FROM dbo.account_sessions x WITH (UPDLOCK,HOLDLOCK)
                    JOIN dbo.accounts a WITH (UPDLOCK,HOLDLOCK) ON a.id=x.account_id
                    LEFT JOIN dbo.school_memberships old_m WITH (UPDLOCK,HOLDLOCK) ON old_m.id=x.active_membership_id AND old_m.account_id=a.id
                    LEFT JOIN dbo.schools old_s WITH (UPDLOCK,HOLDLOCK) ON old_s.id=old_m.school_id
                    WHERE x.token_hash=@old AND x.revoked_at IS NULL AND x.expires_at>SYSUTCDATETIME()
                        AND x.security_version=a.security_version AND a.status='active'
                        AND ((x.active_membership_id IS NULL AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g
                            WHERE g.account_id=a.id AND g.revoked_at IS NULL))
                            OR (old_m.status='active' AND old_s.status='active' AND EXISTS(SELECT 1 FROM dbo.membership_roles r
                                WHERE r.school_id=old_m.school_id AND r.membership_id=old_m.id)));
                    SELECT @membership=m.id FROM dbo.school_memberships m WITH (UPDLOCK,HOLDLOCK)
                    JOIN dbo.schools s WITH (UPDLOCK,HOLDLOCK) ON s.id=m.school_id
                    WHERE m.account_id=@account AND m.status='active' AND s.status='active' AND s.code=@code
                        AND EXISTS(SELECT 1 FROM dbo.membership_roles r WHERE r.school_id=m.school_id AND r.membership_id=m.id);
                    IF @membership IS NOT NULL BEGIN
                        INSERT dbo.account_sessions(token_hash,account_id,active_membership_id,csrf_hash,security_version,expires_at)
                        VALUES(@fresh,@account,@membership,@csrf,@version,@expiry);
                        UPDATE dbo.account_sessions SET revoked_at=SYSUTCDATETIME() WHERE token_hash=@old;
                        SELECT @expiry AS expires_at;
                    END;
                `);
            if (!result.recordset?.length) throw denied();
            await tx.commit();
            return { token:freshToken,csrfToken,expiresAt:result.recordset[0].expires_at };
        } catch (err) { await tx.rollback().catch(() => {}); throw err; }
    }

    async function loginSchoolIdentity(schoolCode,accountType,identifier,password) {
        const sources={ admin:['Admins','email'],teacher:['teachers','email'],student:['students','matricule'] };
        if (!schoolCodeValid(schoolCode) || !Object.hasOwn(sources,accountType) || !loginValid(identifier) ||
            typeof password!=='string' || Buffer.byteLength(password,'utf8')>72) throw denied();
        const [table,column]=sources[accountType];
        const row=(await (await request()).input('code',sql.NVarChar(50),schoolCode)
            .input('identifier',sql.NVarChar(255),identifier).input('source',sql.VarChar(20),table).query(`
                SELECT a.id,a.password_hash,m.id AS membership_id FROM dbo.schools s
                JOIN dbo.[${table}] p ON p.school_id=s.id AND p.[${column}]=@identifier
                JOIN dbo.legacy_account_map l ON l.source_table=@source AND l.legacy_id=p.id AND l.school_id=s.id AND l.reconciliation_status='verified'
                JOIN dbo.accounts a ON a.id=l.account_id AND a.status='active'
                JOIN dbo.school_memberships m ON m.school_id=s.id AND m.id=l.membership_id AND m.account_id=a.id AND m.status='active'
                WHERE s.code=@code AND s.status='active';
            `)).recordset;
        const dummyHash='$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
        const matches=await bcrypt.compare(password,row[0]?.password_hash || dummyHash);
        if (row.length!==1 || !matches) throw denied();
        return createSession(row[0].id,row[0].membership_id);
    }

    async function inviteSchool(token, { code, name, educationSystem, intendedLoginKey, requestId }) {
        if (!tokenValid(token) || typeof code !== 'string' || !/^[A-Z0-9_-]{2,50}$/.test(code) ||
            typeof name !== 'string' || !name.trim() || name.length > 200 ||
            !['Anglophone','Francophone','Bilingual'].includes(educationSystem) ||
            !loginValid(intendedLoginKey) || /^(existing-admin|staff-profile|new-staff|reset-staff|native-staff|new-admin|reset-admin):/i.test(intendedLoginKey) ||
            typeof requestId !== 'string' || !requestId || requestId.length > 100) throw denied();
        await database.connect();
        const tx = new sql.Transaction(database.getPool());
        await tx.begin();
        try {
            // Recheck authority within the write transaction; a school role never confers this grant.
            const auth = await new sql.Request(tx).input('token', sql.Char(64), hash(token)).query(`
                SELECT a.id FROM dbo.account_sessions x WITH (UPDLOCK,HOLDLOCK)
                JOIN dbo.accounts a WITH (UPDLOCK,HOLDLOCK) ON a.id=x.account_id
                JOIN dbo.platform_role_grants g WITH (UPDLOCK,HOLDLOCK) ON g.account_id=a.id
                WHERE x.token_hash=@token AND x.revoked_at IS NULL AND x.expires_at>SYSUTCDATETIME()
                    AND a.status='active' AND x.security_version=a.security_version
                    AND g.permission IN ('school_onboarding','platform_operator') AND g.revoked_at IS NULL;
            `);
            if (!auth.recordset.length) throw denied();
            const actor = auth.recordset[0].id;
            const invitationToken = crypto.randomBytes(32).toString('base64url');
            const result = await new sql.Request(tx).input('code', sql.NVarChar(50), code)
                .input('name', sql.NVarChar(200), name.trim()).input('system', sql.VarChar(20), educationSystem)
                .input('actor', sql.Int, actor).input('login', sql.NVarChar(255), intendedLoginKey)
                .input('hash', sql.Char(64), hash(invitationToken)).input('request', sql.NVarChar(100), requestId).query(`
                    INSERT dbo.schools(code,name,education_system) VALUES(@code,@name,@system);
                    DECLARE @school INT=SCOPE_IDENTITY();
                    INSERT dbo.school_invitations(token_hash,school_id,invited_by,intended_login_key,role,expires_at)
                    VALUES(@hash,@school,@actor,@login,'admin',DATEADD(day,2,SYSUTCDATETIME()));
                    INSERT dbo.identity_audit_events(school_id,actor_account_id,action,resource_type,resource_id,request_id)
                    VALUES(@school,@actor,'school_invited','school',CONVERT(nvarchar(100),@school),@request);
                    SELECT @school AS school_id;
                `);
            await tx.commit();
            return { schoolId: result.recordset[0].school_id, invitationToken };
        } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
        }
    }

    return { createSession, resolveSession, validateCsrf, revokeSession, inviteSchool, acceptInvitation, login, switchSchool,loginSchoolIdentity,refreshCsrf,memberships };
}

module.exports = { createIdentityService };
