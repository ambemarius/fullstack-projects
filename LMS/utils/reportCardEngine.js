// Report card engine: turns raw sequence marks into every figure printed on the Cameroon bilingual
// "STUDENT REPORT CARD | BULLETIN DE NOTES". Pure (no database, no HTML). Ported from the
// report_card_module Python engine (engine.py + config.py); tests/report-card-engine.test.js checks
// that it reproduces that engine's output exactly.
//
//   subject average (Moy. Tr.)  = mean of the term's two sequence marks (/20)
//   subject total   (AvxC)      = subject average x coefficient
//   subject position (Rang)     = rank of the subject average in the class
//   subject class avg           = mean of all students' subject averages
//   group "Sub Total" seq col   = sum(seq mark x coef);  total col = sum(AvxC)
//   group "Average n"           = sub total / sum(coef)
//   Terminal average            = sum(AvxC) / sum(coef)
//   Position                    = rank of terminal average; ties share a position (1, 2, 2, 4)
//   Class average               = mean of every student's terminal average
//   Subjects passed             = subjects with average >= pass mark
//   Annual average (3rd term)   = mean of the term averages
//   Status                      = annual (3rd term) or terminal average >= pass mark
//
// Averages, totals and ranks are never stored: they are recomputed from the marks, so a corrected mark
// updates every figure.

const DEFAULT_CONFIG = Object.freeze({
    maxMark: 20,
    passMark: 10,               // marks/averages below this print red
    decimals: 2,
    termSequences: { 1: [1, 2], 2: [3, 4], 3: [5, 6] },
    // Remark bands, checked from the top down.
    bands: [
        { minimum: 17, label: 'EXCELLENT', isFail: false },
        { minimum: 14, label: 'VERY GOOD', isFail: false },
        { minimum: 12, label: 'GOOD', isFail: false },
        { minimum: 10, label: 'AVERAGE', isFail: false },
        { minimum: 5, label: 'WEAK', isFail: true },
        { minimum: 0, label: 'VERY WEAK', isFail: true },
    ],
    // 'ignore': average of the sequences that have a mark; 'zero': a missing sequence mark counts as 0
    missingMarkPolicy: 'ignore',
    promotionAverage: 10,       // annual average needed to pass on 3rd term
    showAnnualFromTerm: 3,      // earlier terms print "-" for the annual average
    termLabels: { 1: ['FIRST TERM', 'Premier Trimestre'], 2: ['SECOND TERM', 'Deuxième Trimestre'], 3: ['THIRD TERM', 'Troisième Trimestre'] },
    statusPassed: 'Passed/Réussi',
    statusFailed: 'Failed/Échoué',
});

const EPS = 1e-9;
const mean = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

function bandFor(cfg, value) {
    if (value === null || value === undefined) return null;
    for (const band of cfg.bands) if (value >= band.minimum) return band;
    return cfg.bands[cfg.bands.length - 1];
}

// Python round(value + 1e-9, 2): the nudge removes exact binary ties, after which toFixed and Python agree.
function round(value, cfg) {
    return value === null || value === undefined ? null : Number((value + EPS).toFixed(cfg.decimals));
}

// 1, 2, 2, 4 style ranking; students without a score get no rank.
function competitionRanks(scores) {
    const valid = [...scores.values()].filter(v => v !== null);
    const ranks = new Map();
    for (const [id, v] of scores) ranks.set(id, v === null ? null : 1 + valid.filter(o => o > v + EPS).length);
    return ranks;
}

function subjectAverage(scores, cfg) {
    if (scores.every(s => s === null || s === undefined)) return null; // not taken / nothing entered yet
    if (cfg.missingMarkPolicy === 'zero') return mean(scores.map(s => s || 0));
    return mean(scores.filter(s => s !== null && s !== undefined));
}

const markKey = (studentId, subjectId, seq) => `${studentId}|${subjectId}|${seq}`;
const getMark = (marks, studentId, subjectId, seq) => {
    const v = marks.get(markKey(studentId, subjectId, seq));
    return v === undefined ? null : v;
};

