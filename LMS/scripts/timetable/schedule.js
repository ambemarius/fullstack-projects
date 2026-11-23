// Command-line wrapper for the timetable scheduler (utils/timetableScheduler.js).
//
//   node scripts/timetable/schedule.js <input.json> <outDir> [--study]
//
// Input: the JSON written by exportInputs.js, optionally adjusted by addTeachers.js.
// Writes <outDir>/timetable_report.md (validation, loads, shortfalls, class and teacher grids)
// and <outDir>/timetable.json. Reads nothing from and writes nothing to the database.
const fs = require('node:fs');
const path = require('node:path');
const { buildTimetable, renderReport, toJson } = require('../../utils/timetableScheduler');

const [inputFile, outDir] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!inputFile || !outDir) {
    console.error('Usage: node scripts/timetable/schedule.js <input.json> <outDir> [--study]');
    process.exit(2);
}
try {
    const result = buildTimetable(JSON.parse(fs.readFileSync(inputFile, 'utf8')), { study: process.argv.includes('--study') });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'timetable_report.md'), renderReport(result));
    fs.writeFileSync(path.join(outDir, 'timetable.json'), JSON.stringify(toJson(result), null, 1));
    console.log(result.validation);
    console.log(`Report: ${path.join(outDir, 'timetable_report.md')}`);
    if (!result.validation.valid) process.exitCode = 1;
} catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
}
