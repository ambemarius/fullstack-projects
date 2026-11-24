// KodoSchool platform console: every school's size and activity (counts and dates only, never pupils' names,
// marks or amounts), suspending or reactivating a school, and the log of console actions.
const { sql, pool, poolConnect } = require('../../config/database');

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

async function defaultQuery(statement, params = {}) {
    await poolConnect;
    const r = pool.request();
    for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
    return r.query(statement);
}

function createPlatformConsoleService({ query = defaultQuery } = {}) {
    async function log(actorId, action, { targetType = null, targetId = null, detail = null, ip = null } = {}) {
        await query(`INSERT INTO platform_audit_log (platform_admin_id, action, target_type, target_id, detail, ip)
            VALUES (@actor, @action, @type, @target, @detail, @ip)`, {
            actor: [sql.Int, actorId], action: [sql.VarChar(40), action], type: [sql.VarChar(40), targetType],
            target: [sql.NVarChar(50), targetId === null ? null : String(targetId)], detail: [sql.NVarChar(500), detail ? String(detail).slice(0, 500) : null],
            ip: [sql.NVarChar(45), ip ? String(ip).slice(0, 45) : null],
        });
    }

    // One line per school. "Last 30 days" counts show whether a school is really using KodoSchool.
    async function schools() {
        const rows = (await query(`
            WITH since AS (SELECT DATEADD(day, -30, SYSUTCDATETIME()) AS d)
            SELECT s.id, s.code, s.name, s.status, s.education_system, s.created_at,
                (SELECT COUNT(*) FROM students x WHERE x.school_id = s.id AND x.isWithdrawn = 0) AS students,
                (SELECT COUNT(*) FROM teachers x WHERE x.school_id = s.id AND x.status = 'active') AS teachers,
                (SELECT COUNT(*) FROM classes x WHERE x.school_id = s.id) AS classes,
                (SELECT COUNT(*) FROM Admins x WHERE x.school_id = s.id AND LOWER(x.role) = 'admin') AS admins,
                (SELECT COUNT(*) FROM subject_scores x, since WHERE x.school_id = s.id AND x.updated_at >= since.d) AS marks_30d,
                (SELECT COUNT(*) FROM attendance_registers x, since WHERE x.school_id = s.id AND x.created_at >= since.d) AS registers_30d,
                (SELECT COUNT(*) FROM finance_payments x, since WHERE x.school_id = s.id AND x.created_at >= since.d) AS payments_30d,
                (SELECT MAX(v) FROM (VALUES
                    ((SELECT MAX(updated_at) FROM subject_scores x WHERE x.school_id = s.id)),
                    ((SELECT MAX(created_at) FROM attendance_registers x WHERE x.school_id = s.id)),
                    ((SELECT MAX(created_at) FROM finance_payments x WHERE x.school_id = s.id)),
                    ((SELECT MAX(occurred_at) FROM library_events x WHERE x.school_id = s.id)),
                    ((SELECT MAX(created_at) FROM lab_requests x WHERE x.school_id = s.id))) AS a(v)) AS last_activity
            FROM schools s ORDER BY s.name`)).recordset;
        const pending = (await query("SELECT COUNT(*) AS n FROM school_signup_requests WHERE status = 'pending'")).recordset[0].n;
        const totals = rows.reduce((t, r) => ({
            schools: t.schools + 1, active: t.active + (r.status === 'active' ? 1 : 0),
            students: t.students + r.students, teachers: t.teachers + r.teachers,
        }), { schools: 0, active: 0, students: 0, teachers: 0 });
        return { schools: rows, totals: { ...totals, pendingSignups: pending } };
    }

    // Suspended schools can no longer sign in (utils/loginSchool.js refuses them).
    async function setStatus(actor, schoolId, status, reason, ip) {
        const id = Number(schoolId);
        if (!Number.isSafeInteger(id) || id < 1) throw fail(422, 'Choose a school.');
        if (!['active', 'suspended'].includes(status)) throw fail(422, 'Choose active or suspended.');
        const why = typeof reason === 'string' ? reason.trim() : '';
        if (status === 'suspended' && why.length < 3) throw fail(422, 'Give the reason for suspending the school.');
        const school = (await query('SELECT id, name, status FROM schools WHERE id = @id', { id: [sql.Int, id] })).recordset[0];
        if (!school) throw fail(404, 'School not found.');
        if (!['active', 'suspended'].includes(school.status)) throw fail(409, `A ${school.status} school cannot be changed here.`);
        if (school.status === status) return { id, status };
        await query('UPDATE schools SET status = @status WHERE id = @id', { status: [sql.VarChar(20), status], id: [sql.Int, id] });
        await log(actor.id, status === 'suspended' ? 'school_suspended' : 'school_reactivated', { targetType: 'school', targetId: id, detail: why || null, ip });
        return { id, status };
    }

    async function audit(limit = 200) {
        const top = Math.min(500, Math.max(1, Number(limit) || 200));
        return (await query(`SELECT TOP (${top}) l.id, l.action, l.target_type, l.target_id, l.detail, l.created_at, p.name AS by_name,
                CASE WHEN l.target_type = 'school' THEN (SELECT name FROM schools WHERE CONVERT(nvarchar(50), id) = l.target_id) END AS school_name
            FROM platform_audit_log l LEFT JOIN platform_admins p ON p.id = l.platform_admin_id ORDER BY l.created_at DESC, l.id DESC`)).recordset;
    }

    return { schools, setStatus, audit, log };
}

module.exports = { createPlatformConsoleService };
