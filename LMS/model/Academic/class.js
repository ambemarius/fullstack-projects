const { sql, pool, poolConnect } = require('../../config/database');

// The school has two sections, each with 7 levels (ranked 1 lowest .. 7 highest).
// Streams (Normal / Bilingual) exist ONLY in the Anglophone section;
// Francophone classes have no stream (stored as NULL).
const SECTIONS = [
    {
        section: 'Anglophone',
        streams: ['Normal', 'Bilingual'],
        levels: [
            { name: 'Form1', rank: 1 },
            { name: 'Form2', rank: 2 },
            { name: 'Form3', rank: 3 },
            { name: 'Form4', rank: 4 },
            { name: 'Form5', rank: 5 },
            { name: 'LowerSixth', rank: 6 },
            { name: 'UpperSixth', rank: 7 },
        ],
    },
    {
        section: 'Francophone',
        streams: [null], // no stream split
        levels: [
            { name: '6ème', rank: 1 },
            { name: '5ème', rank: 2 },
            { name: '4ème', rank: 3 },
            { name: '3ème', rank: 4 },
            { name: '2nde', rank: 5 },
            { name: '1ère', rank: 6 },
            { name: 'Terminale', rank: 7 },
        ],
    },
];

// Anglophone 7x2 + Francophone 7x1 = 21 classes.
const DEFAULT_CLASSES = SECTIONS.flatMap(s =>
    s.levels.flatMap(level =>
        s.streams.map(stream => ({
            section: s.section,
            name: level.name,
            stream,
            rank: level.rank,
        }))
    )
);

const ClassModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'classes')
            CREATE TABLE classes (
                id      INT IDENTITY(1,1) PRIMARY KEY,
                section NVARCHAR(20) NOT NULL,
                name    NVARCHAR(50) NOT NULL,
                stream  NVARCHAR(20) NULL,
                rank    INT NOT NULL,
                class_master_id INT NULL,
                registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
                tuition_fee      DECIMAL(10,2) NOT NULL DEFAULT 0,
                pta_fee          DECIMAL(10,2) NOT NULL DEFAULT 0,
                caution_fee      DECIMAL(10,2) NOT NULL DEFAULT 0,
                practicals_fee   DECIMAL(10,2) NOT NULL DEFAULT 0,
                option_name      NVARCHAR(100) NULL,
                CONSTRAINT UQ_class UNIQUE (section, name, stream),
                CONSTRAINT FK_class_master FOREIGN KEY (class_master_id) REFERENCES teachers(id)
            );
        `);
    },

    // Insert all 21 classes if they are not already there (idempotent, NULL-safe).
    async seedDefaults() {
        await poolConnect;
        for (const c of DEFAULT_CLASSES) {
            await pool.request()
                .input('section', sql.NVarChar(20), c.section)
                .input('name', sql.NVarChar(50), c.name)
                .input('stream', sql.NVarChar(20), c.stream)
                .input('rank', sql.Int, c.rank)
                .query(`
                    IF NOT EXISTS (
                        SELECT 1 FROM classes
                        WHERE section = @section AND name = @name
                          AND ((stream IS NULL AND @stream IS NULL) OR stream = @stream)
                    )
                    INSERT INTO classes (section, name, stream, rank)
                    VALUES (@section, @name, @stream, @rank);
                `);
        }
    },

    async migrate() {
        await poolConnect;
        const cols = ['class_master_id', 'registration_fee', 'tuition_fee', 'pta_fee', 'caution_fee', 'practicals_fee', 'option_name'];
        for (const c of cols) {
            const exists = await pool.request()
                .query(`SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('classes') AND name = '${c}'`);
            if (exists.recordset.length) continue;
            let ddl;
            switch (c) {
                case 'class_master_id': ddl = "ALTER TABLE classes ADD class_master_id INT NULL"; break;
                case 'registration_fee': ddl = "ALTER TABLE classes ADD registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;
                case 'tuition_fee': ddl = "ALTER TABLE classes ADD tuition_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;
                case 'pta_fee': ddl = "ALTER TABLE classes ADD pta_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;
                case 'caution_fee': ddl = "ALTER TABLE classes ADD caution_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;
                case 'practicals_fee': ddl = "ALTER TABLE classes ADD practicals_fee DECIMAL(10,2) NOT NULL DEFAULT 0"; break;
                case 'option_name': ddl = "ALTER TABLE classes ADD option_name NVARCHAR(100) NULL"; break;
            }
            await pool.request().query(ddl);
        }
        // Add FK if missing
        const fkExists = await pool.request()
            .query("SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('classes') AND name = 'FK_class_master'");
        if (!fkExists.recordset.length) {
            try {
                await pool.request().query("ALTER TABLE classes ADD CONSTRAINT FK_class_master FOREIGN KEY (class_master_id) REFERENCES teachers(id)");
            } catch (_) { /* FK may fail if referenced column doesn't exist */ }
        }
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request()
            .query(`SELECT c.*, t.name AS class_master_name,
                    CASE WHEN c.rank <= 5 THEN 'Secondary' ELSE 'Advanced' END AS schoolLevel
                    FROM classes c
                    LEFT JOIN teachers t ON t.id = c.class_master_id
                    ORDER BY c.section, c.rank, c.stream`);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT c.*, t.name AS class_master_name,
                    CASE WHEN c.rank <= 5 THEN 'Secondary' ELSE 'Advanced' END AS schoolLevel
                    FROM classes c
                    LEFT JOIN teachers t ON t.id = c.class_master_id
                    WHERE c.id = @id`);
        return result.recordset[0] || null;
    },

    async updateClass(id, { class_master_id, registration_fee, tuition_fee, pta_fee, caution_fee, practicals_fee, option_name }) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('class_master_id', sql.Int, class_master_id || null)
            .input('registration_fee', sql.Decimal(10,2), registration_fee ?? 0)
            .input('tuition_fee', sql.Decimal(10,2), tuition_fee ?? 0)
            .input('pta_fee', sql.Decimal(10,2), pta_fee ?? 0)
            .input('caution_fee', sql.Decimal(10,2), caution_fee ?? 0)
            .input('practicals_fee', sql.Decimal(10,2), practicals_fee ?? 0)
            .input('option_name', sql.NVarChar(100), option_name || null)
            .query(`
                UPDATE classes
                SET class_master_id = @class_master_id,
                    registration_fee = @registration_fee,
                    tuition_fee = @tuition_fee,
                    pta_fee = @pta_fee,
                    caution_fee = @caution_fee,
                    practicals_fee = @practicals_fee,
                    option_name = @option_name
                WHERE id = @id;
                SELECT c.*, t.name AS class_master_name
                FROM classes c
                LEFT JOIN teachers t ON t.id = c.class_master_id
                WHERE c.id = @id;
            `);
        return result.recordset[0] || null;
    },
};

module.exports = ClassModel;
