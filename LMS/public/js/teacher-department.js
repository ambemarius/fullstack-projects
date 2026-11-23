// Teacher portal: the "Department" tab, shown only to a head of department.
// Their subject across every class of their section for a term or the whole year,
// with remarks, a printable report (or PDF) and a CSV download for the administration.
(function () {
  const link = document.getElementById('tw-tab-department');
  const form = document.getElementById('hodForm');
  if (!link || !form) return;

  const yearSel = document.getElementById('hodYear');
  const termSel = document.getElementById('hodTerm');
  const box = document.getElementById('hodReport');
  const remarks = document.getElementById('hodRemarks');
  const remarksPrint = document.getElementById('hodRemarksPrint');
  const csvBtn = document.getElementById('hodCsv');
  const printBtn = document.getElementById('hodPrint');
  let data = null, me = '';

  const num = v => (v === null || v === undefined ? '—' : String(v));
  const pct = v => (v === null || v === undefined ? '—' : v + '%');
  const periodLabel = () => termSel.options[termSel.selectedIndex].textContent;
  const remarksKey = () => 'hodRemarks:' + yearSel.value + ':' + termSel.value;

  async function start() {
    const mine = await api('/staff-duties/mine');
    const duties = (mine.ok && mine.data.data.duties) || [];
    if (!duties.some(d => d.duty === 'head_of_department')) return;
    me = (mine.data.data.name) || '';
    link.hidden = false;
    const opts = await api('/department/options');
    if (!opts.ok) {
      box.innerHTML = '<div class="tp-card tp-pad"><p class="msg error" role="alert">' + esc((opts.data && opts.data.message) || 'Could not load your department.') + '</p></div>';
    } else {
      const o = opts.data.data;
      yearSel.innerHTML = o.years.map(y => '<option value="' + esc(y.id) + '"' + (y.isCurrent ? ' selected' : '') + '>' + esc(y.name) + (y.isCurrent ? ' (current)' : '') + '</option>').join('');
      const d = o.department;
      document.getElementById('hodTitle').textContent = d.subjectName + ' department';
      document.getElementById('hodScope').textContent = 'Results of ' + d.subjectName + ' in every class of the ' + (d.section ? d.section + ' section' : 'school') + '. Marks are out of 20; pass mark 10.';
    }
    const m = new Date().getMonth() + 1;
    termSel.value = m >= 9 || m <= 1 ? 'First' : m <= 4 ? 'Second' : m <= 6 ? 'Third' : '';
    twLoaders.department = load;
    if (location.hash === '#department') twShow('department', { updateHash: false });
  }

  async function load() {
    box.innerHTML = '<div class="tp-card tp-pad"><p class="muted">Loading…</p></div>';
    csvBtn.disabled = printBtn.disabled = true;
    const q = new URLSearchParams({ yearId: yearSel.value || '', term: termSel.value });
    const res = await api('/department/report?' + q);
    if (!res.ok) {
      data = null;
      box.innerHTML = '<div class="tp-card tp-pad"><p class="msg error" role="alert">' + esc((res.data && res.data.message) || 'Could not build the report.') + '</p></div>';
      return;
    }
    data = res.data.data;
    try { remarks.value = localStorage.getItem(remarksKey()) || ''; } catch (_) { remarks.value = ''; }
    syncRemarks();
    render();
    csvBtn.disabled = printBtn.disabled = !data.classes.length;
  }

  function render() {
    const d = data, t = d.totals, dept = d.department;
    const sectionText = dept.section ? dept.section + ' section' : 'whole school';
    document.getElementById('hodPrintTitle').textContent = 'Head of Department report — ' + dept.subjectName;
    document.getElementById('hodPrintMeta').textContent = sectionText + ' · ' + d.year.name + ' · ' + periodLabel() + ' · Prepared by ' + me + ' on ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('hodSignName').textContent = me ? me + ', Head of Department' : 'Head of Department';
    if (!d.classes.length) {
      box.innerHTML = '<div class="tp-card tp-pad"><p class="muted">No class in the ' + esc(sectionText) + ' takes ' + esc(dept.subjectName) + ' yet. Ask an administrator to add the subject to the classes.</p></div>';
      return;
    }
    box.innerHTML = DepartmentView.body(d);
  }

  // CSV for the administration: one line per class, the department total, then per teacher.
  function downloadCsv() {
    if (!data) return;
    const d = data, dept = d.department;
    const text = DepartmentView.csv(d, { period: periodLabel(), me, remarks: remarks.value.trim() });
    DepartmentView.download(text, ('HOD-' + dept.subjectName + '-' + (dept.section || 'school') + '-' + d.year.name + '-' + (d.term || 'year')).replace(/[^\w.-]+/g, '_') + '.csv');
  }


  function syncRemarks() { remarksPrint.textContent = remarks.value; }
  remarks.addEventListener('input', () => {
    syncRemarks();
    try { localStorage.setItem(remarksKey(), remarks.value); } catch (_) {}
  });
  form.addEventListener('submit', e => { e.preventDefault(); load(); });
  yearSel.addEventListener('change', load);
  termSel.addEventListener('change', load);
  csvBtn.addEventListener('click', downloadCsv);

  start();
})();
