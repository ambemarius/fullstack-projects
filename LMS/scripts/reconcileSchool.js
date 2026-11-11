const crypto = require('node:crypto');
const { sql } = require('../config/database');
const { assertSyntheticDatabase } = require('./testEnvironment');
const { teacherStatus } = require('../migrations/legacyPolicy');
const {isLegacyAdministrator}=require('../utils/legacyAccountRole');

// Parent-first order from the actual baseline schema. Geography is explicitly global.
const OWNED = Object.freeze(['Admins','teachers','classes','subjects','academic_years','students','student_fees',
    'auxiliary_staff','class_subjects','class_subject_teachers','class_subject_students','academic_year_students',
    'academic_year_teachers','exams','questions','exam_results','time_slots','subject_allocations','subject_scores','timetables']);
const ROLES = Object.freeze({ Admins:'admin',teachers:'teacher',students:'student' });
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
function refuse(reason) { throw new Error(`Reconciliation refused: ${reason}`); }
function canonicalKey(table,id) {
    if (!Object.hasOwn(ROLES,table) || !positive(id)) refuse('invalid legacy identity');
    return `legacy:${table}:${id}`;
}
function accountState(table,row) {
    if (!Object.hasOwn(ROLES,table)) return null;
    if (table==='Admins'?!isLegacyAdministrator(row.role):row.role !== ROLES[table]) refuse('unexpected legacy role');
    if (typeof row.password !== 'string' || !/^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(row.password)) refuse('unsupported credential hash');
    const cost=Number(row.password.slice(4,6));
    if (cost<4 || cost>15) refuse('unsupported credential work factor');
    let active=true;
    if (table==='teachers') {
        const state=teacherStatus(row);
        if (state.needsReview) refuse('teacher status needs review');
        active=state.status==='active';
    }
    if (table==='students') {
        if (![true,false,0,1].includes(row.isWithdrawn)) refuse('student status needs review');
        active=row.isWithdrawn===false || row.isWithdrawn===0;
    }
    return { role:ROLES[table],account:active?'active':'disabled',membership:active?'active':'revoked' };
}
function normalise(input) {
    if (!input || !positive(input.schoolId) || !positive(input.actorAccountId) ||
        typeof input.attestationRef!=='string' || !/^[A-Za-z0-9:._/-]{1,100}$/.test(input.attestationRef) ||
        !Array.isArray(input.records) || !input.records.length || input.records.length>1000) refuse('invalid explicit scope');
    const seen=new Set();
    const records=input.records.map(item=>{
        if (!item || !OWNED.includes(item.table) || !positive(item.id)) refuse('invalid record selector');
        const key=`${item.table}:${item.id}`;
        if (seen.has(key)) refuse('duplicate record selector');
        seen.add(key);
        return { table:item.table,id:item.id };
    }).sort((a,b)=>OWNED.indexOf(a.table)-OWNED.indexOf(b.table) || a.id-b.id);
    return { version:1,schoolId:input.schoolId,actorAccountId:input.actorAccountId,attestationRef:input.attestationRef,records };
}