// Weighted average for one student over one term (also used for earlier terms).
function termAverage(studentId, classroom, marks, term, cfg = DEFAULT_CONFIG) {
    const seqs = cfg.termSequences[term];
    let points = 0, coefs = 0;
    for (const subj of classroom.subjects) {
        const avg = subjectAverage(seqs.map(q => getMark(marks, studentId, subj.id, q)), cfg);
        if (avg !== null) { points += avg * subj.coefficient; coefs += subj.coefficient; }
    }
    return coefs ? points / coefs : null;
}

// marks: Map from markKey(studentId, subjectId, globalSequence) to a /20 score or null,
// or an array of [studentId, subjectId, sequence, score].
function toMarkMap(marks) {
    if (marks instanceof Map) return marks;
    const map = new Map();
    for (const [studentId, subjectId, seq, score] of marks) map.set(markKey(studentId, subjectId, seq), score === undefined ? null : score);
    return map;
}

/**
 * Returns one view-model per student, ready for the print template or JSON.
 * school: { name_en, name_fr, address_line, country_*, motto_*, ministry_*, logo, principal_signature, watermark_text, footer_text }
 * classroom: { id, name, section, academic_year, groups: [{ id, name, order, min_rows }],
 *              subjects: [{ id, name, group_id, coefficient, teacher_name, order }] }
 * students: [{ id, matricule, full_name, date_of_birth, photo, parent_address, is_repeater }]
 */
