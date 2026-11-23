// Head of Department report: one subject across every class of a section (or the whole school),
// for a term or the whole year. Marks are out of 20; a student's mark for the period is the mean of
// their sequence marks in that period. Pass mark 10/20. Grades use the same scale as the student page.
const { sql, pool, poolConnect } = require('../../config/database');
const StaffDuty = require('../staff/staffDuty');

const TERMS = ['First', 'Second', 'Third'];
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const round = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const mean = list => (list.length ? list.reduce((t, x) => t + x, 0) / list.length : null);
const grade = m => (m >= 16 ? 'A' : m >= 14 ? 'B' : m >= 12 ? 'C' : m >= 10 ? 'D' : 'F');
const yearSeq = (term, seq) => TERMS.indexOf(term) * 2 + Number(seq);

// Figures for a list of student marks (each out of 20).
function figures(marks) {
    const n = marks.length;
    const avg = mean(marks);
    const passed = marks.filter(m => m >= 10).length;
    const sd = n > 1 ? Math.sqrt(marks.reduce((t, m) => t + (m - avg) ** 2, 0) / n) : (n ? 0 : null);
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    marks.forEach(m => { grades[grade(m)]++; });
    return {
        assessed: n, average: round(avg), highest: n ? round(Math.max(...marks)) : null, lowest: n ? round(Math.min(...marks)) : null,
        passed, failed: n - passed, passRate: n ? round((passed / n) * 100, 1) : null, standardDeviation: round(sd), grades,
    };
}

// Sat / passed / % passed, overall and for girls and boys. entries: [{ mark, sex }].
function sexSplit(entries) {
    const part = list => {
        const sat = list.length, passed = list.filter(e => e.mark >= 10).length;
        return { sat, passed, passRate: sat ? round((passed / sat) * 100, 1) : null };
    };
    const girls = entries.filter(e => /^f/i.test(e.sex || '')), boys = entries.filter(e => /^m/i.test(e.sex || ''));
    return { ...part(entries), girls: part(girls), boys: part(boys) };
}

