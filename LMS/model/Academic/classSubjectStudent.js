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
                  AND s.academicYearId = @academicYearId
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
};

module.exports = ClassSubjectStudentModel;
