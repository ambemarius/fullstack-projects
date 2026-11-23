// Weekly timetable scheduler (pure: no database, no files). Used by the admin "Generate whole timetable"
// action (model/Academic/timetableGenerator.js) and by the command-line tool scripts/timetable/schedule.js.
//
// Input: { days: [...], periods: [{ slotId, label, start, end }], rows: [{ class_id, section, class_name,
//   subject_id, subject, periods_week, teacher_id, teacher }] }   (one row per class/subject/teacher;
//   several teachers on one class subject = shared, any of them may take a period)
//
// Hard rules (never broken): no teacher in two classes at once, no class with two lessons at once,
// no subject scheduled beyond its weekly periods, no teacher over the slots in a week.
// Objective: place as many required periods as possible, fairly (the subject furthest behind goes first),
// spread across the week (max ceil(periods/days) per day, relaxed by one only if needed), keeping a teacher
// in the same room for consecutive periods where possible.
// { study: true } fills every remaining class slot with a study period supervised by a free teacher.
const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function normaliseInput(input) {
    if (Array.isArray(input)) throw new Error('Input must be the object written by exportInputs.js ({ days, periods, rows }).');
    const days = input.days?.length ? input.days : DEFAULT_DAYS;
    const periods = (input.periods || []).map(p => (typeof p === 'string' ? { slotId: null, label: p } : p));
    if (!periods.length) throw new Error('Input has no teaching periods.');
    return { days, periods, rows: input.rows || [] };
}

