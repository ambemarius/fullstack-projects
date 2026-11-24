// Report card templates a school can choose from. The figures always come from utils/reportCardEngine.js;
// a template only decides the layout, the language, the remark scale and the class council's options.
//
//   classic      bilingual "STUDENT REPORT CARD | BULLETIN DE NOTES" (views/report-card-print.ejs)
//   anglophone   MINESEC layout in English          (views/report-card-minesec.ejs)
//   francophone  MINESEC layout in French           (views/report-card-minesec.ejs)
//   technical    MINESEC layout, bilingual          (views/report-card-minesec.ejs)
//   auto         anglophone or francophone, from the class's section
//
// Remark scales and distinction thresholds are common-practice defaults: change them here.

const TEMPLATE_CHOICES = Object.freeze([
    { id: 'classic', label: 'Classic bilingual (English | French)' },
    { id: 'anglophone', label: 'MINESEC – Anglophone (English)' },
    { id: 'francophone', label: 'MINESEC – Francophone (French)' },
    { id: 'technical', label: 'MINESEC – Technical (bilingual)' },
    { id: 'auto', label: 'Automatic: English for Anglophone classes, French for Francophone classes' },
]);
const TEMPLATE_IDS = TEMPLATE_CHOICES.map(t => t.id);

const EN = {
    lang: 'en', title: 'STUDENT REPORT CARD', year: 'SCHOOL YEAR', mat: 'Registration No.', name: 'Name of student',
    klass: 'Class', born: 'Date of birth', enrol: 'Enrolment', rep: 'Repeater', yes: 'Yes', no: 'No',
    parent: "Parent's/Guardian's address", section: 'SECTION', subject: 'SUBJECTS', avg: 'Avg', coef: 'Coef',
    total: 'Avg×Coef', rank: 'Pos.', cavg: 'Class avg', teacher: 'Teacher', remark: "Teacher's remark",
    subtotal: 'Sub Total', gavg: 'Average', total_row: 'TOTAL', term_avg: 'Term average', position: 'Position',
    out_of: 'out of', class_avg: 'Class average', annual: 'Annual average', passed: 'Subjects passed', status: 'Status',
    disc: 'DISCIPLINE', abs: 'Absences (hours)', just: 'Justified', unjust: 'Unjustified', late: 'Lateness',
    warn: 'Warnings', susp: 'Suspensions', council: 'Disciplinary council', decision: 'CLASS COUNCIL DECISION',
    work: 'Work', conduct: 'Conduct', stats: 'CLASS RESULTS', high: 'Highest average', low: 'Lowest average',
    rate: 'Pass rate', hist: 'TERM AVERAGES', cremark: 'Council remark', reopen: 'School reopens',
    owing: 'Fees owing', master: 'Class master', psign: 'Parent/Guardian', principal: 'The Principal',
    no_marks: 'No marks recorded for this term yet.',
};
const FR = {
    lang: 'fr', title: 'BULLETIN DE NOTES', year: 'ANNÉE SCOLAIRE', mat: 'Matricule', name: 'Nom et prénoms',
    klass: 'Classe', born: 'Né(e) le', enrol: 'Effectif', rep: 'Redoublant(e)', yes: 'Oui', no: 'Non',
    parent: 'Adresse du parent ou tuteur', section: 'SECTION', subject: 'DISCIPLINES', avg: 'Moy.', coef: 'Coef.',
    total: 'M×C', rank: 'Rang', cavg: 'Moy. classe', teacher: 'Professeur', remark: 'Appréciation',
    subtotal: 'Total groupe', gavg: 'Moyenne', total_row: 'TOTAL', term_avg: 'Moyenne trimestrielle', position: 'Rang',
    out_of: 'sur', class_avg: 'Moyenne de la classe', annual: 'Moyenne annuelle', passed: 'Matières validées', status: 'Statut',
    disc: 'DISCIPLINE', abs: 'Absences (heures)', just: 'Justifiées', unjust: 'Non justifiées', late: 'Retards',
    warn: 'Avertissements', susp: 'Exclusions', council: 'Conseil de discipline', decision: 'DÉCISION DU CONSEIL DE CLASSE',
    work: 'Travail', conduct: 'Conduite', stats: 'RÉSULTATS DE LA CLASSE', high: 'Moyenne du premier', low: 'Moyenne du dernier',
    rate: 'Taux de réussite', hist: 'MOYENNES TRIMESTRIELLES', cremark: 'Appréciation du conseil', reopen: 'Rentrée',
    owing: 'Reste à payer', master: 'Le Professeur principal', psign: 'Visa du parent', principal: 'Le Proviseur',
    no_marks: 'Aucune note enregistrée pour ce trimestre.',
};
const both = (a, b) => (a === b ? a : `${a} | ${b}`);
const BI = { ...Object.fromEntries(Object.keys(EN).map(k => [k, both(EN[k], FR[k])])), lang: 'bi', out_of: '/' };

// [minimum average, remark, printed red]
const BANDS_EN = [[18, 'Excellent', false], [16, 'Very good', false], [14, 'Good', false], [12, 'Fairly good', false],
    [10, 'Average', false], [8, 'Weak', true], [0, 'Poor', true]];
const BANDS_FR = [[18, 'Excellent', false], [16, 'Très bien', false], [14, 'Bien', false], [12, 'Assez bien', false],
    [10, 'Passable', false], [8, 'Insuffisant', true], [0, 'Médiocre', true]];
