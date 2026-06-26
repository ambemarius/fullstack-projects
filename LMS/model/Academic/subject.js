const { sql, pool, poolConnect } = require('../../config/database');

const SubjectModel = {
    // Create the subjects table if it does not already exist.
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'subjects')
            CREATE TABLE subjects (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                name        NVARCHAR(100) NOT NULL,
                code        NVARCHAR(20)  NOT NULL UNIQUE,
                description NVARCHAR(200) NULL,
                coefficient INT NOT NULL DEFAULT 1,
                categories  NVARCHAR(20) NULL,
                subject_master INT NULL,
                class_id    INT NULL,
                hours_per_week INT NOT NULL DEFAULT 4,
                has_lab BIT NOT NULL DEFAULT 0,
                createdAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_subject_master FOREIGN KEY (subject_master) REFERENCES teachers(id),
                CONSTRAINT FK_subject_class FOREIGN KEY (class_id) REFERENCES classes(id),
                CONSTRAINT CK_subjects_categories CHECK (categories IN ('Science', 'Arts', 'Compulsory')),
                CONSTRAINT CK_subjects_coefficient CHECK (coefficient BETWEEN 1 AND 5),
                CONSTRAINT CK_subjects_hours CHECK (hours_per_week BETWEEN 1 AND 10)
            );
        `);
    },

    // Add the newer columns/constraints to an existing subjects table (non-destructive).
    async migrate() {
        await poolConnect;

        const addColumn = async (col, ddl) => {
            const r = await pool.request().input('c', sql.NVarChar(128), col)
                .query("SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('subjects') AND name = @c");
            if (!r.recordset.length) await pool.request().query(`ALTER TABLE subjects ADD ${ddl}`);
        };
        await addColumn('coefficient', 'coefficient INT NOT NULL DEFAULT 1');
        await addColumn('categories', 'categories NVARCHAR(20) NULL');
        await addColumn('subject_master', 'subject_master INT NULL');
        await addColumn('class_id', 'class_id INT NULL');
        await addColumn('hours_per_week', 'hours_per_week INT NOT NULL DEFAULT 4');
        await addColumn('has_lab', 'has_lab BIT NOT NULL DEFAULT 0');

        const addConstraint = async (name, ddl) => {
            const r = await pool.request().input('n', sql.NVarChar(128), name)
                .query('SELECT 1 FROM sys.objects WHERE name = @n');
            if (!r.recordset.length) await pool.request().query(`ALTER TABLE subjects ADD CONSTRAINT ${ddl}`);
        };
        await addConstraint('CK_subjects_coefficient', 'CK_subjects_coefficient CHECK (coefficient BETWEEN 1 AND 5)');
        await addConstraint('CK_subjects_categories', "CK_subjects_categories CHECK (categories IN ('Science', 'Arts', 'Compulsory'))");
        await addConstraint('FK_subject_master', 'FK_subject_master FOREIGN KEY (subject_master) REFERENCES teachers(id)');
        await addConstraint('FK_subject_class', 'FK_subject_class FOREIGN KEY (class_id) REFERENCES classes(id)');
        await addConstraint('CK_subjects_hours', 'CK_subjects_hours CHECK (hours_per_week BETWEEN 1 AND 10)');
    },

    async create({ name, code, description, coefficient = 1, categories, subject_master, class_id, hours_per_week = 4, has_lab = 0 }) {
        await poolConnect;
        const result = await pool.request()
            .input('name', sql.NVarChar(100), name)
            .input('code', sql.NVarChar(20), code)
            .input('description', sql.NVarChar(200), description || null)
            .input('coefficient', sql.Int, coefficient)
            .input('categories', sql.NVarChar(20), categories || null)
            .input('subject_master', sql.Int, subject_master || null)
            .input('class_id', sql.Int, class_id || null)
            .input('hours_per_week', sql.Int, hours_per_week)
            .input('has_lab', sql.Bit, has_lab ? 1 : 0)
            .query(`
                INSERT INTO subjects (name, code, description, coefficient, categories, subject_master, class_id, hours_per_week, has_lab)
                OUTPUT INSERTED.*
                VALUES (@name, @code, @description, @coefficient, @categories, @subject_master, @class_id, @hours_per_week, @has_lab)
            `);
        return result.recordset[0];
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request().query(`
            SELECT s.*,
                   t.name AS subject_master_name,
                   c.name AS class_name
            FROM subjects s
            LEFT JOIN teachers t ON s.subject_master = t.id
            LEFT JOIN classes c ON s.class_id = c.id
            ORDER BY s.name
        `);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT s.*,
                       t.name AS subject_master_name,
                       c.name AS class_name
                FROM subjects s
                LEFT JOIN teachers t ON s.subject_master = t.id
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE s.id = @id
            `);
        return result.recordset[0];
    },

    async findByCode(code) {
        await poolConnect;
        const result = await pool.request()
            .input('code', sql.NVarChar(20), code)
            .query(`
                SELECT s.*,
                       t.name AS subject_master_name,
                       c.name AS class_name
                FROM subjects s
                LEFT JOIN teachers t ON s.subject_master = t.id
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE s.code = @code
            `);
        return result.recordset[0] || null;
    },

    async update(id, { name, code, description, coefficient, categories, subject_master, class_id, hours_per_week, has_lab }) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar(100), name)
            .input('code', sql.NVarChar(20), code)
            .input('description', sql.NVarChar(200), description || null)
            .input('coefficient', sql.Int, coefficient)
            .input('categories', sql.NVarChar(20), categories || null)
            .input('subject_master', sql.Int, subject_master || null)
            .input('class_id', sql.Int, class_id || null)
            .input('hours_per_week', sql.Int, hours_per_week)
            .input('has_lab', sql.Bit, has_lab)
            .query(`
                UPDATE subjects
                SET name = COALESCE(@name, name),
                    code = COALESCE(@code, code),
                    description = COALESCE(@description, description),
                    coefficient = COALESCE(@coefficient, coefficient),
                    categories = COALESCE(@categories, categories),
                    subject_master = COALESCE(@subject_master, subject_master),
                    class_id = COALESCE(@class_id, class_id),
                    hours_per_week = COALESCE(@hours_per_week, hours_per_week),
                    has_lab = COALESCE(@has_lab, has_lab)
                WHERE id = @id;
                SELECT * FROM subjects WHERE id = @id;
            `);
        return result.recordset[0] || null;
    },

    async remove(id) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM subjects WHERE id = @id');
    },
};

module.exports = SubjectModel;