function buildTimetable(rawInput, { study = false } = {}) {
    const { days: DAYS, periods: PERIODS, rows } = normaliseInput(rawInput);
    const D = DAYS.length, P = PERIODS.length, MAX_SLOTS = D * P;

    // ---- Demand: one tuple per (class, subject); eligible teachers = all assigned ----
    const classes = new Map(), tuples = new Map(), teachers = new Map();
    for (const r of rows) {
        if (!classes.has(r.class_id)) classes.set(r.class_id, { id: r.class_id, name: `${r.class_name}`.trim(), section: r.section });
        if (!(r.periods_week > 0)) continue;
        const key = `${r.class_id}:${r.subject_id}`;
        if (!tuples.has(key)) tuples.set(key, { key, classId: r.class_id, subjectId: r.subject_id, subject: r.subject, required: r.periods_week, teachers: [], placed: 0, perDay: Array(D).fill(0) });
        const t = tuples.get(key);
        if (r.teacher_id != null && !t.teachers.includes(r.teacher_id)) t.teachers.push(r.teacher_id);
        if (r.teacher_id != null && !teachers.has(r.teacher_id)) teachers.set(r.teacher_id, { id: r.teacher_id, name: r.teacher, demand: 0, placed: 0, supervision: 0 });
    }
    for (const t of tuples.values()) for (const id of t.teachers) teachers.get(id).demand += t.required / t.teachers.length;

    const emptyWeek = () => Array.from({ length: D }, () => Array(P).fill(null));
    const classGrid = new Map([...classes.keys()].map(id => [id, emptyWeek()]));
    const teacherGrid = new Map([...teachers.keys()].map(id => [id, emptyWeek()]));
    const byClass = new Map([...classes.keys()].map(id => [id, [...tuples.values()].filter(t => t.classId === id)]));
    const dailyCap = t => Math.ceil(t.required / D);

    function place(classId, tuple, tid, d, p) {
        classGrid.get(classId)[d][p] = { subjectId: tuple.subjectId, subject: tuple.subject, teacherId: tid };
        teacherGrid.get(tid)[d][p] = { classId, subjectId: tuple.subjectId, subject: tuple.subject };
        tuple.placed++; tuple.perDay[d]++; teachers.get(tid).placed++;
    }
    function unplace(classId, tuple, tid, d, p) {
        classGrid.get(classId)[d][p] = null; teacherGrid.get(tid)[d][p] = null;
        tuple.placed--; tuple.perDay[d]--; teachers.get(tid).placed--;
    }

    // ---- 1. Slot-by-slot bipartite matching (classes -> teachers), augmenting paths with prioritised edges ----
    const candidates = (classId, d) => byClass.get(classId)
        .filter(t => t.teachers.length && t.placed < t.required && t.perDay[d] < dailyCap(t))
        .sort((a, b) => (a.placed / a.required) - (b.placed / b.required) || b.required - a.required);
    for (let d = 0; d < D; d++) {
        for (let p = 0; p < P; p++) {
            const taken = new Map(); // teacherId -> { classId, tuple }
            const urgency = id => { const c = candidates(id, d)[0]; return c ? c.placed / c.required : Infinity; };
            const order = [...classes.keys()].sort((a, b) => urgency(a) - urgency(b));
            const tryAssign = (classId, seen) => {
                for (const tuple of candidates(classId, d)) {
                    const stayed = id => (p > 0 && teacherGrid.get(id)[d][p - 1]?.classId === classId ? 1 : 0);
                    for (const tid of [...tuple.teachers].sort((x, y) => stayed(y) - stayed(x))) {
                        if (seen.has(tid)) continue;
                        seen.add(tid);
                        const holder = taken.get(tid);
                        if (!holder || tryAssign(holder.classId, seen)) { taken.set(tid, { classId, tuple }); return true; }
                    }
                }
                return false;
            };
            for (const cid of order) tryAssign(cid, new Set());
            for (const [tid, { classId, tuple }] of taken) place(classId, tuple, tid, d, p);
        }
    }

    // ---- 2. Repair: place leftovers directly, or by moving one blocking lesson of the same teacher ----
    const allSlots = [];
    for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) allSlots.push([d, p]);
    let repaired = 0;
    for (const relax of [0, 1]) {
        const capOk = (t, d) => t.perDay[d] < dailyCap(t) + relax;
        for (const tuple of tuples.values()) {
            while (tuple.placed < tuple.required) {
                let done = false;
                for (const tid of tuple.teachers) {
                    const free = allSlots.find(([d, p]) => capOk(tuple, d) && !classGrid.get(tuple.classId)[d][p] && !teacherGrid.get(tid)[d][p]);
                    if (free) { place(tuple.classId, tuple, tid, ...free); done = true; break; }
                    for (const [d, p] of allSlots) {
                        if (!capOk(tuple, d) || classGrid.get(tuple.classId)[d][p] || !teacherGrid.get(tid)[d][p]) continue;
                        const { classId: x, subjectId } = teacherGrid.get(tid)[d][p];
                        const other = tuples.get(`${x}:${subjectId}`);
                        if (!other) continue;
                        const dest = allSlots.find(([d2, p2]) => !(d2 === d && p2 === p) && !classGrid.get(x)[d2][p2] && !teacherGrid.get(tid)[d2][p2] && (d2 === d || other.perDay[d2] < dailyCap(other) + relax));
                        if (!dest) continue;
                        unplace(x, other, tid, d, p); place(x, other, tid, ...dest); place(tuple.classId, tuple, tid, d, p);
                        done = true; break;
                    }
                    if (done) break;
                }
                if (!done) break;
                repaired++;
            }
        }
    }

    // ---- 3. Optional study periods, supervised by a free teacher ----
    let studyUnsupervised = 0;
    if (study) {
        for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) {
            for (const [cid, g] of classGrid) {
                if (g[d][p]) continue;
                const total = id => teachers.get(id).placed + teachers.get(id).supervision;
                const onDay = id => (teacherGrid.get(id)[d].some(Boolean) ? 1 : 0);
                const teachesClass = id => (byClass.get(cid).some(t => t.teachers.includes(id)) ? 1 : 0);
                // Prefer: already in school that day (protects free days), fewest supervisions so far (fair share),
                // the class's own teacher, then lowest total load.
                const pick = [...teachers.keys()].filter(id => !teacherGrid.get(id)[d][p] && total(id) < MAX_SLOTS)
                    .sort((a, b) => onDay(b) - onDay(a) || teachers.get(a).supervision - teachers.get(b).supervision || teachesClass(b) - teachesClass(a) || total(a) - total(b))[0];
                g[d][p] = { subjectId: null, subject: 'Study period', teacherId: pick ?? null, study: true };
                if (pick == null) { studyUnsupervised++; continue; }
                teacherGrid.get(pick)[d][p] = { classId: cid, subjectId: null, subject: 'Study period (supervision)', study: true };
                teachers.get(pick).supervision++;
            }
        }
    }

    // ---- 4. Independent validation (recomputed from the grids, not from counters) ----
    let teacherClashes = 0;
    for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) {
        const seen = new Set();
        for (const g of classGrid.values()) {
            const c = g[d][p];
            if (c?.teacherId == null) continue;
            if (seen.has(c.teacherId)) teacherClashes++;
            seen.add(c.teacherId);
            const mirror = teacherGrid.get(c.teacherId)[d][p];
            if (!mirror || mirror.subjectId !== c.subjectId) teacherClashes++;
        }
    }
    const counted = new Map();
    for (const [cid, g] of classGrid) for (const day of g) for (const c of day) if (c && !c.study) counted.set(`${cid}:${c.subjectId}`, (counted.get(`${cid}:${c.subjectId}`) || 0) + 1);
    let countMismatches = 0, overScheduled = 0;
    for (const t of tuples.values()) {
        const n = counted.get(t.key) || 0;
        if (n !== t.placed) countMismatches++;
        if (n > t.required) overScheduled++;
    }
    const overCapacity = [...teacherGrid.values()].filter(g => g.flat().filter(Boolean).length > MAX_SLOTS).length;
    const cells = [...classGrid.values()].flatMap(g => g.flat());
    const validation = {
        teacherClashes, countMismatches, overScheduled, overCapacity, repaired,
        totalRequired: [...tuples.values()].reduce((a, t) => a + t.required, 0),
        totalPlaced: [...tuples.values()].reduce((a, t) => a + t.placed, 0),
        exact: [...tuples.values()].filter(t => t.placed === t.required).length,
        tuples: tuples.size,
        emptySlots: cells.filter(c => !c).length,
        studySlots: cells.filter(c => c?.study).length,
        studyUnsupervised,
        slots: classes.size * MAX_SLOTS,
    };
    validation.valid = !teacherClashes && !countMismatches && !overScheduled && !overCapacity;
    // An unsupervised study period is not a usable lesson, so it does not count as filled.
    validation.complete = validation.valid && validation.totalPlaced === validation.totalRequired && validation.emptySlots === 0 && studyUnsupervised === 0;
    return { days: DAYS, periods: PERIODS, classes, teachers, tuples, classGrid, teacherGrid, validation, study };
}

