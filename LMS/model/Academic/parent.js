const { sql, pool, poolConnect } = require('../../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const Parent = {
    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM parents WHERE id = @id');
        return result.recordset[0] || null;
    },

    async findByEmail(email, schoolId) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .input('school', sql.Int, schoolId ?? null)
            .query('SELECT * FROM parents WHERE email = @email AND (@school IS NULL OR school_id = @school)');
        return result.recordset[0] || null;
    },

    async findByPhone(phone, schoolId) {
        await poolConnect;
        const result = await pool.request()
            .input('phone', sql.NVarChar(20), phone)
            .input('school', sql.Int, schoolId ?? null)
            .query('SELECT * FROM parents WHERE phone = @phone AND (@school IS NULL OR school_id = @school)');
        return result.recordset[0] || null;
    },

    async create({ firstName, lastName, email, phone, password }) {
        await poolConnect;
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await pool.request()
            .input('firstName', sql.NVarChar(100), firstName)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('email', sql.NVarChar(255), email || null)
            .input('phone', sql.NVarChar(20), phone)
            .input('password', sql.NVarChar(255), hash)
            .query(`INSERT INTO parents (firstName, lastName, email, phone, password)
                    OUTPUT INSERTED.id, INSERTED.firstName, INSERTED.lastName, INSERTED.email, INSERTED.phone,
                           INSERTED.status, INSERTED.created_at
                    VALUES (@firstName, @lastName, @email, @phone, @password)`);
        return result.recordset[0];
    },

    async verifyPassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    },

    async getChildren(parentId) {
        await poolConnect;
        const result = await pool.request()
            .input('parentId', sql.Int, parentId)
            .query(`SELECT s.id, s.firstName, s.middleName, s.lastName, s.matricule, s.sex,
                           s.currentClassLevel, c.name AS className, c.section, ps.relationship
                    FROM parent_students ps
                    JOIN students s ON s.id = ps.student_id
                    LEFT JOIN classes c ON c.id = s.currentClassLevel
                    WHERE ps.parent_id = @parentId AND s.isWithdrawn = 0`);
        return result.recordset;
    },

    async isLinked(parentId, studentId) {
        await poolConnect;
        const result = await pool.request()
            .input('parentId', sql.Int, parentId)
            .input('studentId', sql.Int, studentId)
            .query('SELECT 1 AS linked FROM parent_students WHERE parent_id = @parentId AND student_id = @studentId');
        return result.recordset.length > 0;
    },

    async linkChild(parentId, studentId, { relationship = null, linkedByAdminId = null } = {}) {
        await poolConnect;
        await pool.request()
            .input('parentId', sql.Int, parentId)
            .input('studentId', sql.Int, studentId)
            .input('relationship', sql.NVarChar(30), relationship)
            .input('linkedByAdminId', sql.Int, linkedByAdminId)
            .query(`IF NOT EXISTS (SELECT 1 FROM parent_students WHERE parent_id = @parentId AND student_id = @studentId)
                    INSERT INTO parent_students (parent_id, student_id, relationship, linked_by_admin_id)
                    VALUES (@parentId, @studentId, @relationship, @linkedByAdminId)`);
    },

    async unlinkChild(parentId, studentId) {
        await poolConnect;
        await pool.request()
            .input('parentId', sql.Int, parentId)
            .input('studentId', sql.Int, studentId)
            .query('DELETE FROM parent_students WHERE parent_id = @parentId AND student_id = @studentId');
    },
};

module.exports = Parent;