function buildReportCards(school, classroom, students, marksInput, termInfo, {
    discipline = {}, owing = {}, councilRemarks = {}, historicalTermAverages = {}, config = DEFAULT_CONFIG,
} = {}) {
    const cfg = config;
    const marks = toMarkMap(marksInput);
    const term = termInfo.term;
    const seqs = cfg.termSequences[term];
    if (!seqs) throw new Error(`Unknown term ${term}`);
    const byOrder = (a, b) => (a.order || 0) - (b.order || 0); // Array.sort is stable, like Python's sorted
    const subjects = [...classroom.subjects].sort(byOrder);
    const groups = [...classroom.groups].sort(byOrder);
    const ids = students.map(s => s.id);

    // 1. Subject averages for everyone (needed for subject ranks and class averages).
    const subjAvg = new Map();
    for (const st of students) for (const sb of subjects) {
        subjAvg.set(`${st.id}|${sb.id}`, subjectAverage(seqs.map(q => getMark(marks, st.id, sb.id, q)), cfg));
    }
    const subjRank = new Map(), subjClassAvg = new Map();
    for (const sb of subjects) {
        const col = new Map(ids.map(id => [id, subjAvg.get(`${id}|${sb.id}`)]));
        for (const [id, rank] of competitionRanks(col)) subjRank.set(`${id}|${sb.id}`, rank);
        subjClassAvg.set(sb.id, mean([...col.values()].filter(v => v !== null)));
    }

    // 2. Terminal averages, overall rank and class average.
    const termAvg = new Map(ids.map(id => [id, termAverage(id, classroom, marks, term, cfg)]));
    const overallRank = competitionRanks(termAvg);
    const classAverage = mean([...termAvg.values()].filter(v => v !== null));
    const classSize = students.length;

    return students.map(st => {
        const groupVms = [];
        let totalPoints = 0, totalCoef = 0, passed = 0, taken = 0;

        groups.forEach((grp, index) => {
            const rows = [];
            const seqPoints = seqs.map(() => 0), seqCoefs = seqs.map(() => 0);
            let gPoints = 0, gCoef = 0;
            for (const sb of subjects.filter(s => s.group_id === grp.id)) {
                const scores = seqs.map(q => getMark(marks, st.id, sb.id, q));
                const avg = subjAvg.get(`${st.id}|${sb.id}`);
                if (avg === null) continue; // student does not take this subject
                const band = bandFor(cfg, avg);
                scores.forEach((sc, i) => {
                    const val = sc === null && cfg.missingMarkPolicy === 'zero' ? 0 : sc;
                    if (val !== null) { seqPoints[i] += val * sb.coefficient; seqCoefs[i] += sb.coefficient; }
                });
                const total = avg * sb.coefficient;
                gPoints += total; gCoef += sb.coefficient; taken += 1;
                if (avg >= cfg.passMark) passed += 1;
                rows.push({
                    name: sb.name,
                    seq: scores.map(s => round(s, cfg)),
                    seq_fail: scores.map(s => s !== null && s < cfg.passMark),
                    avg: round(avg, cfg),
                    fail: avg < cfg.passMark,
                    coef: sb.coefficient,
                    total: round(total, cfg),
                    rank: subjRank.get(`${st.id}|${sb.id}`),
                    class_avg: round(subjClassAvg.get(sb.id), cfg),
                    teacher: sb.teacher_name || '',
                    remark: band ? band.label : '',
                    remark_fail: Boolean(band && band.isFail),
                });
            }
            if (!rows.length) return;
            const gAvg = gPoints / gCoef;
            const gBand = bandFor(cfg, gAvg);
            const seqAvgs = seqPoints.map((p, i) => (seqCoefs[i] ? p / seqCoefs[i] : null));
            groupVms.push({
                name: grp.name,
                rows,
                padding: Math.max(0, (grp.min_rows || 0) - rows.length),
                subtotal: { seq: seqPoints.map(p => round(p, cfg)), coef: gCoef, total: round(gPoints, cfg) },
                average: {
                    label: `Average ${index + 1}`,
                    seq: seqAvgs.map(a => round(a, cfg)),
                    seq_fail: seqAvgs.map(a => a !== null && a < cfg.passMark),
                    total: round(gAvg, cfg),
                    fail: gAvg < cfg.passMark,
                },
                remark: gBand ? gBand.label : '',
                remark_fail: Boolean(gBand && gBand.isFail),
            });
            totalPoints += gPoints; totalCoef += gCoef;
        });

        // 3. Term history box ("Seq. 1,2 | Seq. 3,4 | Seq. 5,6") and annual average.
        const tAvg = round(termAvg.get(st.id), cfg);
        const termValues = [];
        const termHistory = Object.keys(cfg.termSequences).map(Number).sort((a, b) => a - b).map(t => {
            let value = null;
            if (t === term) value = tAvg;
            else if (t < term) {
                value = historicalTermAverages[st.id]?.[t] ?? null;
                if (value === null) value = round(termAverage(st.id, classroom, marks, t, cfg), cfg);
            }
            if (value !== null) termValues.push(value);
            return { label: 'Seq. ' + cfg.termSequences[t].join(','), avg: value };
        });
        const annual = term >= cfg.showAnnualFromTerm ? round(mean(termValues), cfg) : null;
        const decisive = annual !== null ? annual : tAvg;
        let status = '';
        if (decisive !== null) {
            const threshold = annual !== null ? cfg.promotionAverage : cfg.passMark;
            status = decisive >= threshold ? cfg.statusPassed : cfg.statusFailed;
        }
        const councilBand = bandFor(cfg, tAvg);
        const [labelEn, labelFr] = cfg.termLabels[term];

        return {
            school,
            classroom: { name: classroom.name, section: classroom.section, academic_year: classroom.academic_year },
            term: { no: term, label_en: labelEn, label_fr: labelFr, reopening_date: termInfo.reopening_date || null },
            student: st,
            seq_labels: seqs.map(q => `Seq. ${q}`),
            groups: groupVms,
            totals: {
                coef: totalCoef,
                points: round(totalPoints, cfg),
                average: tAvg,
                average_fail: tAvg !== null && tAvg < cfg.passMark,
                rank: overallRank.get(st.id),
                class_size: classSize,
                class_average: round(classAverage, cfg),
                subjects_passed: passed,
                subjects_taken: taken,
            },
            term_history: termHistory,
            annual_average: annual,
            status,
            status_fail: status === cfg.statusFailed,
            discipline: { absences: 0, council_attendance: 0, warnings: 0, suspensions: 0, ...(discipline[st.id] || {}) },
            owing: owing[st.id] || 0,
            council_remark: councilRemarks[st.id] || (councilBand ? councilBand.label : ''),
        };
    });
}

module.exports = { DEFAULT_CONFIG, buildReportCards, termAverage, bandFor, markKey };
