const yearSel = document.getElementById('alYear');
const classSel = document.getElementById('alClass');
const subjectSel = document.getElementById('alSubject');
const rows = document.getElementById('alRows');
const msg = document.getElementById('alMsg');

async function loadFormData() {
  const { ok, data } = await api('/allocations/form-data');
  if (!ok) return;
  data.data.academicYears.forEach(y => {
    yearSel.innerHTML += `<option value="${y.id}">${esc(y.name)}${y.isCurrent ? ' (current)' : ''}</option>`;
  });
  data.data.classes.forEach(c => {
    classSel.innerHTML += `<option value="${c.id}">${esc(c.section)} ${esc(c.name)}${c.stream ? ' ' + esc(c.stream) : ''} — ${esc(c.schoolLevel)}</option>`;
  });
  data.data.subjects.forEach(s => {
    subjectSel.innerHTML += `<option value="${s.id}">${esc(s.name)} (${esc(s.code)})</option>`;
  });
  loadAllocations();
}

async function loadAllocations() {
  const classId = classSel.value, yearId = yearSel.value;
  if (!classId || !yearId) { rows.innerHTML = '<tr><td colspan="4" class="muted">Select a class</td></tr>'; return; }
  const { ok, data } = await api(`/allocations/class/${classId}?yearId=${yearId}`);
  if (!ok) { rows.innerHTML = '<tr><td colspan="4" class="muted">Failed</td></tr>'; return; }
  if (!data.data.length) { rows.innerHTML = '<tr><td colspan="4" class="muted">No subjects allocated yet</td></tr>'; return; }
  rows.innerHTML = data.data.map(a => `
    <tr>
      <td>${esc(a.subject_name)}</td>
      <td>${esc(a.subject_code)}</td>
      <td>${a.periods_week}</td>
      <td><a href="#" class="al-del" data-id="${a.id}" style="color:var(--danger)">✕</a></td>
    </tr>`).join('');
  rows.querySelectorAll('.al-del').forEach(el => el.addEventListener('click', async ev => {
    ev.preventDefault();
    await api(`/allocations/${el.dataset.id}`, { method: 'DELETE' });
    loadAllocations();
  }));
}

yearSel.addEventListener('change', loadAllocations);
classSel.addEventListener('change', loadAllocations);

document.getElementById('alForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = ''; msg.className = 'msg';
  const body = {
    class_id: +classSel.value,
    subject_id: +subjectSel.value,
    periods_week: +document.getElementById('alPeriods').value,
    academic_year_id: +yearSel.value,
  };
  const { ok, data } = await api('/allocations', { method: 'POST', body: JSON.stringify(body) });
  if (!ok) { msg.textContent = data.message || 'Failed'; msg.className = 'msg error'; return; }
  msg.textContent = 'Saved'; msg.className = 'msg ok';
  loadAllocations();
});

loadFormData();
