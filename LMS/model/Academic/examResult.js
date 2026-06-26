const { sql, pool, poolConnect } = require('../../config/database');

/**
 * One result per student per exam. Results stay hidden from students until
 * isPublished = 1 (use getPublishedForStudent to honour that gate).
 *
 * Note: subjectId is also reachable through the exam (exams.subjectId); it is
 * stored here as the user requested for direct, per-subject result lookups.
 */
const ExamResultModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'exam_results')
            CREATE TABLE exam_results (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                studentId   INT NOT NULL,
                examId      INT NOT NULL,
                subjectId   INT NOT NULL,
                score       DECIMAL(5,2) NOT NULL,
                passmark    INT NOT NULL DEFAULT 50,
                grade       NVARCHAR(5) NULL,
                status      NVARCHAR(10) NOT NULL,
                remarks     NVARCHAR(20) NULL,
                position    INT NULL,
                isPublished BIT NOT NULL DEFAULT 0,
                createdAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_result UNIQUE (studentId, examId),
                CONSTRAINT CK_result_status  CHECK (status IN ('Passed', 'Failed')),
                CONSTRAINT CK_result_remarks CHECK (remarks IN ('Excellent', 'Good', 'Poor')),
                CONSTRAINT FK_result_student FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
                CONSTRAINT FK_result_exam    FOREIGN KEY (examId)    REFERENCES exams(id),
                CONSTRAINT FK_result_subject FOREIGN KEY (subjectId) REFERENCES subjects(id)
            );
        `);
    },

    async create({ studentId, examId, subjectId, score, passmark = 50, grade = null, status, remarks = null, position = null }) {
        await poolConnect;
        const result = await pool.request()
            .input('studentId', sql.Int, studentId)
            .input('examId', sql.Int, examId)
            .input('subjectId', sql.Int, subjectId)
            .input('score', sql.Decimal(5, 2), score)
            .input('passmark', sql.Int, passmark)
            .input('grade', sql.NVarChar(5), grade)
            .input('status', sql.NVarChar(10), status)
            .input('remarks', sql.NVarChar(20), remarks)
            .input('position', sql.Int, position)
            .query(`
                INSERT INTO exam_results
                    (studentId, examId, subjectId, score, passmark, grade, status, remarks, position)
                OUTPUT INSERTED.*
                VALUES
                    (@studentId, @examId, @subjectId, @score, @passmark, @grade, @status, @remarks, @position)
            `);
        return result.recordset[0];
    },

    // Publish every result of an exam so students can see them.
    async publishByExam(examId) {
        await poolConnect;
        await pool.request()
            .input('examId', sql.Int, examId)
            .query('UPDATE exam_results SET isPublished = 1 WHERE examId = @examId');
    },

    // Hide an exam's results from students again.
    async unpublishByExam(examId) {
        await poolConnect;
        await pool.request()
            .input('examId', sql.Int, examId)
            .query('UPDATE exam_results SET isPublished = 0 WHERE examId = @examId');
    },

    // Has a student already got a result for this exam?
    async findForStudentExam(studentId, examId) {
        await poolConnect;
        const result = await pool.request()
            .input('studentId', sql.Int, studentId)
            .input('examId', sql.Int, examId)
            .query('SELECT * FROM exam_results WHERE studentId = @studentId AND examId = @examId');
        return result.recordset[0] || null;
    },

    // Student-facing: only published results are ever returned.
    async getPublishedForStudent(studentId) {
        await poolConnect;
        const result = await pool.request()
            .input('studentId', sql.Int, studentId)
            .query(`
                SELECT * FROM exam_results
                WHERE studentId = @studentId AND isPublished = 1
                ORDER BY createdAt DESC
            `);
        return result.recordset;
    },

    // Staff-facing: all results for an exam, published or not.
    async getByExam(examId) {
        await poolConnect;
        const result = await pool.request()
            .input('examId', sql.Int, examId)
            .query('SELECT * FROM exam_results WHERE examId = @examId ORDER BY position, score DESC');
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM exam_results WHERE id = @id');
        return result.recordset[0] || null;
    },
};

module.exports = ExamResultModel;
