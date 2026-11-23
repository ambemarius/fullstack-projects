const { sql, pool, poolConnect } = require('../../config/database');

const DUTIES = {
    bursar: 'Bursar / cashier',
    librarian: 'Librarian',
    lab_attendant: 'Laboratory attendant',
    discipline_master: 'Discipline master',
};
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

    async listActive() {
        await poolConnect;
        const result = await pool.request().query(`
            SELECT d.id, d.staff_type AS staffType, d.staff_id AS staffId, d.duty, d.granted_at AS grantedAt, ${PERSON_SQL}
            FROM staff_duties d ${PERSON_JOINS}
            WHERE d.revoked_at IS NULL
            ORDER BY d.duty, staffName`);
        return result.recordset;
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
