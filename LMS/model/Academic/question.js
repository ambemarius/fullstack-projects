const { sql, pool, poolConnect } = require('../../config/database');

// A multiple-choice question belonging to one exam. The student picks one of
// options A-D; correctOption stores which is right. Deleting an exam removes its questions.
const QuestionModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'questions')
            CREATE TABLE questions (
                id            INT IDENTITY(1,1) PRIMARY KEY,
                examId        INT NOT NULL,
                questionText  NVARCHAR(MAX) NOT NULL,
                optionA       NVARCHAR(500) NOT NULL,
                optionB       NVARCHAR(500) NOT NULL,
                optionC       NVARCHAR(500) NOT NULL,
                optionD       NVARCHAR(500) NOT NULL,
                correctOption CHAR(1) NOT NULL,
                marks         INT NOT NULL DEFAULT 1,
                createdBy     INT NOT NULL,
                createdAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT CK_question_correct CHECK (correctOption IN ('A', 'B', 'C', 'D')),
                CONSTRAINT FK_question_exam    FOREIGN KEY (examId)    REFERENCES exams(id) ON DELETE CASCADE,
                CONSTRAINT FK_question_teacher FOREIGN KEY (createdBy) REFERENCES teachers(id)
            );
        `);
    },

    async create({ examId, questionText, optionA, optionB, optionC, optionD, correctOption, marks = 1, createdBy }) {
        await poolConnect;
        const result = await pool.request()
            .input('examId', sql.Int, examId)
            .input('questionText', sql.NVarChar(sql.MAX), questionText)
            .input('optionA', sql.NVarChar(500), optionA)
            .input('optionB', sql.NVarChar(500), optionB)
            .input('optionC', sql.NVarChar(500), optionC)
            .input('optionD', sql.NVarChar(500), optionD)
            .input('correctOption', sql.Char(1), correctOption)
            .input('marks', sql.Int, marks)
            .input('createdBy', sql.Int, createdBy)
            .query(`
                INSERT INTO questions
                    (examId, questionText, optionA, optionB, optionC, optionD, correctOption, marks, createdBy)
                OUTPUT INSERTED.*
                VALUES
                    (@examId, @questionText, @optionA, @optionB, @optionC, @optionD, @correctOption, @marks, @createdBy)
            `);
        return result.recordset[0];
    },

    async getByExam(examId) {
        await poolConnect;
        const result = await pool.request()
            .input('examId', sql.Int, examId)
            .query('SELECT * FROM questions WHERE examId = @examId ORDER BY id');
        return result.recordset;
    },

    // Student-facing: same questions but WITHOUT the correct answer.
    async getByExamForStudent(examId) {
        await poolConnect;
        const result = await pool.request()
            .input('examId', sql.Int, examId)
            .query(`
                SELECT id, examId, questionText, optionA, optionB, optionC, optionD, marks
                FROM questions WHERE examId = @examId ORDER BY id
            `);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM questions WHERE id = @id');
        return result.recordset[0] || null;
    },
};

module.exports = QuestionModel;
