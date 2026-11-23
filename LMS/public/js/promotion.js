(function () {
  const classSel = document.getElementById('promoteClass');
  const yearSel = document.getElementById('promoteYear');
  const msg = document.getElementById('promoteMsg');

  function option(value, text) {
    return '<option value="' + esc(value) + '">' + esc(text) + '</option>';
  }

  Promise.all([api('/classes'), api('/academic-years')]).then(([classesRes, yearsRes]) => {
    const classes = (classesRes.ok && classesRes.data.data) || [];
    const years = (yearsRes.ok && yearsRes.data.data) || [];
    classSel.innerHTML += classes.map(c =>
      option(c.id, c.section + ' — ' + c.name + (c.stream ? ' (' + c.stream + ')' : ''))).join('');
    yearSel.innerHTML += years.map(y => option(y.id, y.name + (y.isCurrent ? ' (current)' : ''))).join('');
    const current = years.find(y => y.isCurrent);
    if (current) yearSel.value = String(current.id);
  });

  function show(text, kind) {
    msg.textContent = text;
    msg.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function promote(classId, payload) {
    return api('/students/promote/' + encodeURIComponent(classId), { method: 'POST', body: JSON.stringify(payload) });
  }

  document.getElementById('promoteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const classId = classSel.value;
    const academicYearId = Number(yearSel.value);
    if (!classId || !academicYearId) return show('Select a class and academic year', 'error');

    show('Checking class…');
    try {
      const preview = await promote(classId, { academicYearId });
      if (!preview.ok) return show((preview.data && preview.data.message) || 'Could not preview this promotion', 'error');
      const p = preview.data.data;
      const action = p.finalYear ? 'graduate' : 'move up';
      if (!confirm(`${p.class} (${p.section}): ${p.candidates} student(s). Students averaging at least ${p.passMinimum} will ${action}; the rest repeat the year. This cannot be undone. Continue?`)) {
        return show('');
      }

      show('Promoting…');
      const res = await promote(classId, { academicYearId, confirm: true });
      if (!res.ok) return show((res.data && res.data.message) || 'Promotion failed', 'error');
      const d = res.data.data;
      show(`Promoted: ${d.promoted} · Graduated: ${d.graduated} · Repeating: ${d.retained ?? 0}`, 'ok');
      if (d.errors && d.errors.length) toast('Some students could not be moved: ' + d.errors.join(', '), 'warning', 8000);
    } catch (err) {
      show(err.message, 'error');
    }
  });
})();
