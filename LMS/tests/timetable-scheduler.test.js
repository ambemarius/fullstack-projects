const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTimetable, renderReport, toJson } = require('../utils/timetableScheduler');
const { addTeachers } = require('../scripts/timetable/addTeachers');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const periods = n => Array.from({ length: n }, (_, i) => ({ slotId: i + 1, label: `P${i + 1}` }));
const row = (classId, subjectId, subject, periodsWeek, teacherId) => ({
    class_id: classId, section: 'Anglophone', class_name: `Class ${classId}`,
    subject_id: subjectId, subject, periods_week: periodsWeek, teacher_id: teacherId, teacher: teacherId == null ? null : `Teacher ${teacherId}`,
});

// Recount everything from the grids so the test does not trust the scheduler's own validation.
function audit(result) {
    const { classGrid, tuples } = result;
    let teacherClashes = 0;
    const D = result.days.length, P = result.periods.length;
    for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) {
        const seen = new Set();
        for (const g of classGrid.values()) {
            const id = g[d][p]?.teacherId;
            if (id == null) continue;
            if (seen.has(id)) teacherClashes++;
            seen.add(id);
        }
    }
    const placed = new Map();
    for (const [cid, g] of classGrid) for (const c of g.flat()) if (c && !c.study) placed.set(`${cid}:${c.subjectId}`, (placed.get(`${cid}:${c.subjectId}`) || 0) + 1);
    const wrongHours = [...tuples.values()].filter(t => (placed.get(t.key) || 0) !== t.required).length;
    const empty = [...classGrid.values()].reduce((a, g) => a + g.flat().filter(c => !c).length, 0);
    return { teacherClashes, wrongHours, empty };
}

test('feasible input gets exact weekly hours with no clashes and no gaps', () => {
    // 3 classes x 4 periods x 5 days = 20 slots each; demand per class = 20; shared teachers create contention.
    const rows = [];
    for (const c of [1, 2, 3]) {
        rows.push(row(c, 10, 'Maths', 6, 100 + c));      // one maths teacher per class
        rows.push(row(c, 11, 'English', 5, 200));        // 15 periods for one English teacher
        rows.push(row(c, 12, 'Science', 5, 300));        // 15 periods for one Science teacher
        rows.push(row(c, 13, 'History', 4, 400));        // 12 periods for one History teacher
    }
    const result = buildTimetable({ days: DAYS, periods: periods(4), rows });
    const a = audit(result);
    assert.equal(a.teacherClashes, 0);
    assert.equal(a.wrongHours, 0);
    assert.equal(a.empty, 0);
    assert.equal(result.validation.valid, true);
    assert.equal(result.validation.complete, true);
    // Daily spread: a 5-period subject never appears twice on the same day.
    for (const g of result.classGrid.values()) for (const day of g) {
        const english = day.filter(c => c?.subject === 'English').length;
        assert.ok(english <= 1, 'English stays one period per day');
    }
});

test('over-capacity teacher yields the best valid schedule and an honest shortfall', () => {
    // One teacher, 3 classes x 10 periods = 30 required, but only 20 slots in the week.
    const rows = [1, 2, 3].map(c => row(c, 10, 'Maths', 10, 7));
    const result = buildTimetable({ days: DAYS, periods: periods(4), rows });
    assert.equal(audit(result).teacherClashes, 0);
    assert.equal(result.validation.totalPlaced, 20, 'teacher teaches every slot of the week');
    assert.equal(result.validation.totalRequired, 30);
    assert.equal(result.validation.valid, true);
    assert.equal(result.validation.complete, false);
    assert.match(renderReport(result), /Shortfall by class and subject[\s\S]*Class 1 \| Maths/);
});

test('study periods fill every gap with a free supervisor and never double-book', () => {
    const rows = [row(1, 10, 'Maths', 3, 1), row(2, 10, 'Maths', 3, 1), row(2, 11, 'Art', 2, 2)];
    const result = buildTimetable({ days: DAYS, periods: periods(2), rows }, { study: true });
    const a = audit(result);
    assert.equal(a.empty, 0);
    assert.equal(a.teacherClashes, 0);
    assert.equal(a.wrongHours, 0);
    assert.equal(result.validation.studySlots, 20 - 8);
    for (const t of result.teachers.values()) assert.ok(t.placed + t.supervision <= 10);
    const json = toJson(result);
    assert.equal(json.classes.length, 2);
    assert.ok(json.classes[0].grid.flat().some(c => c.study));
});

test('unassigned subjects and zero-period rows are reported, not scheduled', () => {
    const rows = [row(1, 10, 'Maths', 2, 1), row(1, 11, 'Music', 2, null), row(1, 12, 'Old History', 0, null)];
    const result = buildTimetable({ days: DAYS, periods: periods(2), rows });
    assert.equal(result.validation.tuples, 2, 'zero-period row ignored');
    assert.equal(result.validation.totalPlaced, 2);
    assert.match(renderReport(result), /Music \| 2 \| 0 \| \*\*none assigned\*\*/);
});

test('addTeachers splits a subject into balanced single-teacher classes and adds a cover teacher', () => {
    const rows = [];
    for (const c of [1, 2, 3, 4, 5, 6]) rows.push(row(c, 10, 'Maths', c <= 2 ? 6 : 5, 8), row(c, 11, 'French', 3, 9));
    const input = { days: DAYS, periods: periods(8), rows };
    const { input: out, plan } = addTeachers(input, { split: 'Maths:3', cover: 'French:2' });
    assert.equal(input.rows[0].teacher_id, 8, 'original input is not modified');
    const loads = plan.split.Maths.map(t => t.periods);
    assert.equal(loads.reduce((a, b) => a + b), 32);
    assert.ok(Math.max(...loads) - Math.min(...loads) <= 1, `balanced loads ${loads}`);
    assert.ok(plan.split.Maths.slice(1).every(t => t.id < 0 && t.teacher.endsWith('(new)')));
    for (const c of [1, 2, 3, 4, 5, 6]) assert.equal(out.rows.filter(r => r.class_id === c && r.subject === 'Maths').length, 1);
    assert.equal(plan.cover.takes.length, 2);
    assert.equal(out.rows.filter(r => r.subject === 'French' && r.teacher_id === plan.cover.id).length, 2);
    assert.throws(() => addTeachers(input, { split: 'Astronomy:2' }), /No assigned rows/);
    assert.throws(() => addTeachers(input, { split: 'Maths:1' }), /Bad --split/);
});

test('scheduler rejects the old array input format with a clear message', () => {
    assert.throws(() => buildTimetable([row(1, 10, 'Maths', 2, 1)]), /exportInputs/);
});
