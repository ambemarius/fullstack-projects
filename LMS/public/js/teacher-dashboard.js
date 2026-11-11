// Teacher dashboard: render the logged-in teacher's profile as a card.
function teacherName(t) {
  return [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
}

async function loadProfile() {
  const { ok, data } = await api('/teachers/profile');
  const el = document.getElementById('profile');
  const welcome = document.getElementById('welcome');

  if (!ok) { welcome.textContent = 'Could not load profile.'; return; }

  const t = data.data;
  const full = teacherName(t);
  welcome.textContent = `Welcome back, ${full}`;

  const joined = new Date(t.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const status =
    t.status === 'active' ? '<span class="badge no">Active</span>' :
    t.status === 'suspended' ? '<span class="badge yes">Suspended</span>' :
    '<span class="badge yes">Withdrawn</span>';

  renderProfileCard(el, {
    name: full,
    subtitle: `${t.role} · ${t.section} section`,
    fields: [
      { label: 'Email', value: t.email, href: 'mailto:' + t.email },
      { label: 'Phone', value: t.phone || '—', href: t.phone ? 'tel:' + t.phone : null },
      { label: 'Secondary contact', value: t.secondaryContactName ? t.secondaryContactName + (t.secondaryContactPhone ? ' — ' + t.secondaryContactPhone : '') : '—' },
      { label: 'Employment', value: t.employmentType },
      { label: 'Section', value: t.section },
      { label: 'Status', value: status, html: true },
      { label: 'Joined', value: joined },
    ],
  });
}
async function loadMySubjects() {
  const { ok, data } = await api('/teachers/my-subjects');
  const el = document.getElementById('subjectRows');
  if (!ok) { el.innerHTML = '<tr><td colspan="4" class="muted">Failed to load</td></tr>'; return; }
  if (!data.data.length) { el.innerHTML = '<tr><td colspan="4" class="muted">You are not assigned to any class yet</td></tr>'; return; }
  el.innerHTML = data.data.map(r => `
    <tr>
      <td>${esc(r.section)} ${esc(r.className)}${r.stream ? ' ' + esc(r.stream) : ''}</td>
      <td>${esc(r.subject)}</td>
      <td>${esc(r.code)}</td>
      <td>${esc(r.term)}</td>
    </tr>`).join('');
}

async function loadMyStudents() {
  const { ok, data } = await api('/teachers/my-students');
  const el = document.getElementById('studentRows');
  if (!ok) { el.innerHTML = '<tr><td colspan="3" class="muted">Failed to load</td></tr>'; return; }
  document.getElementById('studentCount').textContent = `(${data.results})`;
  if (!data.data.length) { el.innerHTML = '<tr><td colspan="3" class="muted">No students in your classes yet</td></tr>'; return; }
  el.innerHTML = data.data.map(s => {
    const full = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
    return `<tr>
      <td>${esc(full)}</td>
      <td>${esc(s.matricule)}</td>
      <td>${esc(s.section)}</td>
    </tr>`;
  }).join('');
}

// --- Marks entry ---
let marksSubjects = [];
let marksCurClassSubjectId = null;
let marksCurYearId = null;
let marksCurTerm = null;

function fullStudentName(s) {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
}

async function loadMarksSubjects() {
  const { ok, data } = await api('/teachers/my-subjects');
  const sel = document.getElementById('msSubject');
  if (!ok || !data.data.length) return;
  marksSubjects = data.data;
  // deduplicate and show only unique classSubjectId+term combos
  const seen = {};
  for (const r of data.data) {
    const key = r.classSubjectId + '-' + r.term;
    if (seen[key]) continue;
    seen[key] = true;
    const label = `${r.section} ${r.className}${r.stream ? ' ' + r.stream : ''} — ${r.subject} (${r.term})`;
    const opt = document.createElement('option');
    opt.value = r.classSubjectId + '|' + r.term + '|' + r.classId;
    opt.textContent = label;
    sel.appendChild(opt);
  }
}

document.getElementById('msLoadBtn').addEventListener('click', async () => {
  const val = document.getElementById('msSubject').value;
  const term = document.getElementById('msTerm').value;
  const msg = document.getElementById('msMsg');
  msg.textContent = ''; msg.className = 'msg';

  if (!val || !term) {
    msg.textContent = 'Select subject and term'; msg.className = 'msg error';
    return;
  }

  const yrRes = await api('/academic-context');
  if (!yrRes.ok) { msg.textContent = 'Failed to load academic years'; msg.className = 'msg error'; return; }
  const curYear = yrRes.data.data.currentYear;
  if (!curYear) { msg.textContent = 'No current academic year set'; msg.className = 'msg error'; return; }
  marksCurYearId = curYear.id;
  marksCurTerm = term;

  const [csId] = val.split('|');
  marksCurClassSubjectId = +csId;

  const stRes = await api(`/marks/students/${csId}/${term}/${curYear.id}`);
  if (!stRes.ok) { msg.textContent = stRes.data?.message || 'Failed to load'; msg.className = 'msg error'; return; }
  const rows = stRes.data.data;

  const classInfo = marksSubjects.find(r => r.classSubjectId === +csId);
  document.getElementById('msClassInfo').textContent =
    classInfo ? `${classInfo.section} ${classInfo.className}${classInfo.stream ? ' ' + classInfo.stream : ''} — ${classInfo.subject} — ${term} term` : '';
  document.getElementById('marksArea').style.display = 'block';

  const tbody = document.getElementById('marksRows');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No students in this class</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((s, i) => {
    const name = fullStudentName(s);
    const s1 = s.seq1_score != null ? s.seq1_score : '';
    const s2 = s.seq2_score != null ? s.seq2_score : '';
    const total = (s.seq1_score != null ? +s.seq1_score : 0) + (s.seq2_score != null ? +s.seq2_score : 0);
    return `<tr>
      <td class="td-num">${i + 1}</td>
      <td class="td-name">${esc(name)}</td>
      <td class="td-mat">${esc(s.matricule)}</td>
      <td class="td-score"><input type="number" class="ms-seq1" data-id="${s.id}" value="${s1}" min="0" max="50" step="0.5" placeholder="0-50"></td>
      <td class="td-score"><input type="number" class="ms-seq2" data-id="${s.id}" value="${s2}" min="0" max="50" step="0.5" placeholder="0-50"></td>
      <td class="td-total"><span class="ms-total" data-id="${s.id}">${total}</span></td>
    </tr>`;
  }).join('');

  // Auto-update totals as user types
  document.querySelectorAll('.ms-seq1, .ms-seq2').forEach(inp => {
    inp.addEventListener('input', () => {
      const row = inp.closest('tr');
      const v1 = parseFloat(row.querySelector('.ms-seq1').value) || 0;
      const v2 = parseFloat(row.querySelector('.ms-seq2').value) || 0;
      row.querySelector('.ms-total').textContent = v1 + v2;
    });
  });
});

document.getElementById('msSaveBtn').addEventListener('click', async () => {
  const msg = document.getElementById('msMsg');
  msg.textContent = ''; msg.className = 'msg';

  const rows = document.querySelectorAll('#marksRows tr');
  const entries = [];
  for (const row of rows) {
    const s1 = row.querySelector('.ms-seq1');
    const s2 = row.querySelector('.ms-seq2');
    if (!s1 || !s2) continue;
    const v1 = parseFloat(s1.value);
    const v2 = parseFloat(s2.value);
    if (isNaN(v1) && isNaN(v2)) continue;
    const entry = { studentId: +s1.dataset.id, maxScore: 50 };
    if (!isNaN(v1)) entry.seq1 = v1;
    if (!isNaN(v2)) entry.seq2 = v2;
    entries.push(entry);
  }

  if (!entries.length) {
    msg.textContent = 'Enter at least one score'; msg.className = 'msg error';
    return;
  }

  const res = await api(`/marks/save-all/${marksCurClassSubjectId}/${marksCurTerm}/${marksCurYearId}`, {
    method: 'POST', body: JSON.stringify({ entries })
  });
  if (!res.ok) { msg.textContent = res.data?.message || 'Save failed'; msg.className = 'msg error'; return; }
  msg.textContent = res.data.message + ' — totals updated'; msg.className = 'msg ok';
});

loadProfile();
loadMySubjects();
loadMyStudents();
loadMarksSubjects();
