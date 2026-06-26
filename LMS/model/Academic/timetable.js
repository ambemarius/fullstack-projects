const { sql, pool, poolConnect } = require('../../config/database');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TimetableModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'timetables')
            CREATE TABLE timetables (
                id              INT IDENTITY(1,1) PRIMARY KEY,
                class_id        INT NOT NULL,
                subject_id      INT NOT NULL,
                teacher_id      INT NOT NULL,
                day_of_week     NVARCHAR(10) NOT NULL,
                time_slot_id    INT NULL,
                start_time      NVARCHAR(5)  NOT NULL,
                end_time        NVARCHAR(5)  NOT NULL,
                room            NVARCHAR(50) NULL,
                academic_term   NVARCHAR(10) NOT NULL,
                academic_year_id INT NOT NULL,
                created_by      INT NOT NULL,
                createdAt       DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_tt_class  FOREIGN KEY (class_id)  REFERENCES classes(id),
                CONSTRAINT FK_tt_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
                CONSTRAINT FK_tt_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
                CONSTRAINT FK_tt_year   FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
                CONSTRAINT FK_tt_admin  FOREIGN KEY (created_by) REFERENCES Admins(id)
            );
        `);
    },

    async migrate() {
        await poolConnect;
        // Add time_slot_id if missing (non-destructive)
        const col = await pool.request().query(`
            SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('timetables') AND name = 'time_slot_id'
        `);
        if (!col.recordset.length) {
            await pool.request().query(`
                ALTER TABLE timetables ADD time_slot_id INT NULL
                CONSTRAINT FK_tt_slot FOREIGN KEY (time_slot_id) REFERENCES time_slots(id)
            `);
        }
    },

    async create({ class_id, subject_id, teacher_id, day_of_week, time_slot_id, start_time, end_time, room, academic_term, academic_year_id, created_by }) {
        await poolConnect;
        const result = await pool.request()
            .input('class_id', sql.Int, class_id)
            .input('subject_id', sql.Int, subject_id)
            .input('teacher_id', sql.Int, teacher_id)
            .input('day_of_week', sql.NVarChar(10), day_of_week)
            .input('time_slot_id', sql.Int, time_slot_id || null)
            .input('start_time', sql.NVarChar(5), start_time)
            .input('end_time', sql.NVarChar(5), end_time)
            .input('room', sql.NVarChar(50), room || null)
            .input('academic_term', sql.NVarChar(10), academic_term)
            .input('academic_year_id', sql.Int, academic_year_id)
            .input('created_by', sql.Int, created_by)
            .query(`
                INSERT INTO timetables (class_id, subject_id, teacher_id, day_of_week, time_slot_id, start_time, end_time, room, academic_term, academic_year_id, created_by)
                OUTPUT INSERTED.*
                VALUES (@class_id, @subject_id, @teacher_id, @day_of_week, @time_slot_id, @start_time, @end_time, @room, @academic_term, @academic_year_id, @created_by)
            `);
        return result.recordset[0];
    },

    // Full grid for a class: all time_slots left-joined with entries for each day
    async getGridByClass(classId, term, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .input('term', sql.NVarChar(10), term)
            .input('yearId', sql.Int, academicYearId)
            .query(`
                SELECT ts.id AS slot_id, ts.slot_number, ts.start_time, ts.end_time, ts.is_break, ts.sort_order,
                       t.id AS entry_id, t.subject_id, t.teacher_id, t.day_of_week, t.room,
                       s.name AS subject_name, s.code AS subject_code,
                       tc.name AS teacher_name
                FROM time_slots ts
                LEFT JOIN timetables t ON t.time_slot_id = ts.id
                    AND t.class_id = @classId
                    AND t.academic_term = @term
                    AND t.academic_year_id = @yearId
                LEFT JOIN subjects s ON s.id = t.subject_id
                LEFT JOIN teachers tc ON tc.id = t.teacher_id
                ORDER BY ts.sort_order
            `);
        return result.recordset;
    },

    async getByClass(classId, term, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .input('term', sql.NVarChar(10), term)
            .input('yearId', sql.Int, academicYearId)
            .query(`
                SELECT t.*, s.name AS subject_name, s.code AS subject_code,
                       tc.name AS teacher_name, c.name AS class_name, c.stream, c.section
                FROM timetables t
                JOIN subjects s ON s.id = t.subject_id
                JOIN teachers tc ON tc.id = t.teacher_id
                JOIN classes c ON c.id = t.class_id
                WHERE t.class_id = @classId AND t.academic_term = @term AND t.academic_year_id = @yearId
                ORDER BY t.day_of_week, t.start_time
            `);
        return result.recordset;
    },

    // Timetable entries for a teacher + the section they teach
    async getByTeacher(teacherId, term, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('teacherId', sql.Int, teacherId)
            .input('term', sql.NVarChar(10), term)
            .input('yearId', sql.Int, academicYearId)
            .query(`
                SELECT t.*, s.name AS subject_name, s.code AS subject_code,
                       c.name AS class_name, c.stream, c.section,
                       ts.slot_number, ts.is_break
                FROM timetables t
                JOIN subjects s ON s.id = t.subject_id
                JOIN classes c ON c.id = t.class_id
                JOIN time_slots ts ON ts.id = t.time_slot_id
                WHERE t.teacher_id = @teacherId AND t.academic_term = @term AND t.academic_year_id = @yearId
                ORDER BY t.day_of_week, ts.sort_order
            `);
        return result.recordset;
    },

    async getByStudent(studentId, term, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('studentId', sql.Int, studentId)
            .input('term', sql.NVarChar(10), term)
            .input('yearId', sql.Int, academicYearId)
            .query(`
                SELECT t.*, s.name AS subject_name, s.code AS subject_code,
                       tc.name AS teacher_name, ts.slot_number, ts.is_break
                FROM timetables t
                JOIN subjects s ON s.id = t.subject_id
                JOIN teachers tc ON tc.id = t.teacher_id
                JOIN students st ON st.currentClassLevel = t.class_id
                JOIN time_slots ts ON ts.id = t.time_slot_id
                WHERE st.id = @studentId AND t.academic_term = @term AND t.academic_year_id = @yearId
                ORDER BY t.day_of_week, ts.sort_order
            `);
        return result.recordset;
    },

    async getAll(term, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('term', sql.NVarChar(10), term)
            .input('yearId', sql.Int, academicYearId)
            .query(`
                SELECT t.*, s.name AS subject_name, s.code AS subject_code,
                       tc.name AS teacher_name, c.name AS class_name, c.stream, c.section,
                       ts.slot_number, ts.is_break
                FROM timetables t
                JOIN subjects s ON s.id = t.subject_id
                JOIN teachers tc ON tc.id = t.teacher_id
                JOIN classes c ON c.id = t.class_id
                JOIN time_slots ts ON ts.id = t.time_slot_id
                WHERE t.academic_term = @term AND t.academic_year_id = @yearId
                ORDER BY c.section, c.rank, t.day_of_week, ts.sort_order
            `);
        return result.recordset;
    },

    async getPeriodsPerSubject(classId, term, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .input('term', sql.NVarChar(10), term)
            .input('yearId', sql.Int, academicYearId)
            .query(`
                SELECT t.subject_id, s.name AS subject_name, s.code AS subject_code,
                       COUNT(*) AS periods_per_week
                FROM timetables t
                JOIN subjects s ON s.id = t.subject_id
                WHERE t.class_id = @classId
                  AND t.academic_term = @term
                  AND t.academic_year_id = @yearId
                GROUP BY t.subject_id, s.name, s.code
                ORDER BY s.name
            `);
        return result.recordset;
    },

    async delete(id) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM timetables WHERE id = @id');
    },

    // Clear a class's entries for a term/year (used before regenerating).
    async deleteForClass(classId, term, academicYearId) {
        await poolConnect;
        await pool.request()
            .input('classId', sql.Int, classId)
            .input('term', sql.NVarChar(10), term)
            .input('yearId', sql.Int, academicYearId)
            .query(`DELETE FROM timetables
                    WHERE class_id = @classId AND academic_term = @term AND academic_year_id = @yearId`);
    },

    // Teacher/day/slot already taken by OTHER classes — to avoid double-booking a teacher.
    async getTeacherBusy(term, academicYearId, excludeClassId) {
        await poolConnect;
        const result = await pool.request()
            .input('term', sql.NVarChar(10), term)
            .input('yearId', sql.Int, academicYearId)
            .input('excludeClassId', sql.Int, excludeClassId)
            .query(`SELECT teacher_id, day_of_week, time_slot_id
                    FROM timetables
                    WHERE academic_term = @term AND academic_year_id = @yearId AND class_id <> @excludeClassId`);
        return result.recordset;
    },
};

module.exports = TimetableModel;
