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

// --- Marks entry (mark sheet: both sequences, out of 20) ---
let marksSubjects = [];
let markSheet = null;
const msPlaceholder = '<div class="ms-placeholder"><strong>Choose one of your classes and a term</strong>Both sequences open together, marked out of 20.</div>';
const msMsg = (text, kind) => { const m = document.getElementById('msMsg'); m.textContent = text; m.className = 'msg' + (kind ? ' ' + kind : ''); };
const classLabel = r => `${r.section} ${r.className}${r.stream && r.stream !== 'Normal' ? ' ' + r.stream : ''}`;

async function loadMarksSubjects() {
  const { ok, data } = await api('/teachers/my-subjects');
  const sel = document.getElementById('msSubject');
  if (!ok || !data.data.length) { sel.innerHTML = '<option value="">No classes are assigned to you yet</option>'; return; }
  marksSubjects = data.data;
  const seen = new Set();
  for (const r of data.data) {
    if (seen.has(r.classSubjectId)) continue; // one entry per class subject; the term is chosen separately
    seen.add(r.classSubjectId);
    const opt = document.createElement('option');
    opt.value = String(r.classSubjectId);
    opt.textContent = `${classLabel(r)}: ${r.subject}`;
    sel.appendChild(opt);
  }
}

// Changing the selection closes the open sheet (after a warning if marks are unsaved).
['msSubject', 'msTerm'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('focus', () => { el.dataset.prev = el.value; });
  el.addEventListener('change', () => {
    if (markSheet && markSheet.hasUnsavedChanges() && !confirm('You have marks that are not saved. Leave this mark sheet without saving?')) { el.value = el.dataset.prev || ''; return; }
    if (markSheet) { markSheet.destroy(); markSheet = null; }
    document.getElementById('msSheet').innerHTML = msPlaceholder;
    msMsg('');
  });
});

document.getElementById('msForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const csId = document.getElementById('msSubject').value;
  const term = document.getElementById('msTerm').value;
  if (!csId || !term) { msMsg('Choose a class and subject, and a term.', 'error'); return; }
  const btn = document.getElementById('msLoadBtn');
  btn.disabled = true; msMsg('Opening the mark sheet…');
  try {
    const yrRes = await api('/academic-context');
    const curYear = yrRes.ok && yrRes.data.data.currentYear;
    if (!curYear) { msMsg('No current academic year is set. Ask the administrator to set one.', 'error'); return; }
    const url = `/marks/students/${csId}/${term}/${curYear.id}`;
    const stRes = await api(url);
    if (!stRes.ok) { msMsg(stRes.data?.message || 'The students could not be loaded.', 'error'); return; }
    msMsg('');
    const info = marksSubjects.find(r => r.classSubjectId === +csId);
    if (markSheet) markSheet.destroy();
    markSheet = MarkSheet.mount(document.getElementById('msSheet'), {
      title: info ? `${classLabel(info)}, ${info.subject}` : 'Mark sheet',
      term,
      rows: stRes.data.data || [],
      fileName: `marks_${info ? classLabel(info) + '_' + info.subject : csId}_${term}`.replace(/[^w-]+/g, '_'),
      save: async entries => {
        const res = await api(`/marks/save-all/${csId}/${term}/${curYear.id}`, { method: 'POST', body: JSON.stringify({ entries }) });
        return { ok: res.ok, message: res.data?.message };
      },
      reload: async () => { const res = await api(url); return res.ok ? res.data.data : null; },
    });
  } finally {
    btn.disabled = false;
  }
});

loadProfile();
loadMySubjects();
loadMyStudents();
loadMarksSubjects();