// Work distinctions (minimum average, highest first) and work sanctions (below this average, lowest first).
const DIST_EN = [[16, 'Roll of honour + Congratulations'], [14, 'Roll of honour + Encouragement'], [12, 'Roll of honour']];
const DIST_FR = [[16, "Tableau d'honneur + Félicitations"], [14, "Tableau d'honneur + Encouragements"], [12, "Tableau d'honneur"]];
const SANC_EN = [[6, 'Reprimand (work)'], [8, 'Warning (work)']];
const SANC_FR = [[6, 'Blâme travail'], [8, 'Avertissement travail']];
const COND_EN = ['Warning (conduct)', 'Reprimand (conduct)', 'Suspension'];
const COND_FR = ['Avertissement conduite', 'Blâme conduite', 'Exclusion temporaire'];
const zipBoth = (a, b) => a.map((x, i) => [x[0], both(x[1], b[i][1]), ...x.slice(2)]);

const PRESETS = {
    anglophone: {
        labels: EN, bands: BANDS_EN, dist: DIST_EN, sanc: SANC_EN, conduct: COND_EN,
        terms: { 1: ['FIRST TERM', ''], 2: ['SECOND TERM', ''], 3: ['THIRD TERM', ''] },
        status: ['Passed', 'Failed'], annualStatus: ['Promoted', 'Repeat'],
    },
    francophone: {
        labels: FR, bands: BANDS_FR, dist: DIST_FR, sanc: SANC_FR, conduct: COND_FR,
        terms: { 1: ['PREMIER TRIMESTRE', ''], 2: ['DEUXIÈME TRIMESTRE', ''], 3: ['TROISIÈME TRIMESTRE', ''] },
        status: ['Réussi', 'Échec'], annualStatus: ['Admis(e) en classe supérieure', 'Redouble'],
    },
    technical: {
        labels: BI, bands: zipBoth(BANDS_EN, BANDS_FR), dist: zipBoth(DIST_EN, DIST_FR), sanc: zipBoth(SANC_EN, SANC_FR),
        conduct: COND_EN.map((c, i) => both(c, COND_FR[i])),
        terms: { 1: ['FIRST TERM', 'Premier trimestre'], 2: ['SECOND TERM', 'Deuxième trimestre'], 3: ['THIRD TERM', 'Troisième trimestre'] },
        status: ['Passed | Réussi', 'Failed | Échec'], annualStatus: ['Promoted | Admis(e)', 'Repeat | Redouble'],
    },
};

// The template to print with: an explicit choice wins, then the school's setting; 'auto' follows the class section.
function resolveTemplate(choice, section) {
    const id = TEMPLATE_IDS.includes(choice) ? choice : 'classic';
    if (id !== 'auto') return id;
    return /franco/i.test(String(section || '')) ? 'francophone' : 'anglophone';
}

function band(preset, avg) {
    if (avg === null || avg === undefined) return { label: '', red: false };
    for (const [minimum, label, red] of preset.bands) if (avg >= minimum) return { label, red };
    return { label: '', red: false };
}

// Adds the template's wording and decisions to one engine card (the engine's own fields stay untouched).
function decorate(card, templateId) {
    const P = PRESETS[templateId];
    if (!P) throw new Error(`Unknown report card template ${templateId}`);
    const L = P.labels;
    const t = card.totals;
    const decisive = card.annual_average !== null && card.annual_average !== undefined ? card.annual_average : t.average;
    const annual = card.annual_average !== null && card.annual_average !== undefined;
    const [ok, ko] = annual ? P.annualStatus : P.status;
    const statusRed = decisive !== null && decisive < 10;
    const d = card.discipline || {};

    // A conduct sanction removes the work distinction; suspensions and warnings come from the discipline record.
    const conduct = d.suspensions > 0 ? P.conduct[2] : d.warnings > 0 ? P.conduct[0] : '';
    let work = '';
    if (!conduct) work = (P.dist.find(([m]) => decisive !== null && decisive >= m) || [])[1] || '';
    if (!work) work = (P.sanc.find(([b]) => decisive !== null && decisive < b) || [])[1] || '';

    const [termEn, termFr] = P.terms[card.term.no];
    return {
        ...card,
        tpl: {
            id: templateId, L, term_main: termEn, term_sub: termFr,
            seq_labels: card.seq_labels.map(s => s.replace('Seq.', L.lang === 'fr' ? 'Séq.' : L.lang === 'bi' ? 'Seq. | Séq.' : 'Seq.')),
            rows: card.groups.map(g => g.rows.map(r => band(P, r.avg))),
            groups: card.groups.map((g, i) => {
                const b = band(P, g.average.total);
                return { avg_label: `${L.gavg} ${i + 1}`, remark: b.label, red: b.red };
            }),
            status: decisive === null ? '' : statusRed ? ko : ok,
            status_red: statusRed,
            work_opts: [...P.dist, ...[...P.sanc].reverse()].map(([, label]) => ({ label, on: label === work })),
            cond_opts: P.conduct.map(label => ({ label, on: label === conduct })),
            council_remark: card.council_remark_set ? card.council_remark : band(P, decisive).label,
            history: card.term_history.map(h => ({ ...h, label: h.label.replace('Seq.', L.lang === 'fr' ? 'Séq.' : 'Seq.') })),
        },
    };
}

module.exports = { TEMPLATE_CHOICES, TEMPLATE_IDS, PRESETS, resolveTemplate, decorate, band };