function createDepartmentReport({ request = async () => { await poolConnect; return pool.request(); }, staffDuty = StaffDuty } = {}) {
    async function query(text, params = {}) {
        const req = await request();
        for (const [name, [type, value]] of Object.entries(params)) req.input(name, type, value);
        return (await req.query(text)).recordset;
    }

    // Which department the signed-in person may see. Administrators choose any subject and section.
    async function scope(actor, q) {
        if (actor.type === 'admin') {
            const subjectId = Number(q.subjectId);
            if (!Number.isSafeInteger(subjectId) || subjectId < 1) throw fail(422, 'Choose a subject.');
            const section = StaffDuty.SECTIONS.includes(q.section) ? q.section : null;
            const subject = (await query('SELECT name FROM dbo.subjects WHERE id=@s', { s: [sql.Int, subjectId] }))[0];
            if (!subject) throw fail(404, 'Subject not found.');
            return { subjectId, subjectName: subject.name, section };
        }
        const dept = await staffDuty.department(actor.type, actor.id);
        if (!dept) throw fail(403, 'You are not assigned as head of a department. Ask an administrator to set your subject.');
        return { subjectId: dept.subjectId, subjectName: dept.subjectName, section: dept.section || null };
    }

    async function options(actor) {
        const years = await query('SELECT id, name, isCurrent FROM dbo.academic_years ORDER BY fromYear DESC');
        const result = { years, terms: TERMS };
        if (actor.type === 'admin') {
            result.subjects = await query('SELECT s.id, s.name, s.code FROM dbo.subjects s WHERE EXISTS (SELECT 1 FROM dbo.class_subjects cs WHERE cs.subject_id=s.id) ORDER BY s.name, s.code');
            result.sections = StaffDuty.SECTIONS;
        } else {
            result.department = await scope(actor, {});
        }
        return result;
    }

    async function report(actor, q = {}) {
        const dept = await scope(actor, q);
        const term = q.term ? String(q.term) : '';
        if (term && !TERMS.includes(term)) throw fail(422, 'Choose First, Second or Third term, or the whole year.');
        let year;
        if (q.yearId) {
            year = (await query('SELECT id, name FROM dbo.academic_years WHERE id=@y', { y: [sql.Int, Number(q.yearId)] }))[0];
            if (!year) throw fail(404, 'Academic year not found.');
        } else {
            year = (await query('SELECT TOP 1 id, name FROM dbo.academic_years ORDER BY isCurrent DESC, fromYear DESC'))[0];
            if (!year) throw fail(409, 'No academic year has been set up yet.');
        }
        const sequences = term ? [yearSeq(term, 1), yearSeq(term, 2)] : [1, 2, 3, 4, 5, 6];

        const classes = await query(`SELECT cs.id csId, c.id classId, c.section,
              c.section + ' — ' + c.name + COALESCE(' (' + NULLIF(c.stream, 'Normal') + ')', '') label
            FROM dbo.class_subjects cs JOIN dbo.classes c ON c.id = cs.class_id
            WHERE cs.subject_id = @s AND (@sec IS NULL OR c.section = @sec)
            ORDER BY c.section, c.rank, c.name`, { s: [sql.Int, dept.subjectId], sec: [sql.NVarChar(20), dept.section] });
        const base = { department: dept, year, term: term || null, sequences, generatedAt: new Date().toISOString() };
        if (!classes.length) return { ...base, classes: [], totals: { ...figures([]), classes: 0, students: 0, marksEntered: 0, marksExpected: 0, enrolment: { total: 0, boys: 0, girls: 0, boysPercent: null, girlsPercent: null }, results: sexSplit([]) }, teachers: [], top: [] };

        const ids = classes.map(c => Number(c.csId)).filter(Number.isSafeInteger);
        const classIds = classes.map(c => Number(c.classId)).filter(Number.isSafeInteger);
        const inCs = ids.join(','), inClass = classIds.join(',');   // integers only, from the database
        const teachers = await query(`SELECT DISTINCT cst.class_subject_id csId, t.name FROM dbo.class_subject_teachers cst
            JOIN dbo.teachers t ON t.id = cst.teacher_id
            WHERE cst.class_subject_id IN (${inCs}) AND (cst.assignment_status IS NULL OR cst.assignment_status = 'active')`);
        const roll = await query(`SELECT currentClassLevel classId, COUNT(*) n,
              SUM(CASE WHEN sex LIKE 'F%' THEN 1 ELSE 0 END) girls, SUM(CASE WHEN sex LIKE 'M%' THEN 1 ELSE 0 END) boys
            FROM dbo.students WHERE isWithdrawn = 0 AND currentClassLevel IN (${inClass}) GROUP BY currentClassLevel`);
        const scores = await query(`SELECT ss.class_subject_id csId, ss.student_id studentId, ss.term, ss.sequence, ss.score, ss.max_score maxScore,
              p.firstName + ' ' + p.lastName student, p.sex
            FROM dbo.subject_scores ss JOIN dbo.students p ON p.id = ss.student_id
            WHERE ss.class_subject_id IN (${inCs}) AND ss.academic_year_id = @y AND (@term = '' OR ss.term = @term) AND ss.score IS NOT NULL`,
            { y: [sql.Int, year.id], term: [sql.NVarChar(10), term] });

        const rollBy = new Map(roll.map(r => [r.classId, r]));
        // Class enrolment: total, boys, girls and their share.
        const enrolment = (total, boys, girls) => ({
            total, boys, girls,
            boysPercent: total ? round((boys / total) * 100, 1) : null, girlsPercent: total ? round((girls / total) * 100, 1) : null,
        });
        let rollBoys = 0, rollGirls = 0, rollTotal = 0;
        const teachersBy = new Map();
        teachers.forEach(t => (teachersBy.get(t.csId) || teachersBy.set(t.csId, []).get(t.csId)).push(t.name));

        const allMarks = [], top = [], teacherMarks = new Map();
        let marksEntered = 0, marksExpected = 0, students = 0;
        const rows = classes.map(c => {
            const mine = scores.filter(s => s.csId === c.csId);
            const perStudent = new Map();
            const seqMarks = Object.fromEntries(sequences.map(n => [n, []]));
            for (const s of mine) {
                const n = yearSeq(s.term, s.sequence);
                if (!seqMarks[n]) continue;
                const m = (Number(s.score) / (Number(s.maxScore) || 20)) * 20;
                seqMarks[n].push(m);
                const st = perStudent.get(s.studentId) || { name: s.student, sex: s.sex, marks: [] };
                st.marks.push(m);
                perStudent.set(s.studentId, st);
            }
            const studentMarks = [...perStudent.values()].map(st => ({ name: st.name, sex: st.sex, mark: mean(st.marks) }));
            const marks = studentMarks.map(x => x.mark);
            const r = rollBy.get(c.classId) || { n: 0, boys: 0, girls: 0 };
            const onRoll = Math.max(r.n, perStudent.size);
            rollTotal += r.n; rollBoys += r.boys; rollGirls += r.girls;
            const entered = Object.values(seqMarks).reduce((t, l) => t + l.length, 0);
            const expected = onRoll * sequences.length;
            marksEntered += entered; marksExpected += expected; students += onRoll;
            allMarks.push(...studentMarks);
            studentMarks.forEach(x => top.push({ name: x.name, className: c.label, mark: x.mark }));
            const names = teachersBy.get(c.csId) || [];
            for (const name of names.length ? names : ['Not assigned']) {
                const t = teacherMarks.get(name) || { classes: [], entries: [] };
                t.classes.push(c.label); t.entries.push(...studentMarks);
                teacherMarks.set(name, t);
            }
            return {
                classId: c.classId, className: c.label, section: c.section, teachers: names, students: onRoll,
                enrolment: enrolment(r.n, r.boys, r.girls),
                marksEntered: entered, marksExpected: expected, completion: expected ? round((entered / expected) * 100, 1) : null,
                sequenceAverages: Object.fromEntries(sequences.map(n => [n, round(mean(seqMarks[n]))])),
                ...figures(marks),
                results: sexSplit(studentMarks),
            };
        });

        return {
            ...base,
            classes: rows,
            totals: {
                classes: rows.length, students, marksEntered, marksExpected,
                enrolment: enrolment(rollTotal, rollBoys, rollGirls),
                completion: marksExpected ? round((marksEntered / marksExpected) * 100, 1) : null,
                ...figures(allMarks.map(e => e.mark)),
                results: sexSplit(allMarks),
            },
            teachers: [...teacherMarks.entries()].map(([name, t]) => ({ name, classes: t.classes, ...figures(t.entries.map(e => e.mark)), results: sexSplit(t.entries) }))
                .sort((a, b) => a.name.localeCompare(b.name)),
            top: top.sort((a, b) => b.mark - a.mark).slice(0, 10).map(x => ({ ...x, mark: round(x.mark) })),
        };
    }

    // Administrators: every subject across the school (or one section), one line per subject.
    async function schoolReport(actor, q = {}) {
        if (actor.type !== 'admin') throw fail(403, 'Only administrators can see the whole-school subject report.');
        const section = StaffDuty.SECTIONS.includes(q.section) ? q.section : null;
        const subjects = await query(`SELECT s.id, s.name, s.code FROM dbo.subjects s
            WHERE EXISTS (SELECT 1 FROM dbo.class_subjects cs JOIN dbo.classes c ON c.id = cs.class_id WHERE cs.subject_id = s.id AND (@sec IS NULL OR c.section = @sec))
            ORDER BY s.name, s.code`, { sec: [sql.NVarChar(20), section] });
        let head = null;
        const lines = [];
        for (const s of subjects) {
            const r = await report(actor, { subjectId: s.id, section: section || '', term: q.term || '', yearId: q.yearId });
            head = head || r;
            const t = r.totals;
            lines.push({
                subjectId: s.id, subjectName: s.name, code: s.code, classes: t.classes,
                teachers: r.teachers.filter(x => x.name !== 'Not assigned').length,
                average: t.average, highest: t.highest, lowest: t.lowest, completion: t.completion,
                marksEntered: t.marksEntered, marksExpected: t.marksExpected, grades: t.grades, results: t.results,
            });
        }
        // Whole-school enrolment by sex (students on the class lists of the section).
        const roll = (await query(`SELECT COUNT(*) total, SUM(CASE WHEN p.sex LIKE 'M%' THEN 1 ELSE 0 END) boys, SUM(CASE WHEN p.sex LIKE 'F%' THEN 1 ELSE 0 END) girls
            FROM dbo.students p JOIN dbo.classes c ON c.id = p.currentClassLevel
            WHERE p.isWithdrawn = 0 AND (@sec IS NULL OR c.section = @sec)`, { sec: [sql.NVarChar(20), section] }))[0] || { total: 0, boys: 0, girls: 0 };
        const share = v => (roll.total ? round((v / roll.total) * 100, 1) : null);
        // "All subjects" adds up subject entries: a student sitting 9 subjects counts 9 times.
        const add = pick => {
            const sat = lines.reduce((t, l) => t + pick(l).sat, 0), passed = lines.reduce((t, l) => t + pick(l).passed, 0);
            return { sat, passed, passRate: sat ? round((passed / sat) * 100, 1) : null };
        };
        const entered = lines.reduce((t, l) => t + l.marksEntered, 0), expected = lines.reduce((t, l) => t + l.marksExpected, 0);
        return {
            section, term: q.term || null,
            year: head ? head.year : (await query('SELECT TOP 1 id, name FROM dbo.academic_years ORDER BY isCurrent DESC, fromYear DESC'))[0],
            sequences: head ? head.sequences : [], generatedAt: new Date().toISOString(),
            enrolment: { total: roll.total, boys: roll.boys, girls: roll.girls, boysPercent: share(roll.boys), girlsPercent: share(roll.girls) },
            subjects: lines,
            totals: {
                subjects: lines.length, marksEntered: entered, marksExpected: expected, completion: expected ? round((entered / expected) * 100, 1) : null,
                results: { ...add(l => l.results), girls: add(l => l.results.girls), boys: add(l => l.results.boys) },
            },
        };
    }

    return { options, report, schoolReport };
}

module.exports = { createDepartmentReport, figures, grade, sexSplit };
