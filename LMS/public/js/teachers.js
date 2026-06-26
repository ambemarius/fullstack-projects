const rows = document.getElementById('rows');
const msg = document.getElementById('msg');

function fullName(t) {
  return [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
}

function statusBadge(status) {
  const cls = status === 'active' ? 'no' : 'yes';
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

async function loadTeachers() {
  const { ok, data } = await api('/teachers');
  if (!ok) { rows.innerHTML = '<tr><td colspan="8" class="muted">Failed to load</td></tr>'; return; }
  const teacherSelect = document.getElementById('aTeacher');
  teacherSelect.length = 1; // keep the placeholder
  data.data.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id; o.textContent = `${fullName(t)} (${t.section})`;
    teacherSelect.appendChild(o);
  });
  if (!data.data.length) { rows.innerHTML = '<tr><td colspan="8" class="muted">No teachers yet</td></tr>'; return; }
  rows.innerHTML = data.data.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${esc(t.firstName)}</td>
      <td>${esc(t.lastName)}</td>
      <td>${esc(t.email)}</td>
      <td>${esc(t.phone || '')}</td>
      <td>${esc(t.section)}</td>
      <td>${esc(t.employmentType)}</td>
      <td>${statusBadge(t.status)}</td>
    </tr>`).join('');
}

async function loadAssignDropdowns() {
  const classes = await api('/classes');
  if (classes.ok) {
    const sel = document.getElementById('aClass');
    classes.data.data.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = `${c.section} ${c.name}${c.stream ? ' ' + c.stream : ''}`;
      sel.appendChild(o);
    });
  }
  const subjects = await api('/subjects');
  if (subjects.ok) {
    const sel = document.getElementById('aSubject');
    subjects.data.data.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = `${s.name} (${s.code})`;
      sel.appendChild(o);
    });
  }
}

document.getElementById('assignForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const assignMsg = document.getElementById('assignMsg');
  assignMsg.textContent = ''; assignMsg.className = 'msg';
  const teacherId = document.getElementById('aTeacher').value;
  const body = {
    classId: document.getElementById('aClass').value,
    subjectId: document.getElementById('aSubject').value,
    term: document.getElementById('aTerm').value,
  };
  const { ok, data } = await api(`/teachers/${teacherId}/assign`, { method: 'POST', body: JSON.stringify(body) });
  if (!ok) { assignMsg.textContent = data.message || 'Failed'; assignMsg.className = 'msg error'; return; }
  assignMsg.textContent = 'Teacher assigned'; assignMsg.className = 'msg ok';
});

loadAssignDropdowns();

document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = ''; msg.className = 'msg';
  const $ = (id) => document.getElementById(id);
  const body = {
    firstName: $('firstName').value.trim(),
    middleName: $('middleName').value.trim(),
    lastName: $('lastName').value.trim(),
    email: $('email').value.trim(),
    password: $('password').value,
    phone: $('phone').value.trim(),
    secondaryContactName: $('secondaryContactName').value.trim(),
    secondaryContactPhone: $('secondaryContactPhone').value.trim(),
    employmentType: $('employmentType').value,
    section: $('section').value,
    status: $('status').value,
  };
  const { ok, data } = await api('/teachers/register', { method: 'POST', body: JSON.stringify(body) });
  if (!ok) { msg.textContent = data.message || 'Failed'; msg.className = 'msg error'; return; }
  msg.textContent = 'Teacher created'; msg.className = 'msg ok';
  e.target.reset();
  loadTeachers();
});

loadTeachers();
