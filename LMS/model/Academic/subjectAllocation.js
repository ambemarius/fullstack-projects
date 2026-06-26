const { sql, pool, poolConnect } = require('../../config/database');

const SubjectAllocationModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'subject_allocations')
            CREATE TABLE subject_allocations (
                id            INT IDENTITY(1,1) PRIMARY KEY,
                class_id      INT NOT NULL,
                subject_id    INT NOT NULL,
                periods_week  INT NOT NULL,
                academic_year_id INT NOT NULL,
                createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_sa UNIQUE (class_id, subject_id, academic_year_id),
                CONSTRAINT FK_sa_class   FOREIGN KEY (class_id)   REFERENCES classes(id) ON DELETE CASCADE,
                CONSTRAINT FK_sa_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                CONSTRAINT FK_sa_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
            );
        `);
    },

    async set({ class_id, subject_id, periods_week, academic_year_id }) {
        await poolConnect;
        const result = await pool.request()
            .input('class_id', sql.Int, class_id)
            .input('subject_id', sql.Int, subject_id)
            .input('periods', sql.Int, periods_week)
            .input('yearId', sql.Int, academic_year_id)
            .query(`
                MERGE subject_allocations AS target
                USING (SELECT @class_id AS class_id, @subject_id AS subject_id, @yearId AS year_id) AS source
                ON target.class_id = source.class_id AND target.subject_id = source.subject_id AND target.academic_year_id = source.year_id
                WHEN MATCHED THEN UPDATE SET periods_week = @periods
                WHEN NOT MATCHED THEN INSERT (class_id, subject_id, periods_week, academic_year_id) VALUES (@class_id, @subject_id, @periods, @yearId)
                OUTPUT INSERTED.*;
            `);
        return result.recordset[0];
    },

    async getByClass(classId, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .input('yearId', sql.Int, academicYearId)
            .query(`
                SELECT sa.*, s.name AS subject_name, s.code AS subject_code
                FROM subject_allocations sa
                JOIN subjects s ON s.id = sa.subject_id
                WHERE sa.class_id = @classId AND sa.academic_year_id = @yearId
                ORDER BY s.name
            `);
        return result.recordset;
    },

    async getAll(academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('yearId', sql.Int, academicYearId)
            .query(`
                SELECT sa.*, s.name AS subject_name, s.code AS subject_code,
                       c.name AS class_name, c.section, c.stream
                FROM subject_allocations sa
                JOIN subjects s ON s.id = sa.subject_id
                JOIN classes c ON c.id = sa.class_id
                WHERE sa.academic_year_id = @yearId
                ORDER BY c.section, c.rank, s.name
            `);
        return result.recordset;
    },

    async delete(id) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM subject_allocations WHERE id = @id');
    },
};

module.exports = SubjectAllocationModel;
