const { sql, pool, poolConnect } = require('../../config/database');

const DUTIES = {
    bursar: 'Bursar',
    librarian: 'Librarian',
    lab_attendant: 'Laboratory attendant',
    discipline_master: 'Discipline master',
    head_of_department: 'Head of Department',
};
const SECTIONS = ['Anglophone', 'Francophone'];
const STAFF_TYPES = ['admin', 'teacher', 'auxiliary'];

const conflict = message => Object.assign(new Error(message), { statusCode: 409 });
const notFound = message => Object.assign(new Error(message), { statusCode: 404 });

const PERSON_SQL = `
    CASE d.staff_type WHEN 'teacher' THEN t.name WHEN 'auxiliary' THEN x.name ELSE a.name END AS staffName,
    CASE d.staff_type WHEN 'teacher' THEN t.email WHEN 'auxiliary' THEN x.email ELSE a.email END AS staffEmail`;
const PERSON_JOINS = `
    LEFT JOIN teachers t ON d.staff_type = 'teacher' AND t.id = d.staff_id
    LEFT JOIN auxiliary_staff x ON d.staff_type = 'auxiliary' AND x.id = d.staff_id
    LEFT JOIN Admins a ON d.staff_type = 'admin' AND a.id = d.staff_id`;

const StaffDutyModel = {
    DUTIES,
    STAFF_TYPES,
    SECTIONS,

    // The department (subject + section) of a head of department: { dutyId, subjectId, subjectName, section } or null.
    async department(staffType, staffId) {
        await poolConnect;
        try {
            const result = await pool.request()
                .input('type', sql.NVarChar(20), staffType)
                .input('id', sql.Int, staffId)
                .query(`SELECT TOP 1 d.id AS dutyId, dd.subject_id AS subjectId, s.name AS subjectName, dd.section
                        FROM staff_duties d JOIN staff_duty_departments dd ON dd.duty_id = d.id JOIN subjects s ON s.id = dd.subject_id
                        WHERE d.staff_type = @type AND d.staff_id = @id AND d.duty = 'head_of_department' AND d.revoked_at IS NULL`);
            return result.recordset[0] || null;
        } catch (err) {
            if (err.number === 208) return null; // migration 019 not applied yet
            throw err;
        }
    },

    // Departments of every active head-of-department duty: Map dutyId -> { subjectId, subjectName, section }.
    async departmentsByDuty() {
        await poolConnect;
        try {
            const result = await pool.request().query(`
                SELECT dd.duty_id, dd.subject_id AS subjectId, s.name AS subjectName, dd.section
                FROM staff_duty_departments dd JOIN subjects s ON s.id = dd.subject_id
                JOIN staff_duties d ON d.id = dd.duty_id AND d.revoked_at IS NULL`);
            return new Map(result.recordset.map(r => [r.duty_id, { subjectId: r.subjectId, subjectName: r.subjectName, section: r.section }]));
        } catch (err) {
            if (err.number === 208) return new Map();
            throw err;
        }
    },

    // Set the subject and section of a head-of-department duty (section null = both sections).
    async setDepartment(dutyId, { subjectId, section }, adminId) {
        await poolConnect;
        const subject = Number(subjectId);
        if (!Number.isSafeInteger(subject) || subject < 1) throw Object.assign(new Error('Choose the subject this head of department covers'), { statusCode: 422 });
        if (section !== null && section !== undefined && section !== '' && !SECTIONS.includes(section)) throw Object.assign(new Error('Choose Anglophone, Francophone or both sections'), { statusCode: 422 });
        const sec = section || null;
        const tx = pool.transaction();
        await tx.begin();
        try {
            const req = () => new sql.Request(tx);
            const duty = (await req().input('id', sql.Int, dutyId).query('SELECT id, duty FROM staff_duties WITH (UPDLOCK) WHERE id = @id AND revoked_at IS NULL')).recordset[0];
            if (!duty) throw notFound('Duty not found or already removed');
            if (duty.duty !== 'head_of_department') throw Object.assign(new Error('Only a head of department covers a subject'), { statusCode: 422 });
            if (!(await req().input('s', sql.Int, subject).query('SELECT id FROM subjects WHERE id = @s')).recordset.length) throw notFound('That subject does not exist');
            await req().input('id', sql.Int, dutyId).query('DELETE FROM staff_duty_departments WHERE duty_id = @id');
            await req().input('id', sql.Int, dutyId).input('s', sql.Int, subject).input('sec', sql.NVarChar(20), sec).input('admin', sql.Int, adminId)
                .query('INSERT INTO staff_duty_departments (duty_id, subject_id, section, set_by) VALUES (@id, @s, @sec, @admin)');
            await tx.commit();
            return { subjectId: subject, section: sec };
        } catch (err) {
            await tx.rollback().catch(() => {});
            if (err.number === 208) throw Object.assign(new Error('Run the database migration (019) before assigning a head of department'), { statusCode: 409 });
            throw err;
        }
    },

    async listActive() {
        await poolConnect;
        const result = await pool.request().query(`
            SELECT d.id, d.staff_type AS staffType, d.staff_id AS staffId, d.duty, d.granted_at AS grantedAt, ${PERSON_SQL}
            FROM staff_duties d ${PERSON_JOINS}
            WHERE d.revoked_at IS NULL
            ORDER BY d.duty, staffName`);
        return result.recordset;
    },

    // Classes a discipline master looks after: an array of class ids, or null for the whole school
    // (no classes chosen, or migration 018 not applied yet).
    async disciplineClasses(staffType, staffId) {
        await poolConnect;
        try {
            const result = await pool.request()
                .input('type', sql.NVarChar(20), staffType)
                .input('id', sql.Int, staffId)
                .query(`SELECT dc.class_id FROM staff_duty_classes dc JOIN staff_duties d ON d.id = dc.duty_id
                        WHERE d.staff_type = @type AND d.staff_id = @id AND d.duty = 'discipline_master' AND d.revoked_at IS NULL`);
            const ids = [...new Set(result.recordset.map(r => r.class_id))];
            return ids.length ? ids : null;
        } catch (err) {
            if (err.number === 208) return null; // table not created yet: keep school-wide oversight
            throw err;
        }
    },

    // Classes for each active discipline-master duty: Map dutyId -> [{ id, label }].
    async classesByDuty() {
        await poolConnect;
        try {
            const result = await pool.request().query(`
                SELECT dc.duty_id, c.id, c.section + ' — ' + c.name + COALESCE(' (' + NULLIF(c.stream, 'Normal') + ')', '') AS label
                FROM staff_duty_classes dc JOIN classes c ON c.id = dc.class_id
                JOIN staff_duties d ON d.id = dc.duty_id AND d.revoked_at IS NULL
                ORDER BY c.section, c.rank, c.name`);
            const map = new Map();
            for (const r of result.recordset) (map.get(r.duty_id) || map.set(r.duty_id, []).get(r.duty_id)).push({ id: r.id, label: r.label });
            return map;
        } catch (err) {
            if (err.number === 208) return new Map();
            throw err;
        }
    },

    // Replace the classes of a discipline-master duty (an empty list means the whole school).
    async setClasses(dutyId, classIds, adminId) {
        await poolConnect;
        const ids = [...new Set(classIds.map(Number))];
        if (ids.some(v => !Number.isSafeInteger(v) || v < 1)) throw Object.assign(new Error('Choose valid classes'), { statusCode: 422 });
        const tx = pool.transaction();
        await tx.begin();
        try {
            const req = () => new sql.Request(tx);
            const duty = (await req().input('id', sql.Int, dutyId).query('SELECT id, duty FROM staff_duties WITH (UPDLOCK) WHERE id = @id AND revoked_at IS NULL')).recordset[0];
            if (!duty) throw notFound('Duty not found or already removed');
            if (duty.duty !== 'discipline_master') throw Object.assign(new Error('Only a discipline master looks after classes'), { statusCode: 422 });
            if (ids.length) {
                const r = req();
                ids.forEach((v, i) => r.input('c' + i, sql.Int, v));
                const found = (await r.query(`SELECT id FROM classes WHERE id IN (${ids.map((_, i) => '@c' + i).join(',')})`)).recordset.length;
                if (found !== ids.length) throw notFound('One of the classes does not exist');
            }
            await req().input('id', sql.Int, dutyId).query('DELETE FROM staff_duty_classes WHERE duty_id = @id');
            for (const classId of ids) {
                await req().input('id', sql.Int, dutyId).input('class', sql.Int, classId).input('admin', sql.Int, adminId)
                    .query('INSERT INTO staff_duty_classes (duty_id, class_id, added_by) VALUES (@id, @class, @admin)');
            }
            await tx.commit();
            return ids;
        } catch (err) {
            await tx.rollback().catch(() => {});
            if (err.number === 208) throw Object.assign(new Error('Run the database migration (018) before choosing classes for a discipline master'), { statusCode: 409 });
            throw err;
        }
    },

    async forStaff(staffType, staffId) {
        await poolConnect;
        const result = await pool.request()
            .input('type', sql.NVarChar(20), staffType)
            .input('id', sql.Int, staffId)
            .query('SELECT duty FROM staff_duties WHERE staff_type = @type AND staff_id = @id AND revoked_at IS NULL');
        return result.recordset.map(r => r.duty);
    },

    async grant({ staffType, staffId, duty, adminId }) {
        await poolConnect;
        const table = { admin: 'Admins', teacher: 'teachers', auxiliary: 'auxiliary_staff' }[staffType];
        const exists = await pool.request().input('id', sql.Int, staffId)
            .query(`SELECT id FROM ${table} WHERE id = @id`);
        if (!exists.recordset.length) throw notFound('That staff member does not exist');
        try {
            const result = await pool.request()
                .input('type', sql.NVarChar(20), staffType)
                .input('id', sql.Int, staffId)
                .input('duty', sql.NVarChar(30), duty)
                .input('admin', sql.Int, adminId)
                .query(`INSERT INTO staff_duties (staff_type, staff_id, duty, granted_by_admin_id)
                        OUTPUT INSERTED.id VALUES (@type, @id, @duty, @admin)`);
            return result.recordset[0].id;
        } catch (err) {
            if (err.number === 2601 || err.number === 2627) throw conflict('This person already has that duty');
            throw err;
        }
    },

    async revoke(id, adminId) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('admin', sql.Int, adminId)
            .query(`UPDATE staff_duties SET revoked_at = SYSUTCDATETIME(), revoked_by_admin_id = @admin
                    WHERE id = @id AND revoked_at IS NULL; SELECT @@ROWCOUNT AS changed;`);
        if (!result.recordset[0].changed) throw notFound('Duty not found or already removed');
    },

    async revokeAllFor(staffType, staffId, adminId) {
        await poolConnect;
        await pool.request()
            .input('type', sql.NVarChar(20), staffType)
            .input('id', sql.Int, staffId)
            .input('admin', sql.Int, adminId)
            .query(`UPDATE staff_duties SET revoked_at = SYSUTCDATETIME(), revoked_by_admin_id = @admin
                    WHERE staff_type = @type AND staff_id = @id AND revoked_at IS NULL`);
    },
};

module.exports = StaffDutyModel;
