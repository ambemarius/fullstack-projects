const { sql, pool, poolConnect } = require('../../config/database');

const SubjectModel = {
    async create({ name, code, description, coefficient = 1, categories, subject_master, class_id, hours_per_week = 4, has_lab = 0 }) {
        await poolConnect;
        const result = await pool.request()
            .input('name', sql.NVarChar(100), name)
            .input('code', sql.NVarChar(20), code)
            .input('description', sql.NVarChar(200), description || null)
            .input('coefficient', sql.Int, coefficient)
            .input('categories', sql.NVarChar(20), categories || null)
            .input('subject_master', sql.Int, subject_master || null)
            .input('class_id', sql.Int, class_id || null)
            .input('hours_per_week', sql.Int, hours_per_week)
            .input('has_lab', sql.Bit, has_lab ? 1 : 0)
            .query(`
                INSERT INTO subjects (name, code, description, coefficient, categories, subject_master, class_id, hours_per_week, has_lab)
                OUTPUT INSERTED.*
                VALUES (@name, @code, @description, @coefficient, @categories, @subject_master, @class_id, @hours_per_week, @has_lab)
            `);
        return result.recordset[0];
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request().query(`
            SELECT s.*,
                   t.name AS subject_master_name,
                   c.name AS class_name
            FROM subjects s
            LEFT JOIN teachers t ON s.subject_master = t.id
            LEFT JOIN classes c ON s.class_id = c.id
            ORDER BY s.name
        `);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT s.*,
                       t.name AS subject_master_name,
                       c.name AS class_name
                FROM subjects s
                LEFT JOIN teachers t ON s.subject_master = t.id
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE s.id = @id
            `);
        return result.recordset[0];
    },

    async findByCode(code) {
        await poolConnect;
        const result = await pool.request()
            .input('code', sql.NVarChar(20), code)
            .query(`
                SELECT s.*,
                       t.name AS subject_master_name,
                       c.name AS class_name
                FROM subjects s
                LEFT JOIN teachers t ON s.subject_master = t.id
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE s.code = @code
            `);
        return result.recordset[0] || null;
    },

    async update(id, { name, code, description, coefficient, categories, subject_master, class_id, hours_per_week, has_lab }) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar(100), name)
            .input('code', sql.NVarChar(20), code)
            .input('description', sql.NVarChar(200), description || null)
            .input('coefficient', sql.Int, coefficient)
            .input('categories', sql.NVarChar(20), categories || null)
            .input('subject_master', sql.Int, subject_master || null)
            .input('class_id', sql.Int, class_id || null)
            .input('hours_per_week', sql.Int, hours_per_week)
            .input('has_lab', sql.Bit, has_lab)
            .query(`
                UPDATE subjects
                SET name = COALESCE(@name, name),
                    code = COALESCE(@code, code),
                    description = COALESCE(@description, description),
                    coefficient = COALESCE(@coefficient, coefficient),
                    categories = COALESCE(@categories, categories),
                    subject_master = COALESCE(@subject_master, subject_master),
                    class_id = COALESCE(@class_id, class_id),
                    hours_per_week = COALESCE(@hours_per_week, hours_per_week),
                    has_lab = COALESCE(@has_lab, has_lab)
                WHERE id = @id;
                SELECT * FROM subjects WHERE id = @id;
            `);
        return result.recordset[0] || null;
    },

    // Deleting a subject would cascade through class_subjects into recorded marks.
    async remove(id) {
        await poolConnect;
        const usage = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT
                    (SELECT COUNT(*) FROM class_subjects WHERE subject_id = @id) AS offerings,
                    (SELECT COUNT(*) FROM subject_scores ss JOIN class_subjects cs ON cs.id = ss.class_subject_id WHERE cs.subject_id = @id) AS scores,
                    (SELECT COUNT(*) FROM exams WHERE subjectId = @id) AS exams,
                    (SELECT COUNT(*) FROM timetables WHERE subject_id = @id) AS periods
            `);
        const counts = usage.recordset[0] || {};
        if (Object.values(counts).some(count => Number(count) > 0)) {
            const err = new Error('This subject is in use (class offerings, marks, exams or timetable) and cannot be deleted');
            err.statusCode = 409;
            throw err;
        }
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM subjects WHERE id = @id');
    },
};

module.exports = SubjectModel;
