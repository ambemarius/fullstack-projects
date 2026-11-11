const { sql, pool, poolConnect } = require('../../config/database');
const bcrypt = require('bcrypt');

const Parent = {
    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM parents WHERE id = @id');
        return result.recordset[0] || null;
    },

    async findByEmail(email) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .query('SELECT * FROM parents WHERE email = @email');
        return result.recordset[0] || null;
    },

    async findByPhone(phone) {
        await poolConnect;
        const result = await pool.request()
            .input('phone', sql.NVarChar(20), phone)
            .query('SELECT * FROM parents WHERE phone = @phone');
        return result.recordset[0] || null;
    },

    async create({ firstName, lastName, email, phone, password, relationship }) {
        await poolConnect;
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.request()
            .input('firstName', sql.NVarChar(100), firstName)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('email', sql.NVarChar(255), email || null)
            .input('phone', sql.NVarChar(20), phone)
            .input('password', sql.NVarChar(255), hash)
            .input('relationship', sql.NVarChar(50), relationship || 'parent')
            .query(`INSERT INTO parents (firstName, lastName, email, phone, password, relationship)
                    OUTPUT INSERTED.*
                    VALUES (@firstName, @lastName, @email, @phone, @password, @relationship)`);
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
                           s.currentClassLevel, c.name AS className, c.section
                    FROM parent_students ps
                    JOIN students s ON s.id = ps.student_id
                    LEFT JOIN classes c ON c.id = s.currentClassLevel
                    WHERE ps.parent_id = @parentId AND s.isWithdrawn = 0`);
        return result.recordset;
    },

    async linkChild(parentId, studentId) {
        await poolConnect;
        await pool.request()
            .input('parentId', sql.Int, parentId)
            .input('studentId', sql.Int, studentId)
            .query(`IF NOT EXISTS (SELECT 1 FROM parent_students WHERE parent_id = @parentId AND student_id = @studentId)
                    INSERT INTO parent_students (parent_id, student_id) VALUES (@parentId, @studentId)`);
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
