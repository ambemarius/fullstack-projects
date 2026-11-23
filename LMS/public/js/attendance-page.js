// /attendance: registers, absences to justify and term totals (administrators and discipline master).
(function () {
  const $ = id => document.getElementById(id);
  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const role = localStorage.getItem('role');
  $('attHome').href = { admin: '/admin-dashboard', teacher: '/teacher-dashboard', auxiliary: '/staff-dashboard' }[role] || '/';

  // Tabs
  const tabs = ['registers', 'absences', 'totals'];
  function select(name) {
    tabs.forEach(t => {
      $('tab-' + t).setAttribute('aria-selected', String(t === name));
      $('panel-' + t).hidden = t !== name;
    });
    if (name === 'absences' && !absLoaded) loadAbsences();
  }
  tabs.forEach(t => $('tab-' + t).addEventListener('click', () => select(t)));

  function option(value, text) { return '<option value="' + esc(value) + '">' + esc(text) + '</option>'; }
  function showError(message) { $('attError').textContent = message; $('attError').hidden = false; }

  // Shared options
  (async function init() {
    const res = await api('/attendance/options');
    if (!res.ok) {
      showError((res.data && res.data.message) || 'Attendance is open to administrators and to staff with the discipline master duty.');
      document.querySelectorAll('[role=tabpanel]').forEach(p => { p.hidden = true; });
      return;
    }
    const { classes, years, today } = res.data.data;
    const classOptions = classes.map(c => option(c.id, c.label)).join('');
    $('regClass').innerHTML += classOptions;
    $('absClass').innerHTML += classOptions;
    $('totClass').innerHTML += classOptions;
    $('totYear').innerHTML = years.map(y => option(y.id, y.label + (y.isCurrent ? ' (current)' : ''))).join('');
    const current = years.find(y => y.isCurrent);
    if (current) $('totYear').value = String(current.id);
    $('regDate').value = today; $('regDate').max = today;
    $('absTo').value = today; $('absFrom').value = addDays(today, -13);
    try { const t = localStorage.getItem('attendanceTerm'); if (t) { $('regTerm').value = t; $('totTerm').value = t; } } catch (_) {}
  })();

  // Registers
  async function loadLessons() {
    $('regRegister').innerHTML = '';
    if (!$('regClass').value) { $('regLessons').innerHTML = '<p class="muted">Choose a class to see its lessons for the day.</p>'; return; }
    const q = new URLSearchParams({ classId: $('regClass').value, date: $('regDate').value, term: $('regTerm').value });
    const res = await api('/attendance/class-lessons?' + q);
    if (!res.ok) { $('regLessons').innerHTML = '<p class="msg error">' + esc((res.data && res.data.message) || 'Could not load lessons.') + '</p>'; return; }
    const d = res.data.data;
    AttendanceRegister.renderLessons($('regLessons'), d.lessons, {
      date: d.date, canMark: d.canMark,
      onOpen: id => AttendanceRegister.open($('regRegister'), id, { onSaved: loadLessons }),
    });
  }
  ['regClass', 'regDate', 'regTerm'].forEach(id => $(id).addEventListener('change', () => {
    if (id === 'regTerm') { try { localStorage.setItem('attendanceTerm', $('regTerm').value); } catch (_) {} }
    loadLessons();
  }));

  // Absences
  let absLoaded = false;
  async function loadAbsences() {
    absLoaded = true;
    const q = new URLSearchParams({ from: $('absFrom').value || addDays(todayIso, -13), to: $('absTo').value || todayIso, pending: $('absPending').checked ? '1' : '0' });
    if ($('absClass').value) q.set('classId', $('absClass').value);
    const res = await api('/attendance/absences?' + q);
    const tbody = $('absRows');
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6" class="msg error">' + esc((res.data && res.data.message) || 'Could not load absences.') + '</td></tr>'; return; }
    const rows = res.data.data.rows;
    tbody.innerHTML = rows.length ? rows.map(r =>
      '<tr><td>' + esc(r.lessonDate) + '<br><span class="muted">' + esc(r.startTime) + '–' + esc(r.endTime) + '</span></td>' +
      '<td>' + esc(r.student) + '<br><span class="muted">' + esc(r.matricule) + '</span></td>' +
      '<td>' + esc(r.className) + '<br><span class="muted">' + esc(r.subjectName || '') + '</span></td>' +
      '<td>' + (r.status === 'late' ? 'Late ' + esc(r.minutesLate) + ' min' : 'Absent (' + esc(r.minutes) + ' min)') + '</td>' +
      '<td>' + (r.justified ? '<span class="badge no">Justified</span><br><span class="muted">' + esc(r.justification) + '</span>' : '<span class="badge yes">Unjustified</span>') + '</td>' +
      '<td>' + (r.justified ? '' : '<button type="button" class="btn btn-sm btn-secondary" data-register="' + esc(r.registerId) + '" data-student="' + esc(r.studentId) + '" data-name="' + esc(r.student + ' — ' + r.lessonDate + ' ' + r.startTime) + '">Justify</button>') + '</td></tr>'
    ).join('') : '<tr><td colspan="6" class="muted">No ' + ($('absPending').checked ? 'unjustified ' : '') + 'absences or lateness in this period.</td></tr>';
  }
  $('absForm').addEventListener('submit', e => { e.preventDefault(); loadAbsences(); });
  $('absRows').addEventListener('click', async e => {
    const btn = e.target.closest('[data-register]');
    if (!btn) return;
    const justification = prompt('Justification for ' + btn.dataset.name + ' (for example: medical certificate dated …)');
    if (!justification || !justification.trim()) return;
    const res = await api('/attendance/justify', { method: 'POST', body: JSON.stringify({ registerId: Number(btn.dataset.register), studentId: Number(btn.dataset.student), justification }) });
    toast((res.data && res.data.message) || (res.ok ? 'Absence justified.' : 'Could not justify.'), res.ok ? 'success' : 'error');
    if (res.ok) loadAbsences();
  });

  // Totals
  $('totForm').addEventListener('submit', async e => {
    e.preventDefault();
    const q = new URLSearchParams({ classId: $('totClass').value, yearId: $('totYear').value, term: $('totTerm').value });
    const res = await api('/attendance/summary?' + q);
    const tbody = $('totRows');
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="7" class="msg error">' + esc((res.data && res.data.message) || 'Could not load totals.') + '</td></tr>'; return; }
    const students = res.data.data.students;
    tbody.innerHTML = students.length ? students.map(p =>
      '<tr><td>' + esc(p.name) + '<br><span class="muted">' + esc(p.matricule) + '</span></td><td>' + esc(p.periods) + '</td><td>' + esc(p.absences) +
      '</td><td>' + esc(p.absentHours) + '</td><td>' + esc(p.justifiedHours) + '</td><td>' + esc(p.unjustifiedHours) + '</td><td>' + esc(p.lates) +
      (p.lateMinutes ? ' <span class="muted">(' + esc(p.lateMinutes) + ' min)</span>' : '') + '</td></tr>').join('')
      : '<tr><td colspan="7" class="muted">No active students in this class.</td></tr>';
  });
})();