function createReconciler(database) {
    async function authority(request,scope) {
        const result=await request().input('school',sql.Int,scope.schoolId).input('actor',sql.Int,scope.actorAccountId).query(`
            SELECT s.id FROM dbo.schools s JOIN dbo.accounts a ON a.id=@actor
            WHERE s.id=@school AND s.status='active' AND a.status='active'
                AND EXISTS(SELECT 1 FROM dbo.platform_role_grants g WHERE g.account_id=a.id
                    AND g.permission IN ('platform_operator','school_onboarding') AND g.revoked_at IS NULL);
        `);
        if (result.recordset.length!==1) refuse('school or operator not authorised');
    }
    async function inspect(request,scope) {
        await authority(request,scope);
        const history=(await request().query('SELECT version,checksum FROM dbo.schema_migrations ORDER BY version')).recordset;
        const relations=(await request().query(`
            SELECT child.name AS child_table,parent.name AS parent_table,c.name AS child_column
            FROM sys.foreign_keys fk JOIN sys.tables child ON child.object_id=fk.parent_object_id
            JOIN sys.tables parent ON parent.object_id=fk.referenced_object_id
            JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id
            JOIN sys.columns c ON c.object_id=child.object_id AND c.column_id=fkc.parent_column_id
            WHERE child.schema_id=SCHEMA_ID('dbo') AND parent.schema_id=SCHEMA_ID('dbo')
                AND fk.name NOT LIKE 'TENANT[_]%'
                AND (SELECT COUNT(*) FROM sys.foreign_key_columns f WHERE f.constraint_object_id=fk.object_id)=1;
        `)).recordset.filter(row=>OWNED.includes(row.child_table) && OWNED.includes(row.parent_table));
        const selected=new Set(scope.records.map(row=>`${row.table}:${row.id}`));
        const records=[];
        for (const selector of scope.records) {
            const links=relations.filter(row=>row.child_table===selector.table).sort((a,b)=>a.child_column.localeCompare(b.child_column));
            const fields=['id','school_id',...links.map(row=>row.child_column)];
            if (Object.hasOwn(ROLES,selector.table)) fields.push('password','role',...(selector.table==='teachers'?['status']:selector.table==='students'?['isWithdrawn']:[]));
            // Identifiers originate only in the allowlist and SQL metadata, never caller SQL.
            const quote=value=>`[${value.replaceAll(']',']]')}]`;
            const row=(await request().input('id',sql.Int,selector.id).query(`SELECT ${[...new Set(fields)].map(quote).join(',')} FROM dbo.${quote(selector.table)} WHERE id=@id`)).recordset[0];
            if (!row) refuse('selected source row missing');
            if (row.school_id!==null && row.school_id!==scope.schoolId) refuse('source already belongs to another school');
            for (const link of links) {
                const parentId=row[link.child_column];
                if (parentId===null) continue;
                const parent=(await request().input('id',sql.Int,parentId).query(`SELECT school_id FROM dbo.${quote(link.parent_table)} WHERE id=@id`)).recordset[0];
                if (!parent || (parent.school_id!==null && parent.school_id!==scope.schoolId)) refuse('parent school conflict');
                if (parent.school_id===null && !selected.has(`${link.parent_table}:${parentId}`)) refuse('unresolved parent outside explicit scope');
            }
            records.push({ ...selector,fingerprint:digest(row),state:accountState(selector.table,row) });
        }
        return { ...scope,schemaFingerprint:digest(history),records };
    }
    async function plan(input) {
        await assertSyntheticDatabase(database);
        const scope=normalise(input);
        const result=await inspect(()=>database.getPool().request(),scope);
        return { ...result,planHash:digest(result) };
    }
    async function apply(planValue,{ dryRun=false }={}) {
        await assertSyntheticDatabase(database);
        const scope=normalise(planValue);
        const signed={ ...scope,schemaFingerprint:planValue.schemaFingerprint,records:planValue.records };
        if (planValue.version!==1 || digest(signed)!==planValue.planHash) refuse('plan checksum mismatch');
        const tx=new sql.Transaction(database.getPool());
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request=()=>new sql.Request(tx);
        try {
            const lock=await request().query(`DECLARE @result INT;
                EXEC @result=sys.sp_getapplock @Resource=N'lms-school-reconciliation',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
                SELECT @result AS result;`);
            if (lock.recordset[0].result<0) refuse('reconciliation lock unavailable');
            await authority(request,scope);
            const prior=(await request().input('hash',sql.Char(64),planValue.planHash)
                .query('SELECT id,record_count,mapped_account_count FROM dbo.ownership_reconciliation_runs WHERE plan_hash=@hash')).recordset[0];
            if (prior) {
                await tx.rollback();
                return { alreadyApplied:true,runId:prior.id.toLowerCase(),recordCount:prior.record_count,mappedAccountCount:prior.mapped_account_count };
            }
            const fresh=await inspect(request,scope);
            if (digest(fresh)!==planValue.planHash) refuse('source or schema changed since planning');
            const runId=crypto.randomUUID();
            let mapped=0;
            // Assign all selected ownership parent-first; mapping and audit remain in this transaction.
            for (const record of fresh.records) {
                await request().input('school',sql.Int,scope.schoolId).input('id',sql.Int,record.id)
                    .query(`UPDATE dbo.[${record.table}] SET school_id=@school WHERE id=@id AND (school_id IS NULL OR school_id=@school)`);
                if (!record.state) continue;
                const existing=(await request().input('table',sql.VarChar(20),record.table).input('id',sql.Int,record.id).query(`
                    SELECT l.school_id,l.account_id,l.membership_id,l.reconciliation_status,a.login_key,a.status AS account_status,m.status AS membership_status,
                        CASE WHEN a.password_hash=source.password THEN 1 ELSE 0 END AS credential_matches
                    FROM dbo.legacy_account_map l JOIN dbo.accounts a ON a.id=l.account_id
                    JOIN dbo.school_memberships m ON m.school_id=l.school_id AND m.id=l.membership_id AND m.account_id=l.account_id
                    JOIN dbo.[${record.table}] source ON source.id=l.legacy_id
                    WHERE l.source_table=@table AND l.legacy_id=@id;
                `)).recordset[0];
                const loginKey=canonicalKey(record.table,record.id);
                if (existing) {
                    if (existing.school_id!==scope.schoolId || existing.login_key!==loginKey || existing.reconciliation_status!=='verified' ||
                        existing.account_status!==record.state.account || existing.membership_status!==record.state.membership || !existing.credential_matches) refuse('existing mapping needs reconciliation');
                    const role=(await request().input('school',sql.Int,scope.schoolId).input('membership',sql.Int,existing.membership_id)
                        .input('role',sql.VarChar(30),record.state.role).query('SELECT role FROM dbo.membership_roles WHERE school_id=@school AND membership_id=@membership AND role=@role')).recordset;
                    if (role.length!==1) refuse('existing mapping role missing');
                    continue;
                }
                await request().input('school',sql.Int,scope.schoolId).input('id',sql.Int,record.id)
                    .input('login',sql.NVarChar(255),loginKey).input('accountStatus',sql.VarChar(20),record.state.account)
                    .input('membershipStatus',sql.VarChar(20),record.state.membership).input('role',sql.VarChar(30),record.state.role)
                    .input('table',sql.VarChar(20),record.table).query(`
                        IF EXISTS(SELECT 1 FROM dbo.accounts WHERE login_key=@login) THROW 50003,'Canonical mapping conflict',1;
                        INSERT dbo.accounts(login_key,password_hash,status) SELECT @login,password,@accountStatus FROM dbo.[${record.table}] WHERE id=@id;
                        DECLARE @account INT=SCOPE_IDENTITY();
                        INSERT dbo.school_memberships(school_id,account_id,status) VALUES(@school,@account,@membershipStatus);
                        DECLARE @membership INT=SCOPE_IDENTITY();
                        INSERT dbo.membership_roles(school_id,membership_id,role) VALUES(@school,@membership,@role);
                        INSERT dbo.legacy_account_map(source_table,legacy_id,account_id,school_id,membership_id,reconciliation_status)
                        VALUES(@table,@id,@account,@school,@membership,'verified');
                    `);
                mapped++;
            }
            await request().input('run',sql.UniqueIdentifier,runId).input('school',sql.Int,scope.schoolId)
                .input('actor',sql.Int,scope.actorAccountId).input('ref',sql.NVarChar(100),scope.attestationRef)
                .input('hash',sql.Char(64),planValue.planHash).input('count',sql.Int,fresh.records.length).input('mapped',sql.Int,mapped).query(`
                    INSERT dbo.ownership_reconciliation_runs(id,school_id,actor_account_id,attestation_ref,plan_hash,record_count,mapped_account_count)
                    VALUES(@run,@school,@actor,@ref,@hash,@count,@mapped);
                    INSERT dbo.identity_audit_events(school_id,actor_account_id,action,resource_type,resource_id,request_id)
                    VALUES(@school,@actor,'ownership_reconciled','reconciliation',CONVERT(nvarchar(100),@run),CONVERT(nvarchar(100),@run));
                `);
            for (const record of fresh.records) await request().input('run',sql.UniqueIdentifier,runId).input('school',sql.Int,scope.schoolId)
                .input('table',sql.VarChar(40),record.table).input('id',sql.Int,record.id).input('fingerprint',sql.Char(64),record.fingerprint)
                .query('INSERT dbo.ownership_reconciliation_items(school_id,run_id,source_table,legacy_id,source_fingerprint) VALUES(@school,@run,@table,@id,@fingerprint)');
            if (dryRun) await tx.rollback(); else await tx.commit();
            return { alreadyApplied:false,dryRun,runId:dryRun?null:runId,recordCount:fresh.records.length,mappedAccountCount:mapped };
        } catch (err) {
            await tx.rollback().catch(()=>{});
            if (err.message.startsWith('Reconciliation refused:')) throw err;
            refuse('transaction failed; no changes committed');
        }
    }
    return { plan,apply };
}

// Intentionally a library, not a general-purpose production CLI. Only approved synthetic targets pass its guard.
module.exports={ createReconciler,canonicalKey,accountState,normalise,OWNED };
