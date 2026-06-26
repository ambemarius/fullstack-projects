const { sql, pool, poolConnect } = require('../../config/database');

/**
 * An exam for a given subject + class + term + academic year, created by a teacher.
 * Questions belong to an exam (see question.js -> questions.examId).
 */
const ExamModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'exams')
            CREATE TABLE exams (
                id             INT IDENTITY(1,1) PRIMARY KEY,
                name           NVARCHAR(150) NOT NULL,
                description    NVARCHAR(500) NULL,
                subjectId      INT NOT NULL,
                classLevel     INT NOT NULL,
                passmark       INT NOT NULL DEFAULT 50,
                totalmark      INT NOT NULL DEFAULT 100,
                coefficient    INT NOT NULL DEFAULT 3,
                academicTerm   NVARCHAR(10) NOT NULL,
                academicYearId INT NOT NULL,
                examDate       DATE NULL,
                examStatus     NVARCHAR(20) NOT NULL DEFAULT 'Pending',
                createdBy      INT NOT NULL,
                createdAt      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT CK_exam_term   CHECK (academicTerm IN ('First', 'Second', 'Third')),
                CONSTRAINT CK_exam_status CHECK (examStatus IN ('Pending', 'Live', 'Completed')),
                CONSTRAINT CK_exam_marks  CHECK (passmark <= totalmark),
                CONSTRAINT FK_exam_subject FOREIGN KEY (subjectId)      REFERENCES subjects(id),
                CONSTRAINT FK_exam_class   FOREIGN KEY (classLevel)     REFERENCES classes(id),
                CONSTRAINT FK_exam_year    FOREIGN KEY (academicYearId) REFERENCES academic_years(id),
                CONSTRAINT FK_exam_teacher FOREIGN KEY (createdBy)      REFERENCES teachers(id)
            );
        `);
    },

    async create({
        name,
        description = null,
        subjectId,
        classLevel,
        passmark = 50,
        totalmark = 100,
        coefficient = 3,
        academicTerm,
        academicYearId,
        examDate = null,
        examStatus = 'Pending',
        createdBy,
    }) {
        await poolConnect;
        const result = await pool.request()
            .input('name', sql.NVarChar(150), name)
            .input('description', sql.NVarChar(500), description)
            .input('subjectId', sql.Int, subjectId)
            .input('classLevel', sql.Int, classLevel)
            .input('passmark', sql.Int, passmark)
            .input('totalmark', sql.Int, totalmark)
            .input('coefficient', sql.Int, coefficient)
            .input('academicTerm', sql.NVarChar(10), academicTerm)
            .input('academicYearId', sql.Int, academicYearId)
            .input('examDate', sql.Date, examDate)
            .input('examStatus', sql.NVarChar(20), examStatus)
            .input('createdBy', sql.Int, createdBy)
            .query(`
                INSERT INTO exams
                    (name, description, subjectId, classLevel, passmark, totalmark,
                     coefficient, academicTerm, academicYearId, examDate, examStatus, createdBy)
                OUTPUT INSERTED.*
                VALUES
                    (@name, @description, @subjectId, @classLevel, @passmark, @totalmark,
                     @coefficient, @academicTerm, @academicYearId, @examDate, @examStatus, @createdBy)
            `);
        return result.recordset[0];
    },

    // Move an exam between 'Pending' | 'Live' | 'Completed'.
    async setStatus(id, status) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar(20), status)
            .query('UPDATE exams SET examStatus = @status WHERE id = @id');
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request().query('SELECT * FROM exams ORDER BY examDate DESC, name');
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM exams WHERE id = @id');
        return result.recordset[0] || null;
    },
};

module.exports = ExamModel;
