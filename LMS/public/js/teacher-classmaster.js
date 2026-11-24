// Teacher portal: "Class master" tab, shown only to a class master.
// End-of-term report of their class: enrolment, results for girls and boys, class average, best and weakest
// subject, every subject, the ranking, students to watch and attendance. Print / PDF and CSV for the administration.
(function () {
  const link = document.getElementById('tw-tab-myclass');
  const form = document.getElementById('cmForm');
  if (!link || !form) return;
  const classSel = document.getElementById('cmClass');
  const yearSel = document.getElementById('cmYear');
  const termSel = document.getElementById('cmTerm');
  const box = document.getElementById('cmReport');
  const remarks = document.getElementById('cmRemarks');
  const remarksPrint = document.getElementById('cmRemarksPrint');
  const csvBtn = document.getElementById('cmCsv');
  const printBtn = document.getElementById('cmPrint');
  const { num, pct, resultCells } = window.DepartmentView;
  let data = null;

  const TABS = [['overview', 'Overview'], ['subjects', 'Subjects'], ['ranking', 'Ranking'], ['watch', 'Students to watch'], ['attendance', 'Attendance']];
  const remarksKey = () => 'cmRemarks:' + classSel.value + ':' + yearSel.value + ':' + termSel.value;
  const title = s => String(s || '').toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const savedTab = () => { let t = null; try { t = localStorage.getItem('cmTab'); } catch (_) {} return TABS.some(([k]) => k === t) ? t : 'overview'; };

  async function start() {
    const res = await api('/class-master/options');
    if (!res.ok || !res.data.data.classes.length) return;   // not a class master: the tab stays hidden
    const o = res.data.data;
    link.hidden = false;
    classSel.innerHTML = o.classes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>').join('');
    yearSel.innerHTML = o.years.map(y => '<option value="' + esc(y.id) + '"' + (y.isCurrent ? ' selected' : '') + '>' + esc(y.name) + (y.isCurrent ? ' (current)' : '') + '</option>').join('');
    const m = new Date().getMonth() + 1;
    termSel.value = m >= 9 || m <= 1 ? 'First' : m <= 4 ? 'Second' : 'Third';
    twLoaders.myclass = load;
    if (location.hash === '#myclass') twShow('myclass', { updateHash: false });
  }

  async function load() {
    box.innerHTML = '<div class="tp-card tp-pad"><p class="muted">Building the report…</p></div>';
    csvBtn.disabled = printBtn.disabled = true;
    const res = await api('/class-master/report?' + new URLSearchParams({ classId: classSel.value, yearId: yearSel.value || '', term: termSel.value }));
    if (!res.ok) {
      data = null;
      box.innerHTML = '<div class="tp-card tp-pad"><p class="msg error" role="alert">' + esc((res.data && res.data.message) || 'Could not build the report.') + '</p></div>';
      return;
    }
    data = res.data.data;
    try { remarks.value = localStorage.getItem(remarksKey()) || ''; } catch (_) { remarks.value = ''; }
    remarksPrint.textContent = remarks.value;
    render();
    csvBtn.disabled = printBtn.disabled = !data.students.length;
  }

  function render() {
    const d = data, R = d.results, e = d.enrolment;
    const me = document.getElementById('tpUserName').textContent || d.classMaster || '';
    document.getElementById('cmTitle').textContent = 'Class master — ' + d.className;
    document.getElementById('cmPrintTitle').textContent = "Class master's report — " + d.className;
    document.getElementById('cmPrintMeta').textContent = d.yearName + ' · ' + d.term + ' term · Class master: ' + (d.classMaster || me) + ' · Printed ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('cmSignName').textContent = (d.classMaster || me ? (d.classMaster || me) + ', ' : '') + 'Class master';
    if (!d.students.length) {
      box.innerHTML = '<div class="tp-card tp-pad"><p class="muted">There are no students on this class list.</p></div>';
      return;
    }
    const stat = (v, l, cls) => '<div class="tp-card tp-stat' + (cls ? ' ' + cls : '') + '"><div class="tp-v">' + esc(v) + '</div><div class="tp-l">' + esc(l) + '</div></div>';
    const low = v => v !== null && v !== undefined && v < 50;
    const red = v => (v !== null && v !== undefined && v < 10 ? ' hod-low' : '');
    const on = savedTab();
    const panel = (key, h, inner) => '<div class="tp-card tp-pad hod-block cm-panel" data-cm-panel="' + key + '" role="tabpanel" id="cm-p-' + key + '" aria-labelledby="cm-t-' + key + '"' + (key === on ? '' : ' hidden') + '><h2>' + h + '</h2>' + inner + '</div>';
    const table = (head, rows, foot) => '<div class="table-wrap"><table class="hod-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>';
    const resultsHead = '<tr><th rowspan="2">' + '%LABEL%' + '</th><th colspan="3" class="hod-group">All students</th><th colspan="3" class="hod-group">Girls</th><th colspan="3" class="hod-group">Boys</th></tr><tr>' +
      [0, 1, 2].map(() => '<th class="num">Sat</th><th class="num">Passed</th><th class="num">% Passed</th>').join('') + '</tr>';
    const best = d.bestSubject, worst = d.worstSubject;

    const overview =
      '<div class="cm-highlights">' +
        '<div class="tp-card cm-highlight is-good"><h3>Best subject</h3><div class="cm-big">' + (best ? esc(title(best.name)) + ' · ' + num(best.average) : '—') + '</div>' +
          (best ? '<div class="muted">' + esc(best.teacher || '') + ' · ' + pct(best.results.passRate) + ' passed</div>' : '') + '</div>' +
        '<div class="tp-card cm-highlight is-bad"><h3>Weakest subject</h3><div class="cm-big">' + (worst ? esc(title(worst.name)) + ' · ' + num(worst.average) : '—') + '</div>' +
          (worst ? '<div class="muted">' + esc(worst.teacher || '') + ' · ' + pct(worst.results.passRate) + ' passed</div>' : '') + '</div>' +
      '</div>' +
      '<h3 class="cm-sub">Class enrolment</h3>' +
      table('<tr><th class="num">Students</th><th class="num">Boys</th><th class="num">Girls</th><th class="num">% Boys</th><th class="num">% Girls</th></tr>',
        '<tr><td class="num">' + e.total + '</td><td class="num">' + e.boys + '</td><td class="num">' + e.girls + '</td><td class="num">' + pct(e.boysPercent) + '</td><td class="num">' + pct(e.girlsPercent) + '</td></tr>') +
      '<h3 class="cm-sub">Results of the term (general average)</h3>' +
      table(resultsHead.replace('%LABEL%', 'Class'), '<tr><td><strong>' + esc(d.className) + '</strong></td>' + resultCells(R) + '</tr>') +
      '<h3 class="cm-sub">Spread of averages</h3>' +
      table('<tr>' + d.bands.map(b => '<th class="num">' + esc(b.label) + '</th>').join('') + '</tr>',
        '<tr>' + d.bands.map(b => '<td class="num">' + b.count + (R.sat ? ' <span class="muted">(' + Math.round(b.count / R.sat * 100) + '%)</span>' : '') + '</td>').join('') + '</tr>') +
      '<h3 class="cm-sub">Best students</h3><ol class="hod-top">' + d.best.slice(0, 5).map(s => '<li><strong>' + esc(s.name) + '</strong> <span class="muted">' + esc(s.sex || '') + '</span><span class="hod-top-mark">' + num(s.average) + '</span></li>').join('') + '</ol>';

    const subjects = table(
      '<tr><th>Subject</th><th>Teacher</th><th class="num">Coef.</th><th class="num hod-avg">Class average</th><th class="num">Highest</th><th class="num">Lowest</th><th class="num">Sat</th><th class="num">Passed</th><th class="num">% Passed</th><th class="num">% Girls passed</th><th class="num">% Boys passed</th><th class="num">Marks entered</th><th>Best student</th></tr>',
      d.subjects.map(s => '<tr><td><strong>' + esc(title(s.name)) + '</strong></td><td>' + esc(s.teacher || '—') + '</td><td class="num">' + num(s.coefficient) + '</td>' +
        '<td class="num hod-avg' + red(s.average) + '"><strong>' + num(s.average) + '</strong></td><td class="num">' + num(s.highest) + '</td><td class="num' + red(s.lowest) + '">' + num(s.lowest) + '</td>' +
        '<td class="num">' + s.results.sat + '</td><td class="num">' + s.results.passed + '</td>' +
        [s.results.passRate, s.results.girls.passRate, s.results.boys.passRate].map(v => '<td class="num' + (low(v) ? ' hod-low' : '') + '">' + pct(v) + '</td>').join('') +
        '<td class="num' + (s.marksEntered < s.marksExpected ? ' hod-warn' : '') + '">' + s.marksEntered + '/' + s.marksExpected + '</td>' +
        '<td>' + (s.best ? esc(s.best.name) + ' <span class="muted">(' + num(s.best.mark) + ')</span>' : '—') + '</td></tr>').join('')) +
      '<p class="muted hod-note">Subjects are listed from the best class average to the weakest. Averages, coefficients and ranks are the ones printed on the report cards.</p>';

    const third = d.termNo === 3;
    const ranking = table(
      '<tr><th class="num">Rank</th><th>Student</th><th>Sex</th><th class="num hod-avg">Average</th>' + (third ? '<th class="num">Annual</th>' : '') + '<th class="num">Subjects passed</th><th class="num">Absences (h)</th><th>Remark</th></tr>',
      d.students.map(s => '<tr><td class="num cm-rank">' + num(s.rank) + '</td><td><strong>' + esc(s.name) + '</strong>' + (s.repeater ? ' <span class="badge">Repeater</span>' : '') + '<br><span class="muted">' + esc(s.matricule || '') + '</span></td><td>' + esc(s.sex || '—') + '</td>' +
        '<td class="num hod-avg' + red(s.average) + '"><strong>' + num(s.average) + '</strong></td>' + (third ? '<td class="num' + red(s.annual) + '">' + num(s.annual) + '</td>' : '') +
        '<td class="num">' + s.subjectsPassed + '/' + s.subjectsTaken + '</td><td class="num">' + num(s.absences) + '</td><td>' + esc(s.remark || '') + '</td></tr>').join(''),
      '<tr><th colspan="3">Class average</th><th class="num hod-avg">' + num(d.classAverage) + '</th>' + (third ? '<th></th>' : '') + '<th colspan="3">Highest ' + num(d.highest) + ' · lowest ' + num(d.lowest) + '</th></tr>');

    const watch = (d.atRisk.length
      ? table('<tr><th class="num">Rank</th><th>Student</th><th class="num hod-avg">Average</th><th class="num">Subjects passed</th><th>Subjects below 10</th><th class="num">Absences (h)</th></tr>',
          d.atRisk.map(s => '<tr><td class="num cm-rank">' + num(s.rank) + '</td><td><strong>' + esc(s.name) + '</strong></td><td class="num hod-avg hod-low"><strong>' + num(s.average) + '</strong></td><td class="num">' + s.subjectsPassed + '/' + s.subjectsTaken + '</td>' +
            '<td><div class="cm-tags">' + s.weakest.map(n => '<span class="cm-tag">' + esc(title(n)) + '</span>').join('') + '</div></td><td class="num">' + num(s.absences) + '</td></tr>').join(''))
      : '<p class="muted">Every classified student has an average of 10 or more.</p>') +
      (d.notClassified.length ? '<p class="muted hod-note"><strong>Not classified (no marks this term):</strong> ' + esc(d.notClassified.join(', ')) + '.</p>' : '');

    const att = d.attendance;
    const attendance = '<div class="tp-stats cm-att-stats">' + stat(num(att.totalHours) + ' h', 'Absences this term') + stat(num(att.perStudent) + ' h', 'Per student') + '</div>' +
      (att.most.length ? '<h3 class="cm-sub">Most absent</h3>' + table('<tr><th>Student</th><th class="num">Hours absent</th></tr>', att.most.map(s => '<tr><td><strong>' + esc(s.name) + '</strong></td><td class="num">' + num(s.hours) + '</td></tr>').join(''))
        : '<p class="muted">No absences recorded this term.</p>');

    box.innerHTML = '<div class="cm">' +
      '<div class="tp-stats hod-stats">' +
        stat(e.total, 'Students (' + e.boys + ' boys, ' + e.girls + ' girls)') +
        stat(num(d.classAverage) + '/20', 'Class average') +
        stat(pct(R.passRate), 'Passed (' + R.passed + ' of ' + R.sat + ')', low(R.passRate) ? 'is-alert' : '') +
        stat(pct(R.girls.passRate), 'Girls passed (' + R.girls.passed + ' of ' + R.girls.sat + ')', low(R.girls.passRate) ? 'is-alert' : '') +
        stat(pct(R.boys.passRate), 'Boys passed (' + R.boys.passed + ' of ' + R.boys.sat + ')', low(R.boys.passRate) ? 'is-alert' : '') +
        stat(num(d.highest) + ' · ' + num(d.lowest), 'Highest · lowest average') +
      '</div>' +
      '<div class="dv-tabs" role="tablist" aria-label="Report sections">' + TABS.map(([k, label]) =>
        '<button type="button" role="tab" class="dv-tab cm-tab" id="cm-t-' + k + '" data-cm-tab="' + k + '" aria-controls="cm-p-' + k + '" aria-selected="' + (k === on) + '"' + (k === on ? '' : ' tabindex="-1"') + '>' + label + '</button>').join('') + '</div>' +
      panel('overview', 'Overview', overview) + panel('subjects', 'Subjects', subjects) + panel('ranking', 'Ranking', ranking) +
      panel('watch', 'Students to watch (average below 10)', watch) + panel('attendance', 'Attendance', attendance) +
      '</div>';
  }

  function select(button, focus) {
    const key = button.dataset.cmTab;
    box.querySelectorAll('.cm-tab').forEach(b => { const on = b === button; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    box.querySelectorAll('.cm-panel').forEach(p => { p.hidden = p.dataset.cmPanel !== key; });
    if (focus) button.focus();
    try { localStorage.setItem('cmTab', key); } catch (_) {}
  }

  function downloadCsv() {
    if (!data) return;
    const d = data, R = d.results, e = d.enrolment;
    const cell = v => { const x = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const line = a => a.map(cell).join(',');
    const lines = [
      line(["Class master's report", d.className, d.yearName, d.term + ' term']),
      line(['Class master', d.classMaster || '']), '',
      line(['Students', 'Boys', 'Girls', '% Boys', '% Girls', 'Class average', 'Highest', 'Lowest', 'Sat', 'Passed', '% Passed', 'Girls sat', 'Girls passed', '% Girls passed', 'Boys sat', 'Boys passed', '% Boys passed']),
      line([e.total, e.boys, e.girls, e.boysPercent, e.girlsPercent, d.classAverage, d.highest, d.lowest, R.sat, R.passed, R.passRate, R.girls.sat, R.girls.passed, R.girls.passRate, R.boys.sat, R.boys.passed, R.boys.passRate]), '',
      line(['Best subject', d.bestSubject ? title(d.bestSubject.name) : '', d.bestSubject ? d.bestSubject.average : '', 'Weakest subject', d.worstSubject ? title(d.worstSubject.name) : '', d.worstSubject ? d.worstSubject.average : '']), '',
      line(['Subject', 'Teacher', 'Coefficient', 'Class average', 'Highest', 'Lowest', 'Sat', 'Passed', '% Passed', '% Girls passed', '% Boys passed', 'Marks entered', 'Marks expected', 'Best student']),
      ...d.subjects.map(s => line([title(s.name), s.teacher, s.coefficient, s.average, s.highest, s.lowest, s.results.sat, s.results.passed, s.results.passRate, s.results.girls.passRate, s.results.boys.passRate, s.marksEntered, s.marksExpected, s.best ? s.best.name : ''])), '',
      line(['Rank', 'Student', 'Matricule', 'Sex', 'Average', ...(d.termNo === 3 ? ['Annual'] : []), 'Subjects passed', 'Subjects taken', 'Absences (h)', 'Remark']),
      ...d.students.map(s => line([s.rank, s.name, s.matricule, s.sex, s.average, ...(d.termNo === 3 ? [s.annual] : []), s.subjectsPassed, s.subjectsTaken, s.absences, s.remark])),
    ];
    if (remarks.value.trim()) lines.push('', line(['Remarks', remarks.value.trim()]));
    DepartmentView.download('﻿' + lines.join('\r\n'), ('Class-report-' + d.className + '-' + d.yearName + '-' + d.term).replace(/[^\w.-]+/g, '_') + '.csv');
  }

  form.addEventListener('submit', e => { e.preventDefault(); load(); });
  [classSel, yearSel, termSel].forEach(el => el.addEventListener('change', load));
  csvBtn.addEventListener('click', downloadCsv);
  remarks.addEventListener('input', () => { remarksPrint.textContent = remarks.value; try { localStorage.setItem(remarksKey(), remarks.value); } catch (_) {} });
  box.addEventListener('click', e => { const b = e.target.closest('.cm-tab'); if (b) select(b); });
  box.addEventListener('keydown', e => {
    const b = e.target.closest('.cm-tab');
    if (!b) return;
    const list = [...box.querySelectorAll('.cm-tab')], i = list.indexOf(b);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(list[(next + list.length) % list.length], true);
  });

  start();
})();
