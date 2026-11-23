(function () {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  async function loadProfile() {
    const { ok, data } = await api('/students/profile');
    const el = document.getElementById('profile');
    const welcome = document.getElementById('welcome');

    if (!ok) { welcome.textContent = 'Could not load your profile. Refresh the page or sign in again.'; return; }

    const s = data.data;
    const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
    welcome.textContent = `Welcome back, ${fullName}`;
    if (window.setStudentName) window.setStudentName(fullName);

    const joined = new Date(s.createdAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const status = s.isWithdrawn
      ? '<span class="badge yes">Withdrawn</span>'
      : '<span class="badge no">Active</span>';

    renderProfileCard(el, {
      name: fullName,
      subtitle: `${s.className ? s.className + ' · ' : ''}${s.section} section`,
      fields: [
        { label: 'Matricule', value: s.matricule },
        { label: 'Sex', value: s.sex || '—' },
        { label: 'Date of birth', value: s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '—' },
        { label: 'Year enrolled', value: s.yearOfEnrollment ? String(s.yearOfEnrollment) : '—' },
        { label: 'Section', value: s.section },
        { label: 'Status', value: status, html: true },
        { label: 'Parent / guardian', value: s.parentName || '—' },
        { label: 'Registered', value: joined },
      ],
    });
  }

  // Results table (shared with the parent panel): public/js/results-table.js
  let allResults = [];
  let yearName = '';
  function renderResults() {
    ResultsTable.render({
      table: document.getElementById('resultsTable'), empty: document.getElementById('resultsEmpty'), note: document.getElementById('resultsNote'),
      rows: allResults, term: document.getElementById('resultsTerm').value, yearName,
    });
  }

  async function loadResults() {
    const res = await api('/students/my-scores');
    const rows = (res.ok && res.data && res.data.data) || [];
    ({ rows: allResults, yearName } = ResultsTable.pickYear(rows));
    renderResults();
  }

  async function loadTimetable() {
    const term = document.getElementById('ttTerm').value;
    const container = document.getElementById('ttGrid');
    const res = await api(`/timetables/student?term=${encodeURIComponent(term)}`);
    const entries = (res.ok && res.data && res.data.data) || [];
    if (!entries.length) {
      container.innerHTML = '<p class="muted">No timetable has been published for this term yet.</p>';
      return;
    }
    const byDay = {};
    for (const e of entries) (byDay[e.day_of_week] ||= []).push(e);
    let html = '<table class="tt-grid"><thead><tr><th>Day</th><th>Periods</th></tr></thead><tbody>';
    for (const day of DAYS) {
      const list = (byDay[day] || []).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      html += `<tr><td class="tt-time">${esc(day)}</td><td class="tt-filled">`;
      html += list.length
        ? list.map(e => `<span class="tt-period"><strong>${esc(e.start_time)}–${esc(e.end_time)}</strong> ${esc(e.subject_name)}${e.teacher_name ? ' <span class="muted">· ' + esc(e.teacher_name) + '</span>' : ''}${e.room ? ' <span class="muted">· ' + esc(e.room) + '</span>' : ''}</span>`).join('<br>')
        : '<span class="muted">No classes</span>';
      html += '</td></tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  document.getElementById('resultsTerm').addEventListener('change', renderResults);
  document.getElementById('ttTerm').addEventListener('change', loadTimetable);

  loadProfile();
  loadResults();
  loadTimetable();
})();
