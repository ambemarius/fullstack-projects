// Admin → Evaluation → Subject results: every subject across the school (or one section),
// with the class-by-class report of any subject (the same report heads of department see).
(function () {
  const form = document.getElementById('srForm');
  if (!form) return;
  const yearSel = document.getElementById('srYear');
  const termSel = document.getElementById('srTerm');
  const sectionSel = document.getElementById('srSection');
  const box = document.getElementById('srReport');
  const detail = document.getElementById('srDetail');
  const csvBtn = document.getElementById('srCsv');
  const printBtn = document.getElementById('srPrint');
  const { num, pct, resultCells } = window.DepartmentView;
  let data = null, subjectReport = null, started = false;

  const periodLabel = () => termSel.options[termSel.selectedIndex].textContent;
  const sectionLabel = () => sectionSel.value ? sectionSel.value + ' section' : 'Whole school';

  async function start() {
    if (started) return;
    started = true;
    const m = new Date().getMonth() + 1;
    termSel.value = m >= 9 || m <= 1 ? 'First' : m <= 4 ? 'Second' : m <= 6 ? 'Third' : '';
    const res = await api('/department/options');
    if (res.ok) {
      yearSel.innerHTML = res.data.data.years.map(y => '<option value="' + esc(y.id) + '"' + (y.isCurrent ? ' selected' : '') + '>' + esc(y.name) + (y.isCurrent ? ' (current)' : '') + '</option>').join('');
    }
    load();
  }

  async function load() {
    box.innerHTML = '<div class="tp-card tp-pad"><p class="muted">Building the report…</p></div>';
    detail.innerHTML = '';
    subjectReport = null;
    csvBtn.disabled = printBtn.disabled = true;
    const q = new URLSearchParams({ yearId: yearSel.value || '', term: termSel.value, section: sectionSel.value });
    const res = await api('/department/school-report?' + q);
    if (!res.ok) {
      data = null;
      box.innerHTML = '<div class="tp-card tp-pad"><p class="msg error" role="alert">' + esc((res.data && res.data.message) || 'Could not build the report.') + '</p></div>';
      return;
    }
    data = res.data.data;
    render();
    csvBtn.disabled = printBtn.disabled = !data.subjects.length;
  }

  function render() {
    const d = data, t = d.totals, e = d.enrolment, R = t.results;
    document.getElementById('srPrintTitle').textContent = 'Subject results — ' + sectionLabel();
    document.getElementById('srPrintMeta').textContent = (d.year ? d.year.name : '') + ' · ' + periodLabel() + ' · Printed ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!d.subjects.length) {
      box.innerHTML = '<div class="tp-card tp-pad"><p class="muted">No subject is taught in this section yet.</p></div>';
      return;
    }
    const stat = (v, l, cls) => '<div class="tp-card tp-stat' + (cls ? ' ' + cls : '') + '"><div class="tp-v">' + esc(v) + '</div><div class="tp-l">' + esc(l) + '</div></div>';
    const low = v => v !== null && v !== undefined && v < 50;
    const rows = d.subjects.map(s => {
      const none = !s.results.sat;
      return '<tr' + (none ? ' class="sr-none"' : '') + '><td><strong>' + esc(s.subjectName) + '</strong>' + (s.code ? ' <span class="muted">' + esc(s.code) + '</span>' : '') + '</td>' +
        '<td class="num">' + s.classes + '</td><td class="num">' + s.teachers + '</td>' +
        (none
          ? '<td class="num" colspan="10"><span class="sr-none-note">No marks entered for this period</span></td>'
          : '<td class="num hod-avg' + (s.average !== null && s.average < 10 ? ' hod-low' : '') + '"><strong>' + num(s.average) + '</strong></td>' + resultCells(s.results)) +
        '<td class="num' + (s.completion !== null && s.completion < 100 ? ' hod-warn' : '') + '">' + pct(s.completion) + '</td>' +
        '<td class="sr-open"><button type="button" class="btn btn-sm btn-ghost" data-subject="' + esc(s.subjectId) + '"' + (none ? ' disabled' : '') + '>Details</button></td></tr>';
    }).join('');
    const empty = d.subjects.filter(s => !s.results.sat);
    box.innerHTML =
      '<div class="tp-stats hod-stats">' +
        stat(e.total, 'Students (' + sectionLabel().toLowerCase() + ')') +
        stat(e.boys + ' · ' + pct(e.boysPercent), 'Boys') +
        stat(e.girls + ' · ' + pct(e.girlsPercent), 'Girls') +
        stat(pct(R.passRate), 'Subject passes (' + R.passed + ' of ' + R.sat + ')', low(R.passRate) ? 'is-alert' : '') +
        stat(pct(R.girls.passRate) + ' · ' + pct(R.boys.passRate), 'Girls · boys passed', low(R.girls.passRate) || low(R.boys.passRate) ? 'is-alert' : '') +
        stat(pct(t.completion), 'Marks entered', t.completion < 100 ? 'is-alert' : '') +
      '</div>' +
      '<div class="tp-card tp-pad hod-block"><h2>Results by subject</h2><div class="table-wrap"><table class="hod-table hod-results sr-table"><thead>' +
        '<tr><th rowspan="2">Subject</th><th rowspan="2" class="num">Classes</th><th rowspan="2" class="num">Teachers</th><th rowspan="2" class="num hod-avg">Average</th>' +
        '<th colspan="3" class="hod-group">All students</th><th colspan="3" class="hod-group">Girls</th><th colspan="3" class="hod-group">Boys</th><th rowspan="2" class="num">Marks entered</th><th rowspan="2"><span class="sr-only">Details</span></th></tr>' +
        '<tr>' + [0, 1, 2].map(() => '<th class="num">Sat</th><th class="num">Passed</th><th class="num">% Passed</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody>' +
        '<tfoot><tr><th>All subjects</th><th></th><th></th><th></th>' + resultCells(R, 'th') + '<th class="num">' + pct(t.completion) + '</th><th></th></tr></tfoot></table></div>' +
        '<p class="muted hod-note">Sat = students with at least one mark in the subject for the period; passed = 10/20 or more. "All subjects" adds up subject entries, so a student taking nine subjects counts nine times.' +
        (empty.length ? ' <strong>' + empty.length + ' subject' + (empty.length > 1 ? 's are' : ' is') + ' attached to classes but ' + (empty.length > 1 ? 'have' : 'has') + ' no marks: ' + esc(empty.map(s => s.subjectName + (s.code ? ' (' + s.code + ')' : '')).join(', ')) + '.</strong> They lower the marks-entered figure; remove them from the classes if they are not taught.' : '') +
        '</p></div>';
  }

  async function openSubject(id) {
    const s = data.subjects.find(x => String(x.subjectId) === String(id));
    detail.innerHTML = '<div class="tp-card tp-pad hod-block"><p class="muted">Loading ' + esc(s ? s.subjectName : 'subject') + '…</p></div>';
    const q = new URLSearchParams({ subjectId: id, section: sectionSel.value, term: termSel.value, yearId: yearSel.value || '' });
    const res = await api('/department/report?' + q);
    if (!res.ok) {
      detail.innerHTML = '<div class="tp-card tp-pad hod-block"><p class="msg error" role="alert">' + esc((res.data && res.data.message) || 'Could not load this subject.') + '</p></div>';
      return;
    }
    subjectReport = res.data.data;
    detail.innerHTML = '<div class="sr-detail-head"><h2>' + esc(subjectReport.department.subjectName) + ' — ' + esc(sectionLabel()) + ', ' + esc(periodLabel()) + '</h2>' +
      '<div class="hod-actions"><button type="button" class="btn btn-secondary btn-sm" data-subject-csv>Download this subject (CSV)</button><button type="button" class="btn btn-ghost btn-sm" data-close-subject>Close</button></div></div>' +
      DepartmentView.body(subjectReport);
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function downloadCsv() {
    if (!data) return;
    const cell = v => { const x = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const line = a => a.map(cell).join(',');
    const R = data.totals.results, e = data.enrolment;
    const lines = [
      line(['Subject results', sectionLabel(), data.year ? data.year.name : '', periodLabel()]),
      line(['Students', e.total, 'Boys', e.boys, '% Boys', e.boysPercent, 'Girls', e.girls, '% Girls', e.girlsPercent]), '',
      line(['Subject', 'Code', 'Classes', 'Teachers', 'Average', 'Highest', 'Lowest', 'Sat', 'Passed', '% Passed', 'Girls sat', 'Girls passed', '% Girls passed', 'Boys sat', 'Boys passed', '% Boys passed', 'Marks entered %', 'A', 'B', 'C', 'D', 'F']),
      ...data.subjects.map(s => line([s.subjectName, s.code, s.classes, s.teachers, s.average, s.highest, s.lowest,
        s.results.sat, s.results.passed, s.results.passRate, s.results.girls.sat, s.results.girls.passed, s.results.girls.passRate,
        s.results.boys.sat, s.results.boys.passed, s.results.boys.passRate, s.completion, s.grades.A, s.grades.B, s.grades.C, s.grades.D, s.grades.F])),
      line(['All subjects', '', '', '', '', '', '', R.sat, R.passed, R.passRate, R.girls.sat, R.girls.passed, R.girls.passRate, R.boys.sat, R.boys.passed, R.boys.passRate, data.totals.completion]),
    ];
    DepartmentView.download('﻿' + lines.join('\r\n'), ('Subject-results-' + (sectionSel.value || 'school') + '-' + (data.year ? data.year.name : '') + '-' + (termSel.value || 'year')).replace(/[^\w.-]+/g, '_') + '.csv');
  }

  form.addEventListener('submit', e => { e.preventDefault(); load(); });
  [yearSel, termSel, sectionSel].forEach(el => el.addEventListener('change', () => { if (started) load(); }));
  csvBtn.addEventListener('click', downloadCsv);
  box.addEventListener('click', e => { const b = e.target.closest('[data-subject]'); if (b) openSubject(b.dataset.subject); });
  detail.addEventListener('click', e => {
    if (e.target.closest('[data-close-subject]')) { detail.innerHTML = ''; subjectReport = null; box.scrollIntoView({ block: 'start' }); return; }
    if (e.target.closest('[data-subject-csv]') && subjectReport) {
      const d = subjectReport;
      DepartmentView.download(DepartmentView.csv(d, { period: periodLabel(), me: 'Administration' }),
        ('Subject-' + d.department.subjectName + '-' + (d.department.section || 'school') + '-' + d.year.name + '-' + (d.term || 'year')).replace(/[^\w.-]+/g, '_') + '.csv');
    }
  });

  // Build the report the first time the sub-tab opens (and on a direct link to it).
  const tab = document.querySelector('.reg-subtab[data-sub="subject-results"]');
  tab?.addEventListener('click', start);
  if (/subject-results/.test(location.hash) || document.getElementById('sub-subject-results').classList.contains('active')) start();
})();
