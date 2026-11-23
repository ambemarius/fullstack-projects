// Exports the scheduler input from the LMS database. Read-only: it runs SELECT queries only.
//
//   node scripts/timetable/exportInputs.js <out.json> [--year <academic_year_id>]
//
// Uses config/.env (DB_STRING). Defaults to the current academic year (academic_years.isCurrent = 1).
// Same query as the admin "Generate whole timetable" action (model/Academic/timetableGenerator.js): only class
// subjects with a periods-per-week allocation for that year, and only active assignments and teachers.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
process.chdir(ROOT);
const { loadEnvironment } = require(path.join(ROOT, 'config', 'environment'));
loadEnvironment();
const db = require(path.join(ROOT, 'config', 'database'));
const { loadSchedulerInput } = require(path.join(ROOT, 'model', 'Academic', 'timetableGenerator'));

const args = process.argv.slice(2);
const yearIndex = args.indexOf('--year');
const yearArg = yearIndex >= 0 ? Number(args[yearIndex + 1]) : null;
const outFile = args.find((a, i) => !a.startsWith('--') && i !== yearIndex + 1);
if (!outFile || (yearIndex >= 0 && !Number.isInteger(yearArg))) {
    console.error('Usage: node scripts/timetable/exportInputs.js <out.json> [--year <academic_year_id>]');
    process.exit(2);
}

(async () => {
    await db.connect();
    const query = (statement, params = {}) => {
        const r = db.pool.request();
        for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value);
        return r.query(statement);
    };
    try {
        const yearId = yearArg ?? (await query('SELECT TOP 1 id FROM academic_years WHERE isCurrent = 1 ORDER BY id DESC')).recordset[0]?.id;
        if (!yearId) throw new Error('No current academic year is set; pass --year <id>.');
        const input = await loadSchedulerInput(query, yearId);
        const out = { exportedAt: new Date().toISOString(), ...input };
        fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
        fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
        const { rows, periods, academicYear } = input;
        console.log(`Exported ${rows.length} rows for ${academicYear.name}: ${new Set(rows.map(r => r.class_id)).size} classes, ${periods.length} periods/day, ${new Set(rows.filter(r => r.teacher_id).map(r => r.teacher_id)).size} teachers -> ${outFile}`);
        const unassigned = new Set(rows.filter(r => r.teacher_id == null).map(r => `${r.class_name} ${r.subject}`));
        if (unassigned.size) console.warn(`Warning: ${unassigned.size} class subjects have no active teacher and cannot be scheduled.`);
    } finally {
        await db.close();
    }
})().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
