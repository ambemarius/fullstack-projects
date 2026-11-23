// Exports the scheduler input from the LMS database. Read-only: it runs SELECT queries only.
//
//   node scripts/timetable/exportInputs.js <out.json> [--year <academic_year_id>]
//
// Uses config/.env (DB_STRING). Defaults to the current academic year (academic_years.isCurrent = 1).
// Only class subjects with a periods-per-week allocation for that year are exported, so subjects that are
// linked to a class but never allocated (for example duplicate or abandoned subjects) are left out.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
process.chdir(ROOT);
const { loadEnvironment } = require(path.join(ROOT, 'config', 'environment'));
loadEnvironment();
const db = require(path.join(ROOT, 'config', 'database'));
const { sql } = db;

const args = process.argv.slice(2);
const outFile = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--year');
const yearArg = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null;
if (!outFile || (args.includes('--year') && !Number.isInteger(yearArg))) {
    console.error('Usage: node scripts/timetable/exportInputs.js <out.json> [--year <academic_year_id>]');
    process.exit(2);
}

(async () => {
    await db.connect();
    const request = () => db.pool.request();
    try {
        const year = yearArg
            ? (await request().input('id', sql.Int, yearArg).query('SELECT id, name FROM academic_years WHERE id = @id')).recordset[0]
            : (await request().query('SELECT TOP 1 id, name FROM academic_years WHERE isCurrent = 1 ORDER BY id DESC')).recordset[0];
        if (!year) throw new Error(yearArg ? `Academic year ${yearArg} not found.` : 'No current academic year is set.');

        const periods = (await request().query('SELECT id, start_time, end_time FROM time_slots WHERE is_break = 0 ORDER BY sort_order')).recordset
            .map(s => ({ slotId: s.id, label: `${s.start_time}-${s.end_time}` }));

        const rows = (await request().input('year', sql.Int, year.id).query(`
            SELECT c.id AS class_id, c.section, LTRIM(c.name + ISNULL(' ' + c.stream, '')) AS class_name,
                   s.id AS subject_id, s.name AS subject, a.periods_week,
                   t.id AS teacher_id, t.name AS teacher
            FROM class_subjects cs
            JOIN classes c ON c.id = cs.class_id
            JOIN subjects s ON s.id = cs.subject_id
            JOIN subject_allocations a ON a.class_id = cs.class_id AND a.subject_id = cs.subject_id AND a.academic_year_id = @year
            LEFT JOIN class_subject_teachers cst ON cst.class_subject_id = cs.id AND cst.assignment_status = 'active'
            LEFT JOIN teachers t ON t.id = cst.teacher_id AND t.status = 'active'
            ORDER BY c.section, c.rank, s.name`)).recordset;

        const out = { exportedAt: new Date().toISOString(), academicYear: year, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], periods, rows };
        fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
        fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
        const unassigned = new Set(rows.filter(r => r.teacher_id == null).map(r => `${r.class_name} ${r.subject}`));
        console.log(`Exported ${rows.length} rows for ${year.name}: ${new Set(rows.map(r => r.class_id)).size} classes, ${periods.length} periods/day, ${new Set(rows.filter(r => r.teacher_id).map(r => r.teacher_id)).size} teachers -> ${outFile}`);
        if (unassigned.size) console.warn(`Warning: ${unassigned.size} class subjects have no active teacher and cannot be scheduled.`);
    } finally {
        await db.close();
    }
})().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
