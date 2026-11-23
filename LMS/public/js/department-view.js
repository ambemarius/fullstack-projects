// Shared display of a department report (Head of Department tab and the admin "Subject results").
//   DepartmentView.body(report)              -> HTML of the report (figures, enrolment, results, marks, grades, teachers)
//   DepartmentView.csv(report, { period, me, remarks }) -> CSV text
//   DepartmentView.download(text, filename)  -> saves a CSV file
(function () {
  const num = v => (v === null || v === undefined ? '—' : String(v));
  const pct = v => (v === null || v === undefined ? '—' : v + '%');

  function resultCells(r, tag = 'td') {
    return [r, r.girls, r.boys].map(p => '<' + tag + ' class="num">' + p.sat + '</' + tag + '><' + tag + ' class="num">' + p.passed + '</' + tag + '>' +
      '<' + tag + ' class="num' + (p.passRate !== null && p.passRate < 50 ? ' hod-low' : '') + '">' + pct(p.passRate) + '</' + tag + '>').join('');
  }


  const TABS = [['enrolment', 'Class enrolment'], ['results', 'Results by class'], ['marks', 'Marks by class'], ['grades', 'Grade spread'], ['best', 'Best students'], ['teachers', 'By teacher']];
  function activeTab() {
    let saved = null;
    try { saved = localStorage.getItem('deptTab'); } catch (_) {}
    return TABS.some(([k]) => k === saved) ? saved : 'results';
  }
  function tabBar() {
    const on = activeTab();
    return '<div class="dv-tabs" role="tablist" aria-label="Report sections">' + TABS.map(([k, label]) =>
      '<button type="button" role="tab" class="dv-tab" id="dv-t-' + k + '" data-dv-tab="' + k + '" aria-controls="dv-p-' + k + '" aria-selected="' + (k === on) + '"' + (k === on ? '' : ' tabindex="-1"') + '>' + label + '</button>').join('') + '</div>';
  }
  function select(button, focus) {
    const root = button.closest('.dv');
    const key = button.dataset.dvTab;
    root.dataset.dvActive = key;
    root.querySelectorAll('.dv-tab').forEach(b => {
      const on = b === button;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    if (focus) button.focus();
    try { localStorage.setItem('deptTab', key); } catch (_) {}
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.dv-tab'); if (b) select(b); });
    // Arrow keys move between the tabs; Home/End jump to the ends.
    document.addEventListener('keydown', e => {
      const b = e.target.closest && e.target.closest('.dv-tab');
      if (!b) return;
      const list = [...b.parentElement.querySelectorAll('.dv-tab')];
      const i = list.indexOf(b);
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(list[(next + list.length) % list.length], true);
    });
  }

  function body(d) {
    const t = d.totals;
    const stat = (v, l, cls) => '<div class="tp-card tp-stat' + (cls ? ' ' + cls : '') + '"><div class="tp-v">' + esc(v) + '</div><div class="tp-l">' + esc(l) + '</div></div>';
    const seqHead = d.sequences.map(n => '<th class="num">Seq. ' + n + '</th>').join('');
    const classRows = d.classes.map(c => '<tr>' +
      '<td><strong>' + esc(c.className) + '</strong></td>' +
      '<td>' + (c.teachers.length ? esc(c.teachers.join(', ')) : '<span class="muted">Not assigned</span>') + '</td>' +
      '<td class="num">' + c.students + '</td>' +
      '<td class="num' + (c.completion !== null && c.completion < 100 ? ' hod-warn' : '') + '">' + c.marksEntered + '/' + c.marksExpected + '</td>' +
      d.sequences.map(n => '<td class="num">' + num(c.sequenceAverages[n]) + '</td>').join('') +
      '<td class="num hod-avg' + (c.average !== null && c.average < 10 ? ' hod-low' : '') + '"><strong>' + num(c.average) + '</strong></td>' +
      '<td class="num">' + num(c.highest) + '</td><td class="num">' + num(c.lowest) + '</td>' +
      '<td class="num">' + c.passed + '/' + c.assessed + '</td>' +
      '<td class="num' + (c.passRate !== null && c.passRate < 50 ? ' hod-low' : '') + '">' + pct(c.passRate) + '</td></tr>').join('');
    const deptSeq = d.sequences.map(n => {
      const v = d.classes.map(c => c.sequenceAverages[n]).filter(x => x !== null);
      return '<th class="num">' + (v.length ? (Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100) : '—') + '</th>';
    }).join('');
    const g = t.grades;
    const R = t.results;
    const gradeCells = ['A', 'B', 'C', 'D', 'F'].map(k => '<td class="num">' + g[k] + (t.assessed ? ' <span class="muted">(' + Math.round(g[k] / t.assessed * 100) + '%)</span>' : '') + '</td>').join('');
    return (
      '<div class="dv" data-dv-active="' + activeTab() + '">' +
      '<div class="tp-stats hod-stats">' +
        stat(R.sat, 'Sat (' + t.enrolment.total + ' on the class lists)') +
        stat(pct(R.passRate), 'Passed (' + R.passed + ' of ' + R.sat + ')', R.passRate !== null && R.passRate < 50 ? 'is-alert' : '') +
        stat(pct(R.girls.passRate), 'Girls passed (' + R.girls.passed + ' of ' + R.girls.sat + ')', R.girls.passRate !== null && R.girls.passRate < 50 ? 'is-alert' : '') +
        stat(pct(R.boys.passRate), 'Boys passed (' + R.boys.passed + ' of ' + R.boys.sat + ')', R.boys.passRate !== null && R.boys.passRate < 50 ? 'is-alert' : '') +
        stat(num(t.average) + '/20', 'Department average') +
        stat(pct(t.completion), 'Marks entered (' + t.marksEntered + '/' + t.marksExpected + ')', t.completion < 100 ? 'is-alert' : '') +
      '</div>' +
      tabBar() +
      '<div class="tp-card tp-pad hod-block dv-panel" data-dv-panel="enrolment" role="tabpanel" id="dv-p-enrolment" aria-labelledby="dv-t-enrolment"><h2>Class enrolment</h2><div class="table-wrap"><table class="hod-table"><thead><tr><th>Class</th><th class="num">Students</th><th class="num">Boys</th><th class="num">Girls</th><th class="num">% Boys</th><th class="num">% Girls</th></tr></thead><tbody>' +
        d.classes.map(c => '<tr><td><strong>' + esc(c.className) + '</strong></td><td class="num">' + c.enrolment.total + '</td><td class="num">' + c.enrolment.boys + '</td><td class="num">' + c.enrolment.girls + '</td><td class="num">' + pct(c.enrolment.boysPercent) + '</td><td class="num">' + pct(c.enrolment.girlsPercent) + '</td></tr>').join('') +
        '</tbody><tfoot><tr><th>Department</th><th class="num">' + t.enrolment.total + '</th><th class="num">' + t.enrolment.boys + '</th><th class="num">' + t.enrolment.girls + '</th><th class="num">' + pct(t.enrolment.boysPercent) + '</th><th class="num">' + pct(t.enrolment.girlsPercent) + '</th></tr></tfoot></table></div></div>' +
      '<div class="tp-card tp-pad hod-block dv-panel" data-dv-panel="results" role="tabpanel" id="dv-p-results" aria-labelledby="dv-t-results"><h2>Results by class</h2><div class="table-wrap"><table class="hod-table hod-results"><thead>' +
        '<tr><th rowspan="2">Class</th><th colspan="3" class="hod-group">All students</th><th colspan="3" class="hod-group">Girls</th><th colspan="3" class="hod-group">Boys</th></tr>' +
        '<tr>' + ['All', 'Girls', 'Boys'].map(() => '<th class="num">Sat</th><th class="num">Passed</th><th class="num">% Passed</th>').join('') + '</tr></thead><tbody>' +
        d.classes.map(c => '<tr><td><strong>' + esc(c.className) + '</strong></td>' + resultCells(c.results) + '</tr>').join('') +
        '</tbody><tfoot><tr><th>Department</th>' + resultCells(R, 'th') + '</tr></tfoot></table></div>' +
        '<p class="muted hod-note">Sat = students with at least one mark in the period. Passed = average of 10/20 or more.</p></div>' +
      '<div class="tp-card tp-pad hod-block dv-panel" data-dv-panel="marks" role="tabpanel" id="dv-p-marks" aria-labelledby="dv-t-marks"><h2>Marks by class</h2><div class="table-wrap"><table class="hod-table"><thead><tr><th>Class</th><th>Teacher</th><th class="num">Students</th><th class="num">Marks entered</th>' +
        seqHead + '<th class="num hod-avg">Average</th><th class="num">Highest</th><th class="num">Lowest</th><th class="num">Passed</th><th class="num">Pass rate</th></tr></thead><tbody>' + classRows + '</tbody>' +
        '<tfoot><tr><th>Department</th><th></th><th class="num">' + t.students + '</th><th class="num">' + t.marksEntered + '/' + t.marksExpected + '</th>' + deptSeq +
        '<th class="num hod-avg">' + num(t.average) + '</th><th class="num">' + num(t.highest) + '</th><th class="num">' + num(t.lowest) + '</th><th class="num">' + t.passed + '/' + t.assessed + '</th><th class="num">' + pct(t.passRate) + '</th></tr></tfoot></table></div>' +
        '<p class="muted hod-note">Marks entered = marks recorded out of students × sequences. Classes below a 10/20 average or a 50% pass rate are in red; incomplete mark entry in amber.</p></div>' +
        '<div class="tp-card tp-pad hod-block dv-panel" data-dv-panel="grades" role="tabpanel" id="dv-p-grades" aria-labelledby="dv-t-grades"><h2>Grade spread</h2><div class="table-wrap"><table class="hod-table"><thead><tr><th class="num">A (16–20)</th><th class="num">B (14–15.99)</th><th class="num">C (12–13.99)</th><th class="num">D (10–11.99)</th><th class="num">F (below 10)</th></tr></thead><tbody><tr>' + gradeCells + '</tr></tbody></table></div>' +
          '<p class="muted hod-note">Spread of ' + t.assessed + ' students. Standard deviation ' + num(t.standardDeviation) + '.</p></div>' +
        '<div class="tp-card tp-pad hod-block dv-panel" data-dv-panel="best" role="tabpanel" id="dv-p-best" aria-labelledby="dv-t-best"><h2>Best students</h2><ol class="hod-top">' + d.top.map(s => '<li><strong>' + esc(s.name) + '</strong> <span class="muted">' + esc(s.className) + '</span><span class="hod-top-mark">' + esc(s.mark) + '</span></li>').join('') + '</ol></div>' +
      '<div class="tp-card tp-pad hod-block dv-panel" data-dv-panel="teachers" role="tabpanel" id="dv-p-teachers" aria-labelledby="dv-t-teachers"><h2>By teacher</h2><div class="table-wrap"><table class="hod-table"><thead><tr><th>Teacher</th><th>Classes</th><th class="num">Average</th><th class="num">Sat</th><th class="num">Passed</th><th class="num">% Passed</th><th class="num">% Girls passed</th><th class="num">% Boys passed</th></tr></thead><tbody>' +
        d.teachers.map(x => '<tr><td><strong>' + esc(x.name) + '</strong></td><td>' + esc(x.classes.join(', ')) + '</td><td class="num' + (x.average !== null && x.average < 10 ? ' hod-low' : '') + '">' + num(x.average) + '</td>' +
          '<td class="num">' + x.results.sat + '</td><td class="num">' + x.results.passed + '</td>' + [x.results.passRate, x.results.girls.passRate, x.results.boys.passRate].map(v => '<td class="num' + (v !== null && v < 50 ? ' hod-low' : '') + '">' + pct(v) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div></div>' +
      '</div>');
  }

  function csv(d, opts = {}) {
    const cell = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const line = a => a.map(cell).join(',');
    const t = d.totals, dept = d.department;
    const lines = [
      line(['Head of Department report', dept.subjectName, dept.section || 'Whole school', d.year.name, opts.period]),
      line(['Prepared by', opts.me || '', new Date().toISOString().slice(0, 10)]), '',
      line(['Class', 'Students', 'Boys', 'Girls', '% Boys', '% Girls', 'Sat', 'Passed', '% Passed', 'Girls sat', 'Girls passed', '% Girls passed', 'Boys sat', 'Boys passed', '% Boys passed']),
      ...d.classes.map(c => line([c.className, c.enrolment.total, c.enrolment.boys, c.enrolment.girls, c.enrolment.boysPercent, c.enrolment.girlsPercent,
        c.results.sat, c.results.passed, c.results.passRate, c.results.girls.sat, c.results.girls.passed, c.results.girls.passRate, c.results.boys.sat, c.results.boys.passed, c.results.boys.passRate])),
      line(['Department', t.enrolment.total, t.enrolment.boys, t.enrolment.girls, t.enrolment.boysPercent, t.enrolment.girlsPercent,
        t.results.sat, t.results.passed, t.results.passRate, t.results.girls.sat, t.results.girls.passed, t.results.girls.passRate, t.results.boys.sat, t.results.boys.passed, t.results.boys.passRate]), '',
      line(['Class', 'Teacher', 'Students', 'Marks entered', 'Marks expected', ...d.sequences.map(n => 'Seq. ' + n + ' average'), 'Average', 'Highest', 'Lowest', 'Assessed', 'Passed', 'Pass rate %', 'A', 'B', 'C', 'D', 'F']),
      ...d.classes.map(c => line([c.className, c.teachers.join(' / '), c.students, c.marksEntered, c.marksExpected, ...d.sequences.map(n => c.sequenceAverages[n]), c.average, c.highest, c.lowest, c.assessed, c.passed, c.passRate, c.grades.A, c.grades.B, c.grades.C, c.grades.D, c.grades.F])),
      line(['Department', '', t.students, t.marksEntered, t.marksExpected, ...d.sequences.map(() => ''), t.average, t.highest, t.lowest, t.assessed, t.passed, t.passRate, t.grades.A, t.grades.B, t.grades.C, t.grades.D, t.grades.F]), '',
      line(['Teacher', 'Classes', 'Average', 'Sat', 'Passed', '% Passed', '% Girls passed', '% Boys passed']),
      ...d.teachers.map(x => line([x.name, x.classes.join(' / '), x.average, x.results.sat, x.results.passed, x.results.passRate, x.results.girls.passRate, x.results.boys.passRate])),
    ];
    if (opts.remarks) lines.push('', line(['Remarks', opts.remarks]));
    return '\ufeff' + lines.join('\r\n');
  }

  function download(text, filename) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  window.DepartmentView = { body, csv, download, resultCells, num, pct };
})();
