const { sql, pool, poolConnect } = require('../../config/database');

/**
 * Links subjects to classes, and teachers to those class-subjects per term.
 *
 *   class_subjects          -> a subject offered in a class (e.g. Form2 + Math).
 *                              Curriculum-level, so it is NOT repeated per term.
 *   class_subject_teachers  -> who teaches it, in which term. One row =
 *                              "teacher T teaches this class-subject in term X".
 *                              Same (class_subject, term) with >1 teacher = co-teaching.
 */
const ClassSubjectModel = {
    async createTable() {
        await poolConnect;

        // The offering: a subject taught in a class.
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'class_subjects')
            CREATE TABLE class_subjects (
                id           INT IDENTITY(1,1) PRIMARY KEY,
                class_id     INT NOT NULL,
                subject_id   INT NOT NULL,
                coefficient  DECIMAL(4,2) NOT NULL DEFAULT 1,
                createdAt    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_class_subject UNIQUE (class_id, subject_id),
                CONSTRAINT FK_cs_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
                CONSTRAINT FK_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            );
        `);

        await poolConnect;
        await pool.request().query(`
            IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('class_subjects') AND name = 'coefficient')
                AND (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('class_subjects') AND name = 'coefficient' AND is_nullable = 1)
                ALTER TABLE class_subjects ALTER COLUMN coefficient DECIMAL(4,2) NOT NULL;
        `);

        // The teacher assignment(s) for an offering.
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'class_subject_teachers')
            CREATE TABLE class_subject_teachers (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                class_subject_id INT NOT NULL,
                teacher_id       INT NOT NULL,
                term             NVARCHAR(10) NOT NULL,
                createdAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT UQ_cst UNIQUE (class_subject_id, teacher_id, term),
                CONSTRAINT CK_cst_term CHECK (term IN ('First', 'Second', 'Third')),
                CONSTRAINT FK_cst_cs      FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE,
                CONSTRAINT FK_cst_teacher FOREIGN KEY (teacher_id)       REFERENCES teachers(id)       ON DELETE CASCADE
            );
        `);
    },

    // Offer a subject in EVERY class (idempotent). Returns the rows that now exist.
    async offerInAllClasses(subjectId, coefficient = 1) {
        await poolConnect;
        await pool.request()
            .input('subjectId', sql.Int, subjectId)
            .input('coefficient', sql.Decimal(4, 2), coefficient)
            .query(`
                INSERT INTO class_subjects (class_id, subject_id, coefficient)
                SELECT c.id, @subjectId, @coefficient
                FROM classes c
                WHERE NOT EXISTS (
                    SELECT 1 FROM class_subjects cs
                    WHERE cs.class_id = c.id AND cs.subject_id = @subjectId
                );
            `);
        const result = await pool.request()
            .input('subjectId', sql.Int, subjectId)
            .query('SELECT * FROM class_subjects WHERE subject_id = @subjectId');
        return result.recordset;
    },

    // Offer a single subject in a single class (idempotent). Returns the offering row.
    async offer(classId, subjectId, coefficient = 1) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .input('subjectId', sql.Int, subjectId)
            .input('coefficient', sql.Decimal(4, 2), coefficient)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM class_subjects WHERE class_id = @classId AND subject_id = @subjectId)
                INSERT INTO class_subjects (class_id, subject_id, coefficient) VALUES (@classId, @subjectId, @coefficient);
            `);
        return this.findOffering(classId, subjectId);
    },

    // Map of which teacher teaches each subject in a class for a term: [{ subject_id, teacher_id }]
    async getTeacherMap(classId, term) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .input('term', sql.NVarChar(10), term)
            .query(`
                SELECT cs.subject_id, cst.teacher_id
                FROM class_subjects cs
                JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id
                WHERE cs.class_id = @classId AND cst.term = @term
            `);
        return result.recordset;
    },

    async findOffering(classId, subjectId) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .input('subjectId', sql.Int, subjectId)
            .query('SELECT * FROM class_subjects WHERE class_id = @classId AND subject_id = @subjectId');
        return result.recordset[0] || null;
    },

    async findOfferingById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM class_subjects WHERE id = @id');
        return result.recordset[0] || null;
    },

    // Assign a teacher to a class-subject for a term ('First' | 'Second' | 'Third').
    // Call again with another teacher (same term) to co-teach.
    async assignTeacher(classSubjectId, teacherId, term) {
        await poolConnect;
        await pool.request()
            .input('csId', sql.Int, classSubjectId)
            .input('teacherId', sql.Int, teacherId)
            .input('term', sql.NVarChar(10), term)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM class_subject_teachers
                    WHERE class_subject_id = @csId AND teacher_id = @teacherId AND term = @term
                )
                INSERT INTO class_subject_teachers (class_subject_id, teacher_id, term)
                VALUES (@csId, @teacherId, @term);
            `);
    },

    // Everything a teacher teaches: which subject, in which class, which term.
    async getTeacherTeaching(teacherId) {
        await poolConnect;
        const result = await pool.request()
            .input('teacherId', sql.Int, teacherId)
            .query(`
                SELECT cst.term,
                       cs.id   AS classSubjectId,
                       c.id    AS classId,
                       c.section, c.name AS className, c.stream,
                       s.id    AS subjectId,
                       s.name  AS subject,
                       s.code  AS code
                FROM class_subject_teachers cst
                JOIN class_subjects cs ON cs.id = cst.class_subject_id
                JOIN classes c         ON c.id = cs.class_id
                JOIN subjects s        ON s.id = cs.subject_id
                WHERE cst.teacher_id = @teacherId
                ORDER BY c.section, c.rank, s.name, cst.term
            `);
        return result.recordset;
    },

    // All subjects + their teacher(s) for one class, optionally filtered to a term.
    // A subject taught by two teachers in a term appears as two rows (co-teaching);
    // an unassigned subject has term/teacher = NULL.
    async getClassSubjects(classId, term = null) {
        await poolConnect;
        const request = pool.request().input('classId', sql.Int, classId);

        let termFilter = '';
        if (term) {
            request.input('term', sql.NVarChar(10), term);
            termFilter = 'AND cst.term = @term';
        }

        const result = await request.query(`
            SELECT cs.id   AS classSubjectId,
                   s.id    AS subjectId,
                   s.name  AS subject,
                   s.code  AS code,
                   cst.term AS term,
                   t.id    AS teacherId,
                   t.name  AS teacher
            FROM class_subjects cs
            JOIN subjects s          ON s.id = cs.subject_id
            LEFT JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id ${termFilter}
            LEFT JOIN teachers t     ON t.id = cst.teacher_id
            WHERE cs.class_id = @classId
            ORDER BY s.name, cst.term, t.name;
        `);
        return result.recordset;
    },
};

module.exports = ClassSubjectModel;
