// Teacher dashboard: today's lessons and their registers.
(function () {
  const dateInput = document.getElementById('attDate');
  const termSel = document.getElementById('attTerm');
  const list = document.getElementById('attLessons');
  const registerBox = document.getElementById('attRegister');
  if (!dateInput) return;

  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  dateInput.value = todayIso;
  dateInput.max = todayIso;
  try { termSel.value = localStorage.getItem('attendanceTerm') || 'First'; } catch (_) {}

  async function load() {
    const res = await api('/attendance/my-lessons?date=' + encodeURIComponent(dateInput.value) + '&term=' + encodeURIComponent(termSel.value));
    if (!res.ok) {
      list.innerHTML = '<p class="msg error">' + esc((res.data && res.data.message) || 'Could not load your lessons.') + '</p>';
      return;
    }
    const d = res.data.data;
    AttendanceRegister.renderLessons(list, d.lessons, {
      date: d.date, canMark: d.canMark,
      onOpen: id => AttendanceRegister.open(registerBox, id, { onSaved: load }),
    });
  }

  dateInput.addEventListener('change', () => { registerBox.innerHTML = ''; load(); });
  termSel.addEventListener('change', () => {
    try { localStorage.setItem('attendanceTerm', termSel.value); } catch (_) {}
    registerBox.innerHTML = '';
    load();
  });
  load();
})();
