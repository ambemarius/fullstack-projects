const { sql, pool, poolConnect } = require('../../config/database');

const SubjectScoreModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'subject_scores')
            CREATE TABLE subject_scores (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                student_id       INT NOT NULL,
                class_subject_id INT NOT NULL,
                academic_year_id INT NOT NULL,
                term             NVARCHAR(10) NOT NULL,
                sequence         TINYINT NOT NULL,
                score            DECIMAL(5,2) NOT NULL,
                max_score        DECIMAL(5,2) NOT NULL DEFAULT 50,
                created_by       INT NOT NULL,
                created_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                updated_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT CK_ss_term     CHECK (term IN ('First', 'Second', 'Third')),
                CONSTRAINT CK_ss_sequence CHECK (sequence IN (1, 2)),
                CONSTRAINT UQ_ss UNIQUE (student_id, class_subject_id, academic_year_id, term, sequence),
                CONSTRAINT FK_ss_student  FOREIGN KEY (student_id)       REFERENCES students(id)       ON DELETE CASCADE,
                CONSTRAINT FK_ss_cs       FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
                CONSTRAINT FK_ss_year     FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
            );
        `);
        await this.migrate();
    },

    // created_by may be a teacher OR an admin (both enter marks), so it is not
    // FK-constrained. Drop the old teacher-only FK if it exists.
    async migrate() {
        await poolConnect;
        await pool.request().query(`
            IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ss_teacher')
                ALTER TABLE subject_scores DROP CONSTRAINT FK_ss_teacher;
        `);
    },

    // Get scores for one class-subject-term-sequence
    async getScores(classSubjectId, academicYearId, term, sequence) {
        await poolConnect;
        const result = await pool.request()
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('academicYearId', sql.Int, academicYearId)
            .input('term', sql.NVarChar(10), term)
            .input('sequence', sql.TinyInt, sequence)
            .query(`
                SELECT ss.id, ss.student_id, ss.score, ss.max_score
                FROM subject_scores ss
                WHERE ss.class_subject_id = @classSubjectId
                  AND ss.academic_year_id = @academicYearId
                  AND ss.term = @term
                  AND ss.sequence = @sequence
            `);
        return result.recordset;
    },

    // Upsert a single student's score for a class-subject-term-sequence
    async upsertScore(studentId, classSubjectId, academicYearId, term, sequence, score, maxScore, teacherId) {
        await poolConnect;
        const result = await pool.request()
            .input('studentId', sql.Int, studentId)
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('academicYearId', sql.Int, academicYearId)
            .input('term', sql.NVarChar(10), term)
            .input('sequence', sql.TinyInt, sequence)
            .input('score', sql.Decimal(5, 2), score)
            .input('maxScore', sql.Decimal(5, 2), maxScore)
            .input('teacherId', sql.Int, teacherId)
            .query(`
                MERGE subject_scores AS target
                USING (SELECT @studentId AS student_id, @classSubjectId AS class_subject_id,
                              @academicYearId AS academic_year_id, @term AS term, @sequence AS sequence) AS source
                ON (target.student_id = source.student_id
                    AND target.class_subject_id = source.class_subject_id
                    AND target.academic_year_id = source.academic_year_id
                    AND target.term = source.term
                    AND target.sequence = source.sequence)
                WHEN MATCHED THEN
                    UPDATE SET score = @score, max_score = @maxScore, created_by = @teacherId, updated_at = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (student_id, class_subject_id, academic_year_id, term, sequence, score, max_score, created_by)
                    VALUES (@studentId, @classSubjectId, @academicYearId, @term, @sequence, @score, @maxScore, @teacherId);
            `);
        return result.rowsAffected[0] > 0;
    },

    // Get students in a class with their scores (both sequences) for a subject
    async getClassStudentsWithScores(classId, classSubjectId, academicYearId, term) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('academicYearId', sql.Int, academicYearId)
            .input('term', sql.NVarChar(10), term)
            .query(`
                SELECT s.id, s.firstName, s.middleName, s.lastName, s.matricule, s.sex,
                       ss1.score AS seq1_score, ss1.max_score AS seq1_max,
                       ss2.score AS seq2_score, ss2.max_score AS seq2_max
                FROM students s
                LEFT JOIN subject_scores ss1 ON ss1.student_id = s.id
                    AND ss1.class_subject_id = @classSubjectId
                    AND ss1.academic_year_id = @academicYearId
                    AND ss1.term = @term
                    AND ss1.sequence = 1
                LEFT JOIN subject_scores ss2 ON ss2.student_id = s.id
                    AND ss2.class_subject_id = @classSubjectId
                    AND ss2.academic_year_id = @academicYearId
                    AND ss2.term = @term
                    AND ss2.sequence = 2
                WHERE s.currentClassLevel = @classId AND s.isWithdrawn = 0
                ORDER BY s.lastName, s.firstName
            `);
        return result.recordset;
    },
};

module.exports = SubjectScoreModel;
