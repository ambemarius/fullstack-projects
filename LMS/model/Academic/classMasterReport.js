// Class master's end-of-term report: every subject the class takes, the class ranking and the figures the
// administration asks for at the end of each term. Built from the same report cards that are printed
// (model/Academic/reportCardService.js), so averages, coefficients and ranks always match the bulletins.
const { sql, pool, poolConnect } = require('../../config/database');
const { createReportCardService, TERMS } = require('./reportCardService');

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const round = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const mean = list => (list.length ? list.reduce((t, x) => t + x, 0) / list.length : null);
const isGirl = sex => /^f/i.test(sex || ''), isBoy = sex => /^m/i.test(sex || '');
const BANDS = [['16 – 20', 16, 21], ['14 – 15.99', 14, 16], ['12 – 13.99', 12, 14], ['10 – 11.99', 10, 12], ['Below 10', -1, 10]];

// Sat / passed / % passed for everyone, girls and boys. entries: [{ value, sex }]; null values have not sat.
function passSplit(entries, passMark = 10) {
    const part = list => {
        const sat = list.filter(e => e.value !== null && e.value !== undefined);
        const passed = sat.filter(e => e.value >= passMark).length;
        return { sat: sat.length, passed, passRate: sat.length ? round((passed / sat.length) * 100, 1) : null };
    };
    return { ...part(entries), girls: part(entries.filter(e => isGirl(e.sex))), boys: part(entries.filter(e => isBoy(e.sex))) };
}

