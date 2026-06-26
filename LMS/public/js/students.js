const rows = document.getElementById('rows');
const msg = document.getElementById('msg');
const classSelect = document.getElementById('currentClassLevel');
const searchInput = document.getElementById('searchInput');
const studentForm = document.getElementById('studentForm');
const studentIdInput = document.getElementById('studentId');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const deleteBtn = document.getElementById('deleteBtn');

const classLabel = {};
let allStudents = [];

async function loadClasses() {
  const { ok, data } = await api('/classes');
  if (!ok) return;
  data.data.forEach(c => {
    const label = `${c.section} ${c.name}${c.stream ? ' ' + c.stream : ''}`;
    classLabel[c.id] = label;
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = label;
    classSelect.appendChild(opt);
  });
}

function renderStudents(students) {
  if (!students.length) {
    rows.innerHTML = '<tr><td colspan="10" class="muted">No students found</td></tr>';
    return;
  }
  rows.innerHTML = students.map(s => {
    const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
    return `<tr>
      <td>${s.id}</td>
      <td>${esc(name)}</td>
      <td>${esc(s.matricule)}</td>
      <td>${esc(s.sex || '')}</td>
      <td>${esc(s.section)}</td>
      <td>${esc(classLabel[s.currentClassLevel] || s.currentClassLevel || '')}</td>
      <td>${s.dateOfBirth ? esc(s.dateOfBirth) : ''}</td>
      <td>${s.yearOfEnrollment || ''}</td>
      <td><span class="badge ${s.isWithdrawn ? 'yes' : 'no'}">${s.isWithdrawn ? 'Yes' : 'No'}</span></td>
      <td><button class="btn btn-sm btn-secondary edit-btn" data-id="${s.id}">Edit</button></td>
    </tr>`;
  }).join('');

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editStudent(btn.dataset.id));
  });
}

async function loadStudents() {
  const { ok, data } = await api('/students');
  if (!ok) { rows.innerHTML = '<tr><td colspan="10" class="muted">Failed to load</td></tr>'; return; }
  allStudents = data.data;
  renderStudents(allStudents);
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) {
    renderStudents(allStudents);
    return;
  }
  const filtered = allStudents.filter(s => {
    const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').toLowerCase();
    return name.includes(query) || s.matricule.toLowerCase().includes(query);
  });
  renderStudents(filtered);
});

function editStudent(id) {
  const student = allStudents.find(s => s.id === parseInt(id));
  if (!student) return;

  studentIdInput.value = student.id;
  document.getElementById('firstName').value = student.firstName || '';
  document.getElementById('middleName').value = student.middleName || '';
  document.getElementById('lastName').value = student.lastName || '';
  document.getElementById('matricule').value = student.matricule || '';
  document.getElementById('password').value = '';
  document.getElementById('section').value = student.section || 'Anglophone';
  document.getElementById('sex').value = student.sex || '';
  document.getElementById('dateOfBirth').value = student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '';
  document.getElementById('yearOfEnrollment').value = student.yearOfEnrollment || '';
  document.getElementById('currentClassLevel').value = student.currentClassLevel || '';
  document.getElementById('isWithdrawn').value = student.isWithdrawn ? 'true' : 'false';

  formTitle.textContent = 'Edit student';
  submitBtn.textContent = 'Update';
  clearBtn.style.display = 'inline-block';
  deleteBtn.style.display = 'inline-block';
  studentForm.scrollIntoView({ behavior: 'smooth' });
}

function clearForm() {
  studentForm.reset();
  studentIdInput.value = '';
  formTitle.textContent = 'Add student';
  submitBtn.textContent = 'Create';
  clearBtn.style.display = 'none';
  deleteBtn.style.display = 'none';
  msg.textContent = '';
  msg.className = 'msg';
}

clearBtn.addEventListener('click', clearForm);

deleteBtn.addEventListener('click', async () => {
  const id = studentIdInput.value;
  if (!id) return;
  if (!confirm('Delete this student?')) return;

  const { ok, data } = await api(`/students/${id}`, { method: 'DELETE' });
  if (!ok) { msg.textContent = data.message || 'Delete failed'; msg.className = 'msg error'; return; }
  msg.textContent = 'Student deleted'; msg.className = 'msg ok';
  clearForm();
  loadStudents();
});

studentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = ''; msg.className = 'msg';

  const $ = (id) => document.getElementById(id);
  const id = studentIdInput.value;
  const body = {
    firstName: $('firstName').value.trim(),
    middleName: $('middleName').value.trim() || undefined,
    lastName: $('lastName').value.trim(),
    matricule: $('matricule').value.trim(),
    section: $('section').value,
    sex: $('sex').value,
    dateOfBirth: $('dateOfBirth').value || undefined,
    yearOfEnrollment: $('yearOfEnrollment').value ? +$('yearOfEnrollment').value : undefined,
    currentClassLevel: $('currentClassLevel').value || null,
    isWithdrawn: $('isWithdrawn').value === 'true',
  };

  if (!body.firstName || !body.lastName || !body.matricule || !body.sex) {
    msg.textContent = 'Please fill required fields'; msg.className = 'msg error'; return;
  }

  const password = $('password').value;
  if (!id && !password) { msg.textContent = 'Password required for new student'; msg.className = 'msg error'; return; }
  if (password) body.password = password;

  const url = id ? `/students/${id}` : '/students/register';
  const method = id ? 'PUT' : 'POST';
  const { ok, data } = await api(url, { method, body: JSON.stringify(body) });

  if (!ok) { msg.textContent = data.message || 'Failed'; msg.className = 'msg error'; return; }
  msg.textContent = id ? 'Student updated' : 'Student created'; msg.className = 'msg ok';
  clearForm();
  loadStudents();
});

(async () => { await loadClasses(); await loadStudents(); })();