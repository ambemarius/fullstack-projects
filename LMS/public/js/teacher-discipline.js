// Teacher portal: the "Discipline" tab, shown only to a teacher who holds the discipline-master duty.
// Lists the absences and lateness every teacher marked in the classes this discipline master looks after,
// per student or one by one, and lets them justify an absence or open the full register.
(function () {
  const link = document.getElementById('tw-tab-discipline');
  const form = document.getElementById('discForm');
  if (!link || !form) return;

  const classSel = document.getElementById('discClass');
  const fromIn = document.getElementById('discFrom');
  const toIn = document.getElementById('discTo');
  const pendingIn = document.getElementById('discPending');
  const stats = document.getElementById('discStats');
  const body = document.getElementById('discBody');
  const viewTitle = document.getElementById('discViewTitle');
  const registerCard = document.getElementById('discRegisterCard');
  const registerBox = document.getElementById('discRegister');
  const badge = document.getElementById('twDiscCount');

  const iso = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const today = iso(new Date());
  fromIn.value = iso(new Date(Date.now() - 13 * 86400000));
  toIn.value = today;
  fromIn.max = toIn.max = today;

  let rows = [];
  let view = 'students';
  try { view = localStorage.getItem('discView') === 'marks' ? 'marks' : 'students'; } catch (_) {}
  const hours = min => (Math.round(min / 6) / 10).toLocaleString('en-GB') + ' h';
  const niceDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  async function start() {
    const me = await api('/staff-duties/mine');
    const duties = (me.ok && me.data.data.duties) || [];
    if (!duties.some(d => d.duty === 'discipline_master')) return;
    link.hidden = false;
    const opts = await api('/attendance/options');
    if (opts.ok) {
      const o = opts.data.data;
      classSel.innerHTML = '<option value="">' + (o.wholeSchool ? 'All classes' : 'All my classes') + '</option>' +
        o.classes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>').join('');
      document.getElementById('discScope').textContent = o.wholeSchool
        ? 'You are discipline master for the whole school: absences and lateness recorded by every teacher in every class.'
        : 'You are discipline master for ' + o.classes.map(c => c.label).join(', ') + '. Absences and lateness recorded by every teacher in these classes.';
    }
    twLoaders.discipline = load;
    twReload.add('discipline');
    if (location.hash === '#discipline') twShow('discipline', { updateHash: false });
    else refreshBadge();
  }

  // Unjustified absences in the last 14 days, beside the tab name.
  async function refreshBadge() {
    const res = await api('/attendance/absences?pending=1&from=' + iso(new Date(Date.now() - 13 * 86400000)) + '&to=' + today);
    const n = res.ok ? res.data.data.rows.filter(r => r.status === 'absent').length : 0;
    badge.hidden = !n;
    badge.textContent = n > 99 ? '99+' : String(n);
  }

  async function load() {
    body.innerHTML = '<p class="muted">Loading…</p>';
    const q = new URLSearchParams({ from: fromIn.value, to: toIn.value });
    if (classSel.value) q.set('classId', classSel.value);
    if (pendingIn.checked) q.set('pending', '1');
    const res = await api('/attendance/absences?' + q);
    if (!res.ok) {
      rows = [];
      stats.innerHTML = '';
      body.innerHTML = '<p class="msg error" role="alert">' + esc((res.data && res.data.message) || 'Could not load absences.') + '</p>';
      return;
    }
    rows = res.data.data.rows;
    renderStats();
    render();
    if (!pendingIn.checked && !classSel.value) {
      const n = rows.filter(r => r.status === 'absent' && !r.justified).length;
      badge.hidden = !n;
      badge.textContent = n > 99 ? '99+' : String(n);
    }
  }

  function renderStats() {
    const absent = rows.filter(r => r.status === 'absent');
    const unjust = absent.filter(r => !r.justified);
    const stat = (v, l, alert) => '<div class="tp-card tp-stat' + (alert ? ' is-alert' : '') + '"><div class="tp-v">' + esc(v) + '</div><div class="tp-l">' + esc(l) + '</div></div>';
    stats.innerHTML =
      stat(absent.length, 'Absences (' + hours(absent.reduce((t, r) => t + (r.minutes || 0), 0)) + ')') +
      stat(unjust.length, 'Not yet justified', unjust.length > 0) +
      stat(rows.filter(r => r.status === 'late').length, 'Late arrivals') +
      stat(new Set(rows.map(r => r.studentId)).size, 'Students concerned');
  }

  function render() {
    document.querySelectorAll('[data-disc-view]').forEach(b => {
      const on = b.dataset.discView === view;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('btn-ghost', !on);
    });
    viewTitle.textContent = view === 'students' ? 'By student' : 'Every absence';
    if (!rows.length) {
      body.innerHTML = '<p class="muted">No absences or lateness recorded for these dates' + (pendingIn.checked ? ' that still need a justification' : '') + '. Widen the dates or choose another class.</p>';
      return;
    }
    body.innerHTML = view === 'students' ? studentsTable() : marksTable();
  }

  // One row per student: absences, hours, lateness; most hours missed first.
  function studentsTable() {
    const by = new Map();
    for (const r of rows) {
      const s = by.get(r.studentId) || { name: r.student, matricule: r.matricule, className: r.className, abs: 0, min: 0, unjust: 0, unjustMin: 0, late: 0, lateMin: 0 };
      if (r.status === 'absent') {
        s.abs++; s.min += r.minutes || 0;
        if (!r.justified) { s.unjust++; s.unjustMin += r.minutes || 0; }
      } else if (r.status === 'late') { s.late++; s.lateMin += r.minutesLate || 0; }
      by.set(r.studentId, s);
    }
    const list = [...by.entries()].sort((a, b) => b[1].unjustMin - a[1].unjustMin || b[1].min - a[1].min || a[1].name.localeCompare(b[1].name));
    return '<div class="table-wrap"><table class="disc-table"><thead><tr><th>Student</th><th>Class</th><th class="num">Absences</th><th class="num">Hours missed</th>' +
      '<th class="num">Unjustified</th><th class="num">Late</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>' +
      list.map(([id, s]) => '<tr><td><strong>' + esc(s.name) + '</strong><br><span class="muted">' + esc(s.matricule || '') + '</span></td>' +
        '<td>' + esc(s.className) + '</td><td class="num">' + s.abs + '</td><td class="num">' + hours(s.min) + '</td>' +
        '<td class="num' + (s.unjust ? ' disc-alert' : '') + '">' + (s.unjust ? s.unjust + ' (' + hours(s.unjustMin) + ')' : '—') + '</td>' +
        '<td class="num">' + (s.late ? s.late + ' (' + s.lateMin + ' min)' : '—') + '</td>' +
        '<td><button type="button" class="btn btn-sm btn-ghost" data-disc-student="' + esc(id) + '">See each absence</button></td></tr>').join('') +
      '</tbody></table></div>';
  }

  // One row per absence or late mark, with the teacher who recorded it.
  function marksTable(studentId) {
    const list = studentId ? rows.filter(r => r.studentId === studentId) : rows;
    return (studentId ? '<p class="disc-filter-note">Showing ' + esc(list[0] ? list[0].student : '') + ' only. <button type="button" class="btn btn-sm btn-ghost" data-disc-view="marks">Show everyone</button></p>' : '') +
      '<div class="table-wrap"><table class="disc-table"><thead><tr><th>Lesson</th><th>Class</th><th>Subject and teacher</th><th>Student</th><th>Mark</th><th>Justification</th></tr></thead><tbody>' +
      list.map(r => '<tr><td>' + esc(niceDate(r.lessonDate)) + '<br><span class="muted">' + esc(r.startTime + '–' + r.endTime) + '</span></td>' +
        '<td>' + esc(r.className) + '</td>' +
        '<td>' + esc(r.subjectName || 'Lesson') + '<br><span class="muted">Marked by ' + esc(r.teacherName || 'unknown') + '</span></td>' +
        '<td><strong>' + esc(r.student) + '</strong><br><span class="muted">' + esc(r.matricule || '') + '</span></td>' +
        '<td><span class="badge' + (r.status === 'absent' ? ' yes' : '') + '">' + (r.status === 'absent' ? 'Absent' : 'Late ' + esc(r.minutesLate || '') + ' min') + '</span></td>' +
        '<td class="disc-just">' + (r.justified
          ? '<span class="badge no">Justified</span> <span class="muted">' + esc(r.justification || '') + '</span>'
          : '<button type="button" class="btn btn-sm" data-disc-justify="' + esc(r.registerId) + ':' + esc(r.studentId) + '">Justify</button>') +
        ' <button type="button" class="btn btn-sm btn-ghost" data-disc-register="' + esc(r.registerId) + '">Register</button></td></tr>').join('') +
      '</tbody></table></div>';
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (fromIn.value > toIn.value) return toast('The start date must be before the end date', 'error');
    registerCard.hidden = true;
    load();
  });
  classSel.addEventListener('change', () => form.requestSubmit());
  pendingIn.addEventListener('change', () => form.requestSubmit());

  document.getElementById('tw-discipline').addEventListener('click', async e => {
    const v = e.target.closest('[data-disc-view]');
    if (v) {
      view = v.dataset.discView;
      try { localStorage.setItem('discView', view); } catch (_) {}
      render();
      return;
    }
    const one = e.target.closest('[data-disc-student]');
    if (one) {
      view = 'marks';
      render();
      body.innerHTML = marksTable(Number(one.dataset.discStudent));
      return;
    }
    const reg = e.target.closest('[data-disc-register]');
    if (reg) {
      registerCard.hidden = false;
      await AttendanceRegister.open(registerBox, reg.dataset.discRegister, { onSaved: load });
      registerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const just = e.target.closest('[data-disc-justify]');
    if (just) {
      const cell = just.closest('td');
      const [registerId, studentId] = just.dataset.discJustify.split(':').map(Number);
      cell.innerHTML = '<form class="disc-just-form"><label class="sr-only" for="dj' + registerId + '_' + studentId + '">Justification</label>' +
        '<input id="dj' + registerId + '_' + studentId + '" maxlength="300" required placeholder="e.g. Medical note from the parent">' +
        '<button type="submit" class="btn btn-sm">Save</button><button type="button" class="btn btn-sm btn-ghost" data-disc-cancel>Cancel</button></form>';
      const f = cell.querySelector('form');
      f.querySelector('input').focus();
      f.addEventListener('submit', async ev => {
        ev.preventDefault();
        const justification = f.querySelector('input').value.trim();
        if (!justification) return;
        const res = await api('/attendance/justify', { method: 'POST', body: JSON.stringify({ registerId, studentId, justification }) });
        toast((res.data && res.data.message) || (res.ok ? 'Absence justified.' : 'Could not justify this absence.'), res.ok ? 'success' : 'error');
        if (res.ok) {
          const r = rows.find(x => x.registerId === registerId && x.studentId === studentId);
          if (r) { r.justified = true; r.justification = justification; }
          if (pendingIn.checked) rows = rows.filter(x => x !== r);
          renderStats();
          cell.innerHTML = r && !pendingIn.checked
            ? '<span class="badge no">Justified</span> <span class="muted">' + esc(justification) + '</span>'
            : '<span class="badge no">Justified</span>';
          refreshBadge();
        }
      });
      return;
    }
    if (e.target.closest('[data-disc-cancel]')) render();
  });

  start();
})();
