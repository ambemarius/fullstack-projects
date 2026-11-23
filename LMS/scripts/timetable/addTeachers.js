// "What if" staffing: adds hypothetical teachers to a scheduler input file. Never touches the database.
//
//   node scripts/timetable/addTeachers.js <in.json> <out.json> [--split <spec>] [--cover <spec>]
//
// --split  "Mathematics:3,Chemistry:3,English Language:2"
//          The subject's current teacher plus new teachers, total N. Classes are shared out so each teacher
//          carries a near-equal load, and every class keeps a single teacher for that subject.
// --cover  "French,Geography,History,Literature:2"
//          One new cover teacher takes the subject in N classes for each listed subject.
//
// Hypothetical teachers get negative ids and names ending in "(new)", so they cannot collide with real ones.
const fs = require('node:fs');

function splitSubjects(input, spec, nextId) {
    const plan = {};
    for (const part of spec.split(',').map(s => s.trim()).filter(Boolean)) {
        const [subject, sizeText] = part.split(':');
        const size = Number(sizeText);
        if (!subject || !Number.isInteger(size) || size < 2) throw new Error(`Bad --split entry "${part}" (expected Subject:N with N >= 2)`);
        const rows = input.rows.filter(r => r.subject === subject && r.teacher_id != null);
        if (!rows.length) throw new Error(`No assigned rows for subject "${subject}"`);
        // The main teacher is the one assigned to the most classes; extra co-teachers on a class are left as they are.
        const counts = rows.reduce((m, r) => m.set(r.teacher_id, (m.get(r.teacher_id) || 0) + 1), new Map());
        const mainId = [...counts].sort((a, b) => b[1] - a[1])[0][0];
        const team = [{ id: mainId, name: rows.find(r => r.teacher_id === mainId).teacher, load: 0 }];
        for (let i = 2; i <= size; i++) team.push({ id: nextId(), name: `${subject} Teacher ${i} (new)`, load: 0 });
        const mine = rows.filter(r => r.teacher_id === mainId).sort((a, b) => b.periods_week - a.periods_week || a.class_id - b.class_id);
        for (const r of mine) {
            const t = team.reduce((min, x) => (x.load < min.load ? x : min));
            t.load += r.periods_week;
            r.teacher_id = t.id; r.teacher = t.name;
        }
        plan[subject] = team.map(t => ({ teacher: t.name, id: t.id, periods: t.load }));
    }
    return plan;
}

function addCover(input, spec, nextId) {
    const [subjectsText, perText] = spec.split(':');
    const per = Number(perText);
    if (!subjectsText || !Number.isInteger(per) || per < 1) throw new Error(`Bad --cover "${spec}" (expected Subject,Subject:N)`);
    const cover = { id: nextId(), name: 'Cover Teacher (new)' };
    const moved = [];
    for (const subject of subjectsText.split(',').map(s => s.trim())) {
        const rows = input.rows.filter(r => r.subject === subject && r.teacher_id != null);
        if (!rows.length) throw new Error(`No assigned rows for subject "${subject}"`);
        const counts = rows.reduce((m, r) => m.set(r.teacher_id, (m.get(r.teacher_id) || 0) + 1), new Map());
        const mainId = [...counts].sort((a, b) => b[1] - a[1])[0][0];
        for (const r of rows.filter(x => x.teacher_id === mainId).sort((a, b) => b.class_id - a.class_id).slice(0, per)) {
            r.teacher_id = cover.id; r.teacher = cover.name;
            moved.push(`${r.class_name} ${subject} (${r.periods_week})`);
        }
    }
    return { teacher: cover.name, id: cover.id, takes: moved };
}

function addTeachers(input, { split, cover } = {}) {
    const out = JSON.parse(JSON.stringify(input));
    let next = Math.min(0, ...out.rows.map(r => r.teacher_id ?? 0));
    const nextId = () => --next;
    const plan = {};
    if (split) plan.split = splitSubjects(out, split, nextId);
    if (cover) plan.cover = addCover(out, cover, nextId);
    out.hypothetical = [...(input.hypothetical || []), plan];
    return { input: out, plan };
}

module.exports = { addTeachers };

if (require.main === module) {
    const args = process.argv.slice(2);
    const flag = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
    const positional = args.filter((a, i) => !a.startsWith('--') && !['--split', '--cover'].includes(args[i - 1]));
    const [inFile, outFile] = positional;
    if (!inFile || !outFile || (!flag('--split') && !flag('--cover'))) {
        console.error('Usage: node scripts/timetable/addTeachers.js <in.json> <out.json> [--split "Subject:N,..."] [--cover "Subject,Subject:N"]');
        process.exit(2);
    }
    try {
        const { input, plan } = addTeachers(JSON.parse(fs.readFileSync(inFile, 'utf8')), { split: flag('--split'), cover: flag('--cover') });
        fs.writeFileSync(outFile, JSON.stringify(input, null, 1));
        console.log(JSON.stringify(plan, null, 2));
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}
