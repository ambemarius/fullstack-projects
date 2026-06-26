(function () {
  const classSel = document.getElementById('promoteClass');
  const yearSel = document.getElementById('promoteYear');
  const msg = document.getElementById('promoteMsg');

  // Load classes and academic years
  Promise.all([
    api('/classes'),
    api('/academic-years'),
  ]).then(([classesRes, yearsRes]) => {
    if (classesRes && classesRes.data) {
      for (const c of classesRes.data) {
        classSel.innerHTML += `<option value="${c.id}">${esc(c.section)} — ${esc(c.name)}${c.stream ? ' (' + esc(c.stream) + ')' : ''}</option>`;
      }
    }
    if (yearsRes && yearsRes.data) {
      for (const y of yearsRes.data) {
        yearSel.innerHTML += `<option value="${y.id}">${esc(y.name)}${y.isCurrent ? ' (current)' : ''}</option>`;
      }
    }
  });

  document.getElementById('promoteBtn').addEventListener('click', async () => {
    const classId = classSel.value;
    const academicYearId = yearSel.value;
    if (!classId || !academicYearId) {
      msg.textContent = 'Select a class and academic year';
      msg.className = 'msg error';
      return;
    }
    if (!confirm('Promote all students in this class? This action cannot be undone.')) return;

    msg.textContent = 'Promoting...';
    msg.className = 'msg';

    try {
      const res = await api(`/students/promote/${classId}`, { method: 'POST', body: { academicYearId: +academicYearId } });
      if (res && res.status === 'success') {
        const d = res.data;
        msg.innerHTML = `Promoted: ${d.promoted} | Graduated: ${d.graduated}${d.errors.length ? '<br>Errors: ' + d.errors.join(', ') : ''}`;
        msg.className = 'msg ok';
      } else {
        msg.textContent = (res && res.message) || 'Promotion failed';
        msg.className = 'msg error';
      }
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'msg error';
    }
  });
})();
