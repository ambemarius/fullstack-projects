const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildReportCards, DEFAULT_CONFIG } = require('../utils/reportCardEngine');
const { code128Svg } = require('../utils/code128');
// Figures produced by the original Python report_card engine for a 52-student class
// (tests/fixtures/report-card-reference.json was generated from report_card_module/examples/sample_payload.json).
const { payload, expected } = require('./fixtures/report-card-reference.json');

const slim = c => ({
    id: c.student.id, t: c.totals, h: c.term_history.map(x => x.avg), a: c.annual_average, s: c.status, r: c.council_remark,
    g: c.groups.map(g => ({
        n: g.name, p: g.padding, st: [g.subtotal.seq, g.subtotal.coef, g.subtotal.total], av: [g.average.seq, g.average.total, g.average.fail], rm: [g.remark, g.remark_fail],
        rows: g.rows.map(r => [r.name, r.seq, r.seq_fail, r.avg, r.fail, r.coef, r.total, r.rank, r.class_avg, r.teacher, r.remark, r.remark_fail]),
    })),
});

function run({ term, history = true, config = DEFAULT_CONFIG }) {
    const c = payload.classroom;
    return buildReportCards({ name_en: 'S', name_fr: 'S' }, c, payload.students, payload.marks, { term },
        { historicalTermAverages: history ? payload.historical_term_averages : {}, config });
}

for (const [name, opts] of Object.entries({
    term3: { term: 3 },
    term1: { term: 1, history: false },
    term2_zero: { term: 2, config: { ...DEFAULT_CONFIG, missingMarkPolicy: 'zero' } },
})) {
    test(`matches the Python engine for all 52 students (${name})`, () => {
        const cards = run(opts);
        assert.equal(cards.length, expected[name].length);
        cards.forEach((card, i) => assert.deepEqual(slim(card), expected[name][i], `student ${card.student.id}`));
    });
}

test('reference card figures (student 1, third term)', () => {
    const card = run({ term: 3 })[0];
    const rows = Object.fromEntries(card.groups.flatMap(g => g.rows.map(r => [r.name, r])));
    assert.deepEqual([rows.GEOGRAPHY.avg, rows.GEOGRAPHY.total], [10.5, 31.5]);
    assert.equal(rows.BIOLOGY.remark, 'VERY WEAK');
    assert.equal(rows['ENGLISH LANGUAGE'].remark, 'EXCELLENT');
    assert.deepEqual(rows.FRENCH.seq_fail, [true, false]);
    const [gen, tec, oth] = card.groups;
    assert.deepEqual([gen.subtotal.coef, gen.subtotal.total, gen.average.total], [27, 328, 12.15]);
    assert.deepEqual(tec.subtotal.seq, [138, 168]);
    assert.equal(tec.padding, 4, 'Technical Education padded to 7 rows');
    assert.deepEqual(oth.subtotal, { seq: [65, 70], coef: 5, total: 67.5 });
    assert.deepEqual([card.totals.coef, card.totals.points, card.totals.average], [41, 548.5, 13.38]);
    assert.deepEqual([card.totals.subjects_passed, card.totals.subjects_taken, card.totals.class_size], [11, 13, 52]);
    assert.deepEqual(card.term_history.map(h => h.avg), [14.1, 10.99, 13.38]);
    assert.equal(card.annual_average, 12.82);
    assert.equal(card.status, 'Passed/Réussi');
    assert.equal(card.council_remark, 'GOOD');
});

function miniClass(scores, policy = 'ignore') {
    const room = { id: 'c', name: 'X', section: 'S', academic_year: '2025-2026', groups: [{ id: 'g', name: 'G' }],
        subjects: [{ id: 'a', name: 'A', group_id: 'g', coefficient: 2 }, { id: 'b', name: 'B', group_id: 'g', coefficient: 1 }] };
    const students = Object.keys(scores).map(id => ({ id, matricule: id, full_name: id }));
    const marks = Object.entries(scores).flatMap(([id, d]) => Object.entries(d).map(([k, v]) => { const [subj, q] = k.split(':'); return [id, subj, Number(q), v]; }));
    return buildReportCards({ name_en: 'S', name_fr: 'S' }, room, students, marks, { term: 1 }, { config: { ...DEFAULT_CONFIG, missingMarkPolicy: policy } });
}

test('ties share a position and failing students are marked', () => {
    const same = { 'a:1': 12, 'a:2': 12, 'b:1': 12, 'b:2': 12 };
    const cards = miniClass({ p: same, q: same, r: { 'a:1': 8, 'a:2': 8, 'b:1': 8, 'b:2': 8 } });
    assert.deepEqual(cards.map(c => c.totals.rank), [1, 1, 3]);
    assert.equal(cards[0].totals.class_average, Number(((12 + 12 + 8) / 3).toFixed(2)));
    assert.equal(cards[2].status, 'Failed/Échoué');
    assert.equal(cards[0].annual_average, null, 'no annual average before the third term');
});

test('missing-mark policies and subjects not taken', () => {
    const data = { p: { 'a:1': 16, 'a:2': null, 'b:1': 10, 'b:2': 10 } };
    const row = (cards, n) => cards[0].groups[0].rows.find(r => r.name === n);
    assert.equal(row(miniClass(data, 'ignore'), 'A').avg, 16);
    assert.equal(row(miniClass(data, 'zero'), 'A').avg, 8);
    const elective = miniClass({ p: { 'a:1': 12, 'a:2': 14 } })[0];
    assert.deepEqual(elective.groups[0].rows.map(r => r.name), ['A'], 'a subject with no marks is left off the card');
    assert.equal(elective.totals.coef, 2);
    const empty = miniClass({ p: {} })[0];
    assert.deepEqual([empty.groups.length, empty.totals.average, empty.totals.rank, empty.status], [0, null, null, '']);
});

test('Code 128 barcode encodes the matricule as an SVG with a valid checksum', () => {
    const svg = code128Svg('AA00016');
    assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ 40"/);
    assert.match(svg, /<title>AA00016<\/title>/);
    // Start B (104) + 7 characters + checksum + stop = 10 symbols: 9 x 11 modules + 13 stop modules + 2 x 10 quiet zone.
    assert.match(svg, /viewBox="0 0 132 40"/);
    assert.equal(code128Svg(''), '');
    assert.equal(code128Svg('é'), '', 'characters outside Code 128 B are refused');
    assert.match(code128Svg('<x&"'), /<title>&lt;x&amp;&quot;<\/title>/);
});