function renderReport(result) {
    const { days: DAYS, periods: PERIODS, classes, teachers, tuples, classGrid, teacherGrid, validation: v, study } = result;
    const MAX_SLOTS = DAYS.length * PERIODS.length;
    const tname = id => `${teachers.get(id).name} (T${id})`;
    const cname = id => { const c = classes.get(id); return `${c.section === 'Anglophone' ? 'A' : c.section === 'Francophone' ? 'F' : c.section || '?'} · ${c.name}`; };
    const daysWorked = id => teacherGrid.get(id).filter(day => day.some(Boolean)).length;
    const head = `| Period | ${DAYS.join(' | ')} |\n|---|${DAYS.map(() => '---').join('|')}|\n`;
    let md = `# Timetable — ${new Date().toISOString().slice(0, 10)}\n\n`;
    md += `Grid: ${DAYS.length} days × ${PERIODS.length} periods = ${MAX_SLOTS} slots per class and per teacher.\n\n`;
    md += `## Validation\n\n| Check | Result |\n|---|---|\n`;
    md += `| Teacher clashes | ${v.teacherClashes} |\n| Lesson count mismatches | ${v.countMismatches} |\n| Over-scheduled subjects | ${v.overScheduled} |\n`;
    md += `| Teachers over ${MAX_SLOTS} periods (lessons + supervision) | ${v.overCapacity} |\n`;
    md += `| Periods scheduled / required | ${v.totalPlaced} / ${v.totalRequired} (${v.totalRequired ? (100 * v.totalPlaced / v.totalRequired).toFixed(1) : '0'}%) |\n`;
    md += `| Class/subject pairs at exact weekly hours | ${v.exact} / ${v.tuples} |\n| Empty student slots | ${v.emptySlots} / ${v.slots} |\n`;
    if (study) md += `| Study periods (supervised / unsupervised) | ${v.studySlots - v.studyUnsupervised} / ${v.studyUnsupervised} |\n`;
    md += `\n## Teacher load\n\n| Teacher | Required | Capacity | Lessons | Supervision | Total | Days in school | Shortfall |\n|---|---|---|---|---|---|---|---|\n`;
    for (const t of [...teachers.values()].sort((a, b) => b.demand - a.demand)) {
        md += `| ${tname(t.id)} | ${Math.round(t.demand)} | ${MAX_SLOTS} | ${t.placed} | ${t.supervision} | ${t.placed + t.supervision} | ${daysWorked(t.id)} | ${Math.max(0, Math.round(t.demand) - t.placed)} |\n`;
    }
    const short = [...tuples.values()].filter(t => t.placed < t.required);
    md += `\n## Shortfall by class and subject\n\n`;
    md += short.length ? `| Class | Subject | Required | Scheduled | Teachers |\n|---|---|---|---|---|\n` + short.map(t => `| ${cname(t.classId)} | ${t.subject} | ${t.required} | ${t.placed} | ${t.teachers.length ? t.teachers.map(tname).join(', ') : '**none assigned**'} |`).join('\n') + '\n' : 'None: every subject has its exact weekly periods.\n';
    md += `\n## Class timetables\n`;
    for (const [cid, g] of classGrid) {
        md += `\n### ${cname(cid)}\n\n${head}`;
        PERIODS.forEach((per, p) => {
            md += `| ${per.label} | ${DAYS.map((_, d) => { const c = g[d][p]; if (!c) return '**— no teacher —**'; const who = c.teacherId != null ? teachers.get(c.teacherId).name : 'unsupervised'; return c.study ? `*Study period* — ${who}` : `${c.subject} — ${who}`; }).join(' | ')} |\n`;
        });
    }
    md += `\n## Teacher timetables\n`;
    for (const [tid, g] of teacherGrid) {
        md += `\n### ${tname(tid)} — ${teachers.get(tid).placed} lessons, ${teachers.get(tid).supervision} supervision\n\n${head}`;
        PERIODS.forEach((per, p) => { md += `| ${per.label} | ${DAYS.map((_, d) => { const c = g[d][p]; return c ? `${cname(c.classId)} (${c.subject})` : 'free'; }).join(' | ')} |\n`; });
    }
    return md;
}

function toJson(result) {
    const { days, periods, classes, teachers, classGrid, validation } = result;
    return {
        days, periods, validation,
        classes: [...classGrid].map(([id, g]) => ({
            class_id: id, section: classes.get(id).section, name: classes.get(id).name,
            grid: g.map(day => day.map(c => c && { subject_id: c.subjectId, subject: c.subject, teacher_id: c.teacherId, teacher: c.teacherId != null ? teachers.get(c.teacherId).name : null, study: !!c.study })),
        })),
    };
}

module.exports = { buildTimetable, renderReport, toJson };
