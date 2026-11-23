// Attendance totals and recent absences: student dashboard (own) and parent dashboard (child).
(function () {
  function field(label, value) {
    return '<div class="field"><span class="field-label">' + esc(label) + '</span><span class="field-value">' + esc(value) + '</span></div>';
  }

  function render(totalsEl, recentEl, s) {
    if (!s.periods) {
      totalsEl.innerHTML = '<p class="muted">No registers recorded yet for this period.</p>';
      recentEl.innerHTML = '';
      return;
    }
    totalsEl.innerHTML =
      field('Lessons recorded', s.periods) +
      field('Absence hours', s.absentHours + ' h') +
      field('Unjustified', s.unjustifiedHours + ' h') +
      field('Times late', s.lates + (s.lateMinutes ? ' (' + s.lateMinutes + ' min)' : ''));
    recentEl.innerHTML = s.recent.length
      ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Lesson</th><th>Mark</th><th>Status</th></tr></thead><tbody>' +
        s.recent.map(r => '<tr><td>' + esc(r.lessonDate) + '<br><span class="muted">' + esc(r.startTime) + '–' + esc(r.endTime) + '</span></td><td>' +
          esc(r.subjectName || '—') + '</td><td>' + (r.status === 'late' ? 'Late ' + esc(r.minutesLate) + ' min' : 'Absent') + '</td><td>' +
          (r.justified ? '<span class="badge no">Justified</span>' : '<span class="badge yes">Unjustified</span>') + '</td></tr>').join('') +
        '</tbody></table></div>'
      : '<p class="muted">No absences or lateness. Well done.</p>';
  }

  async function load(path, totalsEl, recentEl, term) {
    const res = await api(path + (term ? '?term=' + encodeURIComponent(term) : ''));
    if (!res.ok) {
      totalsEl.innerHTML = '<p class="muted">' + esc((res.data && res.data.message) || 'Attendance is not available.') + '</p>';
      recentEl.innerHTML = '';
      return;
    }
    render(totalsEl, recentEl, res.data.data);
  }

  window.AttendanceSummary = { render, load };

  // Student dashboard
  const card = document.getElementById('myAttendance');
  if (card) {
    const termSel = document.getElementById('attTerm');
    const run = () => load('/attendance/me', document.getElementById('attTotals'), document.getElementById('attRecent'), termSel.value);
    termSel.addEventListener('change', run);
    run();
  }
})();
