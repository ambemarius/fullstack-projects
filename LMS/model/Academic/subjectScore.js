const { sql, pool, poolConnect } = require('../../config/database');

async function requestFor(transaction) {
    if (transaction) return new sql.Request(transaction);
    await poolConnect;
    return pool.request();
}

const SubjectScoreModel = {
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

    // Upsert one mark and record the change. Accepts an object
    // ({ studentId, classSubjectId, academicYearId, term, sequence, score, maxScore, actorId, actorType })
    // or the older positional form; pass { transaction } to join a caller's transaction.
    async upsertScore(data, ...rest) {
        let row, options = {};
        if (data && typeof data === 'object') {
            row = data;
            options = rest[0] || {};
        } else {
            const [classSubjectId, academicYearId, term, sequence, score, maxScore, actorId] = rest;
            row = { studentId: data, classSubjectId, academicYearId, term, sequence, score, maxScore, actorId };
        }
        const request = await requestFor(options.transaction);
        const result = await request
            .input('studentId', sql.Int, row.studentId)
            .input('classSubjectId', sql.Int, row.classSubjectId)
            .input('academicYearId', sql.Int, row.academicYearId)
            .input('term', sql.NVarChar(10), row.term)
            .input('sequence', sql.TinyInt, row.sequence)
            .input('score', sql.Decimal(5, 2), row.score)
            .input('maxScore', sql.Decimal(5, 2), row.maxScore)
            .input('actorId', sql.Int, row.actorId)
            .input('actorType', sql.NVarChar(20), row.actorType || 'teacher')
            .query(`
                DECLARE @old DECIMAL(5,2) = (
                    SELECT score FROM subject_scores
                    WHERE student_id = @studentId AND class_subject_id = @classSubjectId
                      AND academic_year_id = @academicYearId AND term = @term AND sequence = @sequence);
                MERGE subject_scores AS target
                USING (SELECT @studentId AS student_id, @classSubjectId AS class_subject_id,
                              @academicYearId AS academic_year_id, @term AS term, @sequence AS sequence) AS source
                ON (target.student_id = source.student_id
                    AND target.class_subject_id = source.class_subject_id
                    AND target.academic_year_id = source.academic_year_id
                    AND target.term = source.term
                    AND target.sequence = source.sequence)
                WHEN MATCHED THEN
                    UPDATE SET score = @score, max_score = @maxScore, updated_by = @actorId, updated_at = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (student_id, class_subject_id, academic_year_id, term, sequence, score, max_score, created_by, updated_by)
                    VALUES (@studentId, @classSubjectId, @academicYearId, @term, @sequence, @score, @maxScore, @actorId, @actorId);
                IF @old IS NULL OR @old <> @score
                INSERT INTO subject_score_history
                    (score_id, class_subject_id, student_id, academic_year_id, term, sequence, old_score, new_score, changed_by, changed_by_type)
                SELECT id, class_subject_id, student_id, academic_year_id, term, sequence, @old, @score, @actorId, @actorType
                FROM subject_scores
                WHERE student_id = @studentId AND class_subject_id = @classSubjectId
                  AND academic_year_id = @academicYearId AND term = @term AND sequence = @sequence;
            `);
        return (result.rowsAffected || []).some(count => count > 0);
    },

    async getHistory(studentId, classSubjectId, academicYearId) {
        await poolConnect;
        const result = await pool.request()
            .input('studentId', sql.Int, studentId)
            .input('classSubjectId', sql.Int, classSubjectId)
            .input('academicYearId', sql.Int, academicYearId)
            .query(`
                SELECT term, sequence, old_score, new_score, changed_by, changed_by_type, changed_at
                FROM subject_score_history
                WHERE student_id = @studentId AND class_subject_id = @classSubjectId AND academic_year_id = @academicYearId
                ORDER BY changed_at DESC
            `);
        return result.recordset;
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
                  -- Only students enrolled in this subject for the year: the same rule saving enforces.
                  AND EXISTS (SELECT 1 FROM class_subject_students css
                              WHERE css.class_subject_id = @classSubjectId AND css.student_id = s.id AND css.academic_year_id = @academicYearId)
                ORDER BY s.lastName, s.firstName
            `);
        return result.recordset;
    },

    async getReportForStudent(studentId) {
        await poolConnect;
        const result = await pool.request()
            .input('studentId', sql.Int, studentId)
            .query(`SELECT ss.term, ss.sequence, ss.score, ss.max_score,
                           subj.name AS subjectName, subj.code AS subjectCode,
                           ss.academic_year_id AS yearId, ay.name AS yearName, ay.isCurrent AS yearIsCurrent
                    FROM subject_scores ss
                    JOIN class_subjects cs ON cs.id = ss.class_subject_id
                    JOIN subjects subj ON subj.id = cs.subject_id
                    LEFT JOIN academic_years ay ON ay.id = ss.academic_year_id
                    WHERE ss.student_id = @studentId
                    ORDER BY ss.term, subj.name, ss.sequence`);
        return result.recordset;
    },
};

module.exports = SubjectScoreModel;
