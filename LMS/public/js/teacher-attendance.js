// Teacher dashboard: the day's lessons, then one register at a time.
// Opening a lesson replaces the list with its register (at the top of the page, with "Back to lessons"),
// so a teacher never has to scroll to find it or miss that it opened.
(function () {
  const dateInput = document.getElementById('attDate');
  const termSel = document.getElementById('attTerm');
  const list = document.getElementById('attLessons');
  const listView = document.getElementById('attListView');
  const registerBox = document.getElementById('attRegister');
  if (!dateInput) return;

  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  dateInput.value = todayIso;
  dateInput.max = todayIso;
  try { termSel.value = localStorage.getItem('attendanceTerm') || 'First'; } catch (_) {}
  let lastSaved = null;

  async function load() {
    const res = await api('/attendance/my-lessons?date=' + encodeURIComponent(dateInput.value) + '&term=' + encodeURIComponent(termSel.value));
    if (!res.ok) {
      list.innerHTML = '<p class="msg error">' + esc((res.data && res.data.message) || 'Could not load your lessons.') + '</p>';
      return;
    }
    const d = res.data.data;
    AttendanceRegister.renderLessons(list, d.lessons, { date: d.date, canMark: d.canMark, onOpen: openRegister });
    // Point at the register just saved so the teacher sees its new count.
    if (lastSaved) {
      const btn = list.querySelector('[data-register="' + lastSaved + '"]');
      const card = btn && btn.closest('.lesson-card');
      if (card) { card.classList.add('just-saved'); card.scrollIntoView({ block: 'nearest' }); setTimeout(() => card.classList.remove('just-saved'), 2500); }
      lastSaved = null;
    }
    if (typeof refreshAttendanceBadge === 'function') refreshAttendanceBadge();
  }

  function showList() {
    registerBox.hidden = true;
    registerBox.innerHTML = '';
    listView.hidden = false;
    window.scrollTo({ top: 0 });
  }

  async function openRegister(id) {
    listView.hidden = true;
    registerBox.hidden = false;
    window.scrollTo({ top: 0 });
    await AttendanceRegister.open(registerBox, id, {
      onBack: () => { showList(); load(); },
      closeOnSave: true,
      onSaved: savedId => { lastSaved = savedId; showList(); load(); },
    });
  }

  dateInput.addEventListener('change', () => { showList(); load(); });
  termSel.addEventListener('change', () => {
    try { localStorage.setItem('attendanceTerm', termSel.value); } catch (_) {}
    showList();
    load();
  });
  // Leaving the Attendance tab with a register open: come back to the list next time.
  window.addEventListener('hashchange', () => { if (location.hash !== '#attendance' && !registerBox.hidden) showList(); });
  load();
})();
