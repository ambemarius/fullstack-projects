const { sql, pool, poolConnect } = require('../../config/database');

/**
 * An academic year (e.g. "2026/2027") created by an admin.
 *
 *   academic_years          -> the year itself; createdBy references Admins(id).
 *                              Only one row may have isCurrent = 1 at a time.
 *   academic_year_students  -> students enrolled in the year (many-to-many).
 *   academic_year_teachers  -> teachers serving in the year (many-to-many).
 *
 * "Number of students/teachers" is always derived with COUNT(*), never stored,
 * so it cannot drift out of sync.
 */
const AcademicYearModel = {
    // Base table only. Students reference academic_years, so this must be
    // created before the students table; the junctions come after (see
    // createEnrollmentTables) because they reference students.
    async createTable() {
        await poolConnect;

        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'academic_years')
            CREATE TABLE academic_years (
                id        INT IDENTITY(1,1) PRIMARY KEY,
                name      NVARCHAR(20) NOT NULL UNIQUE,
                fromYear  INT NOT NULL,
                toYear    INT NOT NULL,
                isCurrent BIT NOT NULL DEFAULT 0,
                createdBy INT NOT NULL,
                createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_ay_admin FOREIGN KEY (createdBy) REFERENCES Admins(id)
            );
        `);

        // Enforce "at most one current year" with a filtered unique index.
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE name = 'UX_academic_year_current'
                  AND object_id = OBJECT_ID('academic_years')
            )
            CREATE UNIQUE INDEX UX_academic_year_current
                ON academic_years(isCurrent) WHERE isCurrent = 1;
        `);
    },

    // Enrollment junctions. Create AFTER students and teachers tables exist.
    async createEnrollmentTables() {
        await poolConnect;

        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'academic_year_students')
            CREATE TABLE academic_year_students (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                academic_year_id INT NOT NULL,
                student_id       INT NOT NULL,
                createdAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_ays UNIQUE (academic_year_id, student_id),
                CONSTRAINT FK_ays_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
                CONSTRAINT FK_ays_student FOREIGN KEY (student_id)       REFERENCES students(id)        ON DELETE CASCADE
            );
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'academic_year_teachers')
            CREATE TABLE academic_year_teachers (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                academic_year_id INT NOT NULL,
                teacher_id       INT NOT NULL,
                createdAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_ayt UNIQUE (academic_year_id, teacher_id),
                CONSTRAINT FK_ayt_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
                CONSTRAINT FK_ayt_teacher FOREIGN KEY (teacher_id)       REFERENCES teachers(id)        ON DELETE CASCADE
            );
        `);
    },

    // Create a year. If isCurrent is true, any previous current year is cleared
    // first (inside a transaction) to satisfy the single-current rule.
    async create({ name, fromYear, toYear, createdBy, isCurrent = false }) {
        await poolConnect;
        const yearName = name || `${fromYear}/${toYear}`;

        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            if (isCurrent) {
                await new sql.Request(tx).query('UPDATE academic_years SET isCurrent = 0 WHERE isCurrent = 1');
            }
            const result = await new sql.Request(tx)
                .input('name', sql.NVarChar(20), yearName)
                .input('fromYear', sql.Int, fromYear)
                .input('toYear', sql.Int, toYear)
                .input('isCurrent', sql.Bit, isCurrent ? 1 : 0)
                .input('createdBy', sql.Int, createdBy)
                .query(`
                    INSERT INTO academic_years (name, fromYear, toYear, isCurrent, createdBy)
                    OUTPUT INSERTED.*
                    VALUES (@name, @fromYear, @toYear, @isCurrent, @createdBy)
                `);
            await tx.commit();
            return result.recordset[0];
        } catch (err) {
            await tx.rollback();
            throw err;
        }
    },

    // Make one year the current one (clears the previous current first).
    async setCurrent(id) {
        await poolConnect;
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx).query('UPDATE academic_years SET isCurrent = 0 WHERE isCurrent = 1');
            await new sql.Request(tx)
                .input('id', sql.Int, id)
                .query('UPDATE academic_years SET isCurrent = 1 WHERE id = @id');
            await tx.commit();
        } catch (err) {
            await tx.rollback();
            throw err;
        }
    },

    async enrollStudent(academicYearId, studentId) {
        await poolConnect;
        await pool.request()
            .input('yearId', sql.Int, academicYearId)
            .input('studentId', sql.Int, studentId)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM academic_year_students
                    WHERE academic_year_id = @yearId AND student_id = @studentId
                )
                INSERT INTO academic_year_students (academic_year_id, student_id)
                VALUES (@yearId, @studentId);
            `);
    },

    async assignTeacher(academicYearId, teacherId) {
        await poolConnect;
        await pool.request()
            .input('yearId', sql.Int, academicYearId)
            .input('teacherId', sql.Int, teacherId)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM academic_year_teachers
                    WHERE academic_year_id = @yearId AND teacher_id = @teacherId
                )
                INSERT INTO academic_year_teachers (academic_year_id, teacher_id)
                VALUES (@yearId, @teacherId);
            `);
    },

    // Years with derived student/teacher counts.
    async getAll() {
        await poolConnect;
        const result = await pool.request().query(`
            SELECT ay.*,
                   (SELECT COUNT(*) FROM academic_year_students s WHERE s.academic_year_id = ay.id) AS numberOfStudents,
                   (SELECT COUNT(*) FROM academic_year_teachers t WHERE t.academic_year_id = ay.id) AS numberOfTeachers
            FROM academic_years ay
            ORDER BY ay.fromYear DESC;
        `);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT ay.*,
                       (SELECT COUNT(*) FROM academic_year_students s WHERE s.academic_year_id = ay.id) AS numberOfStudents,
                       (SELECT COUNT(*) FROM academic_year_teachers t WHERE t.academic_year_id = ay.id) AS numberOfTeachers
                FROM academic_years ay
                WHERE ay.id = @id;
            `);
        return result.recordset[0] || null;
    },

    async findCurrent() {
        await poolConnect;
        const result = await pool.request()
            .query('SELECT * FROM academic_years WHERE isCurrent = 1');
        return result.recordset[0] || null;
    },
};

module.exports = AcademicYearModel;
