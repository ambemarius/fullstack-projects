const { sql, pool, poolConnect } = require('../../config/database');

const ClassSubjectStudentModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'class_subject_students')
            CREATE TABLE class_subject_students (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                class_subject_id INT NOT NULL,
                student_id       INT NOT NULL,
                academic_year_id INT NOT NULL,
                createdAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_cs_student UNIQUE (class_subject_id, student_id, academic_year_id),
                CONSTRAINT FK_css_cs      FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
                CONSTRAINT FK_css_student FOREIGN KEY (student_id)       REFERENCES students(id)        ON DELETE CASCADE,
                CONSTRAINT FK_css_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
            );
        `);
    },

    async enroll(classSubjectId, studentId, academicYearId) {
        await poolConnect;
        await pool.request()
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('studentId', sql.Int, studentId)
            .input('academicYearId', sql.Int, academicYearId)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM class_subject_students
                    WHERE class_subject_id = @classSubjectId AND student_id = @studentId AND academic_year_id = @academicYearId
                )
                INSERT INTO class_subject_students (class_subject_id, student_id, academic_year_id)
                VALUES (@classSubjectId, @studentId, @academicYearId);
            `);
    },

    async unenroll(classSubjectId, studentId) {
        await poolConnect;
        await pool.request()
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('studentId', sql.Int, studentId)
            .query('DELETE FROM class_subject_students WHERE class_subject_id = @classSubjectId AND student_id = @studentId');
    },

    async bulkEnroll(classSubjectId, academicYearId, studentIds) {
        await poolConnect;
        for (const sid of studentIds) {
            await this.enroll(classSubjectId, sid, academicYearId);
        }
    },

    async bulkUnenroll(classSubjectId, studentIds) {
        await poolConnect;
        for (const sid of studentIds) {
            await this.unenroll(classSubjectId, sid);
        }
    },

    async getEnrolled(classSubjectId, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('academicYearId', sql.Int, academicYearId)
            .query(`
                SELECT s.id AS studentId, s.firstName, s.middleName, s.lastName, s.matricule, s.sex
                FROM class_subject_students css
                JOIN students s ON s.id = css.student_id
                WHERE css.class_subject_id = @classSubjectId AND css.academic_year_id = @academicYearId
                ORDER BY s.lastName, s.firstName
            `);
        return result.recordset;
    },

    async getUnenrolled(classSubjectId, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('academicYearId', sql.Int, academicYearId)
            .query(`
                SELECT s.id AS studentId, s.firstName, s.middleName, s.lastName, s.matricule, s.sex
                FROM students s
                WHERE s.currentClassLevel = (SELECT class_id FROM class_subjects WHERE id = @classSubjectId)
                  AND s.isWithdrawn = 0
                  -- Students with no recorded year belong to the current class (same rule as mark sheets and report cards).
                  AND (s.academicYearId IS NULL OR s.academicYearId = @academicYearId)
                  AND NOT EXISTS (
                      SELECT 1 FROM class_subject_students css
                      WHERE css.class_subject_id = @classSubjectId
                        AND css.student_id = s.id
                        AND css.academic_year_id = @academicYearId
                  )
                ORDER BY s.lastName, s.firstName
            `);
        return result.recordset;
    },

    async isEnrolled(classSubjectId, studentId, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('studentId', sql.Int, studentId)
            .input('academicYearId', sql.Int, academicYearId)
            .query(`
                SELECT 1 AS ok FROM class_subject_students
                WHERE class_subject_id = @classSubjectId AND student_id = @studentId AND academic_year_id = @academicYearId
            `);
        return result.recordset.length > 0;
    },

    async getByClassSubject(classSubjectId) {
        await poolConnect;
        const result = await pool.request()
            .input('classSubjectId', sql.Int, classSubjectId)
            .query(`
                SELECT css.student_id, s.firstName, s.middleName, s.lastName, s.matricule, css.academic_year_id
                FROM class_subject_students css
                JOIN students s ON s.id = css.student_id
                WHERE css.class_subject_id = @classSubjectId
                ORDER BY css.academic_year_id DESC, s.lastName, s.firstName
            `);
        return result.recordset;
    },

    // Every allocated course (class subject) for a year: class size, enrolments and marks entered per sequence of a term.
    // A class's students are those not withdrawn whose year is unset or this year (same rule as mark sheets and report cards).
    async overview(academicYearId, term) {
        await poolConnect;
        const result = await pool.request()
            .input('year', sql.Int, academicYearId)
            .input('term', sql.NVarChar(10), term)
            .query(`
                WITH roster AS (
                    SELECT id, currentClassLevel FROM students
                    WHERE isWithdrawn = 0 AND (academicYearId IS NULL OR academicYearId = @year)
                ), enrolled AS (
                    SELECT css.class_subject_id, css.student_id FROM class_subject_students css
                    JOIN roster r ON r.id = css.student_id
                    WHERE css.academic_year_id = @year AND (css.enrolment_status IS NULL OR css.enrolment_status = 'active')
                )
                SELECT cs.id AS classSubjectId, c.id AS classId, c.section, c.name AS className, c.stream,
                       s.id AS subjectId, s.name AS subject, s.code,
                       CONVERT(float, COALESCE(NULLIF(cs.coefficient, 0), NULLIF(s.coefficient, 0), 1)) AS coefficient,
                       (SELECT COUNT(*) FROM roster r WHERE r.currentClassLevel = c.id) AS classSize,
                       (SELECT COUNT(*) FROM enrolled e WHERE e.class_subject_id = cs.id) AS enrolled,
                       (SELECT COUNT(*) FROM subject_scores ss JOIN enrolled e ON e.class_subject_id = ss.class_subject_id AND e.student_id = ss.student_id
                        WHERE ss.class_subject_id = cs.id AND ss.academic_year_id = @year AND ss.term = @term AND ss.sequence = 1) AS seq1Entered,
                       (SELECT COUNT(*) FROM subject_scores ss JOIN enrolled e ON e.class_subject_id = ss.class_subject_id AND e.student_id = ss.student_id
                        WHERE ss.class_subject_id = cs.id AND ss.academic_year_id = @year AND ss.term = @term AND ss.sequence = 2) AS seq2Entered,
                       (SELECT COUNT(*) FROM subject_scores ss
                        WHERE ss.class_subject_id = cs.id AND ss.academic_year_id = @year AND ss.term = @term
                          AND NOT EXISTS (SELECT 1 FROM enrolled e WHERE e.class_subject_id = ss.class_subject_id AND e.student_id = ss.student_id)) AS marksNotEnrolled,
                       (SELECT STRING_AGG(t.name, ', ') FROM class_subject_teachers cst JOIN teachers t ON t.id = cst.teacher_id
                        WHERE cst.class_subject_id = cs.id AND cst.assignment_status = 'active') AS teachers
                FROM class_subjects cs
                JOIN classes c ON c.id = cs.class_id
                JOIN subjects s ON s.id = cs.subject_id
                WHERE EXISTS (SELECT 1 FROM subject_allocations a WHERE a.class_id = cs.class_id AND a.subject_id = cs.subject_id AND a.academic_year_id = @year)
                ORDER BY c.section, c.rank, c.name, s.name
            `);
        return result.recordset;
    },
};

module.exports = ClassSubjectStudentModel;