function createClassMasterReport({
    request = async () => { await poolConnect; return pool.request(); },
    reportCards = createReportCardService(),
} = {}) {
    async function query(text, params = {}) {
        const req = await request();
        for (const [name, [type, value]] of Object.entries(params)) req.input(name, type, value);
        return (await req.query(text)).recordset;
    }

    // Classes the signed-in person may report on: their own as class master; administrators see every class.
    async function myClasses(actor) {
        const label = "c.section + ' — ' + c.name + COALESCE(' (' + NULLIF(c.stream, 'Normal') + ')', '')";
        if (actor.type === 'admin') return query(`SELECT c.id, ${label} label FROM dbo.classes c ORDER BY c.section, c.rank, c.name`);
        if (actor.type !== 'teacher') return [];
        return query(`SELECT c.id, ${label} label FROM dbo.classes c WHERE c.class_master_id = @t ORDER BY c.section, c.rank, c.name`, { t: [sql.Int, actor.id] });
    }

    async function options(actor) {
        const classes = await myClasses(actor);
        const years = await query('SELECT id, name, isCurrent FROM dbo.academic_years ORDER BY fromYear DESC');
        return { classes, years, terms: TERMS };
    }

    async function report(actor, q = {}) {
        const classId = Number(q.classId);
        if (!Number.isSafeInteger(classId) || classId < 1) throw fail(422, 'Choose a class.');
        if (!TERMS.includes(q.term)) throw fail(422, 'Choose a term (First, Second or Third).');
        const mine = await myClasses(actor);
        if (!mine.some(c => c.id === classId)) throw fail(403, 'You can only see the report of a class you are class master of.');
        let yearId = Number(q.yearId);
        if (!Number.isSafeInteger(yearId) || yearId < 1) {
            const y = (await query('SELECT TOP 1 id FROM dbo.academic_years ORDER BY isCurrent DESC, fromYear DESC'))[0];
            if (!y) throw fail(409, 'No academic year has been set up yet.');
            yearId = y.id;
        }

        const built = await reportCards.classCards({ classId, yearId, term: q.term });
        const cards = built.cards;
        const info = (await query(`SELECT c.section, t.name classMaster FROM dbo.classes c LEFT JOIN dbo.teachers t ON t.id = c.class_master_id WHERE c.id = @c`,
            { c: [sql.Int, classId] }))[0] || {};
        const ids = cards.map(c => Number(c.student.id)).filter(Number.isSafeInteger);
        const sexRows = ids.length ? await query(`SELECT id, sex FROM dbo.students WHERE id IN (${ids.join(',')})`) : [];
        const sexOf = new Map(sexRows.map(r => [String(r.id), r.sex]));
        const termNo = TERMS.indexOf(q.term) + 1;
        const seqLabels = cards[0] ? cards[0].seq_labels : [];

        // Students, ranked as on the report cards.
        const students = cards.map(c => {
            const rows = c.groups.flatMap(g => g.rows);
            return {
                id: Number(c.student.id), name: c.student.full_name, matricule: c.student.matricule, sex: sexOf.get(c.student.id) || '',
                average: c.totals.average, rank: c.totals.rank, subjectsPassed: c.totals.subjects_passed, subjectsTaken: c.totals.subjects_taken,
                annual: c.annual_average, status: c.status, remark: c.council_remark, absences: c.discipline.absences || 0,
                repeater: Boolean(c.student.is_repeater), weakest: rows.filter(r => r.fail).map(r => r.name),
            };
        }).sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9) || a.name.localeCompare(b.name));
        const ranked = students.filter(s => s.average !== null);
        const averages = ranked.map(s => s.average);

        // Subjects: one line each, from every student's report-card row.
        const subjects = new Map();
        cards.forEach(c => c.groups.forEach(g => g.rows.forEach(r => {
            const s = subjects.get(r.name) || { name: r.name, teacher: r.teacher, coefficient: r.coef, classAverage: r.class_avg, entries: [], marksEntered: 0, marksExpected: 0, best: null };
            const sex = sexOf.get(c.student.id);
            s.entries.push({ value: r.avg, sex });
            s.marksEntered += r.seq.filter(v => v !== null).length;
            if (!s.best || r.avg > s.best.mark) s.best = { name: c.student.full_name, mark: r.avg };
            subjects.set(r.name, s);
        })));
        const onRoll = cards.length;
        const subjectLines = [...subjects.values()].map(s => {
            const values = s.entries.map(e => e.value);
            return {
                name: s.name, teacher: s.teacher, coefficient: s.coefficient, average: s.classAverage,
                highest: values.length ? Math.max(...values) : null, lowest: values.length ? Math.min(...values) : null,
                marksEntered: s.marksEntered, marksExpected: onRoll * seqLabels.length,
                results: passSplit(s.entries), best: s.best,
            };
        });
        const byAverage = subjectLines.filter(s => s.average !== null).sort((a, b) => b.average - a.average);

        const girls = students.filter(s => isGirl(s.sex)).length, boys = students.filter(s => isBoy(s.sex)).length;
        const share = n => (onRoll ? round((n / onRoll) * 100, 1) : null);
        const totalAbsences = round(students.reduce((t, s) => t + (Number(s.absences) || 0), 0), 1);

        return {
            classId, yearId, term: q.term, termNo, className: `${info.section ? info.section + ' — ' : ''}${built.className}`, yearName: built.yearName,
            classMaster: info.classMaster || null, sequences: seqLabels, generatedAt: new Date().toISOString(),
            enrolment: { total: onRoll, boys, girls, boysPercent: share(boys), girlsPercent: share(girls) },
            results: passSplit(students.map(s => ({ value: s.average, sex: s.sex }))),
            classAverage: round(mean(averages)), highest: averages.length ? Math.max(...averages) : null, lowest: averages.length ? Math.min(...averages) : null,
            bands: BANDS.map(([label, lo, hi]) => ({ label, count: averages.filter(a => a >= lo && a < hi).length })),
            bestSubject: byAverage[0] || null, worstSubject: byAverage.length > 1 ? byAverage[byAverage.length - 1] : null,
            subjects: byAverage.concat(subjectLines.filter(s => s.average === null)),
            students,
            best: ranked.slice(0, 10),
            atRisk: ranked.filter(s => s.average < 10).sort((a, b) => a.average - b.average),
            notClassified: students.filter(s => s.average === null).map(s => s.name),
            attendance: {
                totalHours: totalAbsences, perStudent: onRoll ? round(totalAbsences / onRoll, 1) : null,
                most: [...students].filter(s => s.absences > 0).sort((a, b) => b.absences - a.absences).slice(0, 5).map(s => ({ name: s.name, hours: s.absences })),
            },
        };
    }

    return { options, report, myClasses };
}

module.exports = { createClassMasterReport, passSplit };
