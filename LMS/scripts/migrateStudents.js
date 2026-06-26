/**
 * Migrate the students table to use firstName/middleName/lastName + dob/sex/enrollmentYear.
 * Run with: node scripts/migrateStudents.js
 */
const { sql, pool, poolConnect } = require('../config/database');

async function main() {
    await poolConnect;

    // 1. Add new columns (idempotent)
    const cols = ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'sex', 'yearOfEnrollment'];
    for (const c of cols) {
        const exists = await pool.request()
            .query(`SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = '${c}'`);
        if (exists.recordset.length) continue;

        let ddl;
        switch (c) {
            case 'firstName': ddl = "ALTER TABLE students ADD firstName NVARCHAR(100) NULL"; break;
            case 'middleName': ddl = "ALTER TABLE students ADD middleName NVARCHAR(100) NULL"; break;
            case 'lastName': ddl = "ALTER TABLE students ADD lastName NVARCHAR(100) NULL"; break;
            case 'dateOfBirth': ddl = "ALTER TABLE students ADD dateOfBirth DATE NULL"; break;
            case 'sex': ddl = "ALTER TABLE students ADD sex NVARCHAR(10) NULL"; break;
            case 'yearOfEnrollment': ddl = "ALTER TABLE students ADD yearOfEnrollment INT NULL"; break;
        }
        await pool.request().query(ddl);
        console.log(`  Added column ${c}`);
    }

    // 2. Add CHECK constraint for sex if not exists
    const sexCk = await pool.request()
        .query("SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('students') AND name = 'CK_student_sex'");
    if (!sexCk.recordset.length) {
        await pool.request().query("ALTER TABLE students ADD CONSTRAINT CK_student_sex CHECK (sex IN ('Male', 'Female'))");
        console.log('  Added CK_student_sex constraint');
    }

    // 3. Backfill from the old `name` column (split on first space)
    const needFill = await pool.request()
        .query("SELECT COUNT(*) AS c FROM students WHERE firstName IS NULL AND name IS NOT NULL");
    if (needFill.recordset[0].c > 0) {
        await pool.request().query(`
            UPDATE students
            SET firstName = CASE
                    WHEN CHARINDEX(' ', name) > 0 THEN LEFT(name, CHARINDEX(' ', name) - 1)
                    ELSE name
                END,
                lastName = CASE
                    WHEN CHARINDEX(' ', name) > 0 THEN RIGHT(name, LEN(name) - CHARINDEX(' ', name))
                    ELSE name
                END,
                sex = CASE WHEN id % 2 = 0 THEN 'Female' ELSE 'Male' END,
                yearOfEnrollment = 2025
            WHERE firstName IS NULL
        `);
        console.log(`  Backfilled ${needFill.recordset[0].c} rows from 'name' column`);
    }

    // 4. Make firstName/lastName NOT NULL now that data is populated
    const nn1 = await pool.request()
        .query("SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'firstName' AND is_nullable = 1");
    if (nn1.recordset.length) {
        await pool.request().query("ALTER TABLE students ALTER COLUMN firstName NVARCHAR(100) NOT NULL");
        console.log('  Set firstName NOT NULL');
    }
    const nn2 = await pool.request()
        .query("SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'lastName' AND is_nullable = 1");
    if (nn2.recordset.length) {
        await pool.request().query("ALTER TABLE students ALTER COLUMN lastName NVARCHAR(100) NOT NULL");
        console.log('  Set lastName NOT NULL');
    }
    const nn3 = await pool.request()
        .query("SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('students') AND name = 'sex' AND is_nullable = 1");
    if (nn3.recordset.length) {
        await pool.request().query("ALTER TABLE students ALTER COLUMN sex NVARCHAR(10) NOT NULL");
        console.log('  Set sex NOT NULL');
    }

    console.log('\nMigration complete.');
    process.exit(0);
}

main().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
