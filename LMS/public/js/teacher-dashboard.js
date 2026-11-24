// Teacher dashboard: a side menu of tabs (timetable, attendance, laboratory requests, subjects, students, marks, duties, profile).
function teacherName(t) {
  return [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const classLabel = r => `${r.section} ${r.className}${r.stream && r.stream !== 'Normal' ? ' ' + r.stream : ''}`;
const currentTerm = () => { const m = new Date().getMonth() + 1; return m >= 9 ? 'First' : m <= 3 ? 'Second' : 'Third'; };
const todayName = () => new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Africa/Douala' }).format(new Date());

// ---------------------------------------------------------------- navigation (sidebar links #dashboard, #marks, ...)
const twTabs = [...document.querySelectorAll('.tp-link[data-tab]')];
const twLoaded = new Set();
const twLoaders = {};      // tab -> function run the first time the tab opens
const twReload = new Set(['dashboard']);   // tabs refreshed every time they open (figures change as you work)
function twShow(tab, { updateHash = true } = {}) {
  const link = twTabs.find(b => b.dataset.tab === tab && !b.hidden) || twTabs[0];
  const name = link.dataset.tab;
  twTabs.forEach(b => {
    const on = b === link;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    const panel = document.getElementById('tw-' + b.dataset.tab);
    if (panel) panel.hidden = !on;
  });
  document.getElementById('tpTitle').textContent = link.querySelector('span').textContent;
  document.title = `${link.querySelector('span').textContent} – Teacher – KodoSchool`;
  tpCloseMenu();
  if (updateHash && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (twLoaders[name] && (!twLoaded.has(name) || twReload.has(name))) { twLoaded.add(name); twLoaders[name](); }
}
window.addEventListener('hashchange', () => {
  twShow(location.hash.slice(1), { updateHash: false });
  window.scrollTo(0, 0);
  document.getElementById('tpContent').focus({ preventScroll: true }); // screen readers start at the new section
});

// Mobile: the sidebar slides in over the page.
const tpMenuBtn = document.getElementById('tpMenuBtn'), tpOverlay = document.getElementById('tpOverlay');
function tpCloseMenu() {
  document.body.classList.remove('nav-open');
  tpOverlay.hidden = true;
  tpMenuBtn.setAttribute('aria-expanded', 'false');
}
tpMenuBtn.addEventListener('click', () => {
  const open = !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  tpOverlay.hidden = !open;
  tpMenuBtn.setAttribute('aria-expanded', String(open));
  if (open) twTabs.find(b => b.classList.contains('active'))?.focus();
});
tpOverlay.addEventListener('click', tpCloseMenu);
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && document.body.classList.contains('nav-open')) { tpCloseMenu(); tpMenuBtn.focus(); } });
document.querySelector('[data-signout]')?.addEventListener('click', () => logout());

// "My duties" appears only when duty-links.js finds a duty for this teacher.
const dutyCard = document.getElementById('dutyCard');
if (dutyCard) new MutationObserver(() => { document.getElementById('tw-tab-duties').hidden = dutyCard.hidden; }).observe(dutyCard, { attributes: true, attributeFilter: ['hidden'] });

// ---------------------------------------------------------------- profile
// Laboratory requests: only for teachers of a subject marked "Requires practicals" (set from the profile).
let teachesPracticals = false;
function applyPracticals() {
  document.getElementById('tw-tab-lab').hidden = !teachesPracticals;
  if (!teachesPracticals && location.hash === '#lab') twShow('dashboard');
}

async function loadProfile() {
  const { ok, data } = await api('/teachers/profile');
  if (ok) { teachesPracticals = Boolean(data.data.teachesPracticals); applyPracticals(); }
  const el = document.getElementById('profile');
  const welcome = document.getElementById('welcome');
  if (!ok) { welcome.textContent = 'Your profile could not be loaded.'; return; }
  const t = data.data;
  const full = teacherName(t);
  welcome.textContent = `Welcome back, ${full}!`;
  document.getElementById('twMeta').textContent = `${t.section} section teacher — your lessons, registers and marks in one place.`;
  document.getElementById('tpUserName').textContent = full;
  document.getElementById('tpAvatar').textContent = full.split(/\s+/).filter(w => /^[A-Za-zÀ-ÿ]/.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const joined = new Date(t.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const status = t.status === 'active' ? '<span class="badge no">Active</span>' : `<span class="badge yes">${esc(t.status)}</span>`;
  renderProfileCard(el, {
    name: full,
    subtitle: `${t.role}, ${t.section} section`,
    fields: [
      { label: 'Email', value: t.email, href: 'mailto:' + t.email },
      { label: 'Phone', value: t.phone || '—', href: t.phone ? 'tel:' + t.phone : null },
      { label: 'Secondary contact', value: t.secondaryContactName ? t.secondaryContactName + (t.secondaryContactPhone ? ', ' + t.secondaryContactPhone : '') : '—' },
      { label: 'Employment', value: t.employmentType },
      { label: 'Section', value: t.section },
      { label: 'Status', value: status, html: true },
      { label: 'Joined', value: joined },
    ],
  });
}

// ---------------------------------------------------------------- timetable
async function loadTimetable() {
  const term = document.getElementById('ttTerm').value;
  const grid = document.getElementById('ttGrid'), todayBox = document.getElementById('ttToday'), summary = document.getElementById('ttSummary');
  grid.innerHTML = '<p class="muted">Loading&hellip;</p>';
  const [tt, ctx] = await Promise.all([api(`/timetables/teacher?term=${encodeURIComponent(term)}`), api('/academic-context')]);
  if (!tt.ok) { grid.innerHTML = `<p class="msg error">${esc(tt.data?.message || 'Your timetable could not be loaded.')}</p>`; todayBox.innerHTML = ''; return; }
  const lessons = tt.data.data || [];
  const slots = (ctx.ok && ctx.data.data.slots) || [];
  if (!lessons.length) {
    summary.textContent = `No lessons are timetabled for you in the ${term.toLowerCase()} term.`;
    todayBox.innerHTML = ''; grid.innerHTML = ''; return;
  }
  const lessonClass = l => `${l.section === 'Anglophone' ? 'A' : 'F'} ${l.class_name}${l.stream && l.stream !== 'Normal' ? ' ' + l.stream : ''}`;
  const isStudy = l => /study/i.test(l.subject_name || '');
  const teaching = lessons.filter(l => !isStudy(l));
  const classes = new Set(teaching.map(l => l.class_id));
  summary.textContent = `${teaching.length} lessons a week in ${classes.size} class${classes.size === 1 ? '' : 'es'}${lessons.length > teaching.length ? `, plus ${lessons.length - teaching.length} study periods to supervise` : ''}.`;

  // Today
  const today = todayName();
  const todays = lessons.filter(l => l.day_of_week === today).sort((a, b) => a.start_time.localeCompare(b.start_time));
  todayBox.innerHTML = DAYS.includes(today)
    ? `<h3>Today, ${esc(today)}</h3>` + (todays.length
      ? `<ol class="tw-day">${todays.map(l => `<li><span class="tw-time">${esc(l.start_time)}–${esc(l.end_time)}</span><span><strong>${esc(lessonClass(l))}</strong> ${esc(l.subject_name)}${l.room ? `, ${esc(l.room)}` : ''}</span></li>`).join('')}</ol>`
      : '<p class="muted">No lessons today.</p>')
    : '';

  // Week grid
  const at = new Map(lessons.map(l => [`${l.day_of_week}|${l.time_slot_id}`, l]));
  let html = `<table class="tt-grid tw-grid"><thead><tr><th>Time</th>${DAYS.map(d => `<th${d === today ? ' class="tw-now"' : ''}>${esc(d)}</th>`).join('')}</tr></thead><tbody>`;
  for (const s of slots) {
    if (s.is_break) { html += `<tr class="tt-break"><td class="tt-time">${esc(s.start_time)}–${esc(s.end_time)}</td>${DAYS.map(() => '<td>Break</td>').join('')}</tr>`; continue; }
    html += `<tr><td class="tt-time">${esc(s.start_time)}<br>${esc(s.end_time)}</td>`;
    for (const d of DAYS) {
      const l = at.get(`${d}|${s.id}`);
      const now = d === today ? ' tw-now' : '';
      html += l ? `<td class="tt-filled${isStudy(l) ? ' tt-study' : ''}${now}"><strong>${esc(lessonClass(l))}</strong><br><span class="muted">${esc(l.subject_name)}</span></td>` : `<td class="tt-empty${now}">—</td>`;
    }
    html += '</tr>';
  }
  grid.innerHTML = html + '</tbody></table>';
}
document.getElementById('ttTerm').value = currentTerm();
document.getElementById('ttTerm').addEventListener('change', loadTimetable);

// ---------------------------------------------------------------- subjects
let mySubjects = [];
async function loadMySubjects() {
  const { ok, data } = await api('/teachers/my-subjects');
  const el = document.getElementById('subjectRows');
  if (!ok) { el.innerHTML = '<tr><td colspan="4" class="muted">Your subjects could not be loaded.</td></tr>'; return; }
  const seen = new Set();
  mySubjects = data.data.filter(r => !seen.has(r.classSubjectId) && seen.add(r.classSubjectId));
  if (!mySubjects.length) { el.innerHTML = '<tr><td colspan="4" class="muted">You are not assigned to any class yet. The administrator assigns classes under Evaluation.</td></tr>'; return; }
  el.innerHTML = mySubjects.map(r => `
    <tr>
      <td>${esc(classLabel(r))}</td>
      <td>${esc(r.subject)}</td>
      <td>${esc(r.code)}</td>
      <td class="tw-row-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-goto="students" data-class="${r.classId}">Students</button>
        <button type="button" class="btn btn-secondary btn-sm" data-goto="marks" data-cs="${r.classSubjectId}">Enter marks</button>
      </td>
    </tr>`).join('');
}
document.getElementById('subjectRows').addEventListener('click', ev => {
  const b = ev.target.closest('[data-goto]');
  if (!b) return;
  if (b.dataset.goto === 'students') { selectedClass = +b.dataset.class; location.hash = 'students'; renderStudents(); }
  else openMarkSheet(b.dataset.cs, currentTerm());
});

// ---------------------------------------------------------------- students, by class
let myStudents = [], selectedClass = null;
async function loadMyStudents() {
  const [st] = await Promise.all([api('/teachers/my-students'), mySubjects.length ? null : loadMySubjects()]);
  if (!st.ok) { document.getElementById('studentRows').innerHTML = '<tr><td colspan="5" class="muted">Your students could not be loaded.</td></tr>'; return; }
  myStudents = st.data.data || [];
  document.getElementById('studentCount').textContent = `(${myStudents.length})`;
  renderStudents();
}
function renderStudents() {
  const classes = [...new Map(mySubjects.map(r => [r.classId, { id: r.classId, label: classLabel(r) }])).values()];
  if (!classes.some(c => c.id === selectedClass)) selectedClass = classes[0]?.id ?? null;
  const countFor = id => myStudents.filter(s => s.currentClassLevel === id).length;
  document.getElementById('studentClasses').innerHTML = classes.map(c =>
    `<button type="button" role="radio" class="tw-class" data-class="${c.id}" aria-checked="${c.id === selectedClass}">${esc(c.label)}<span>${countFor(c.id)}</span></button>`).join('');
  const q = document.getElementById('studentSearch').value.trim().toLowerCase();
  const rows = myStudents.filter(s => s.currentClassLevel === selectedClass)
    .filter(s => !q || `${teacherName(s)} ${s.matricule}`.toLowerCase().includes(q))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  const dob = d => (d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
  document.getElementById('studentRows').innerHTML = !classes.length
    ? '<tr><td colspan="5" class="muted">You are not assigned to any class yet.</td></tr>'
    : rows.length ? rows.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(teacherName(s))}</td><td>${esc(s.matricule)}</td><td>${esc(s.sex || '')}</td><td>${esc(dob(s.dateOfBirth))}</td></tr>`).join('')
      : `<tr><td colspan="5" class="muted">${q ? 'No student in this class matches your search.' : 'No students are in this class yet.'}</td></tr>`;
}
document.getElementById('studentClasses').addEventListener('click', ev => {
  const b = ev.target.closest('.tw-class');
  if (b) { selectedClass = +b.dataset.class; renderStudents(); }
});
document.getElementById('studentClasses').addEventListener('keydown', ev => {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(ev.key)) return;
  const buttons = [...document.querySelectorAll('.tw-class')];
  const i = buttons.findIndex(b => +b.dataset.class === selectedClass);
  const next = buttons[(i + (['ArrowRight', 'ArrowDown'].includes(ev.key) ? 1 : -1) + buttons.length) % buttons.length];
  if (!next) return;
  ev.preventDefault(); selectedClass = +next.dataset.class; renderStudents();
  document.querySelector(`.tw-class[data-class="${selectedClass}"]`)?.focus();
});
document.getElementById('studentSearch').addEventListener('input', renderStudents);

// ---------------------------------------------------------------- laboratory requests (summary; changes happen on /lab-requests)
const LAB_STATUS = { pending: 'Waiting for approval', approved: 'Approved, ready to collect', issued: 'Issued to you', returned: 'Returned', declined: 'Declined', consumed: 'Used up', damaged: 'Returned damaged' };
async function loadLab() {
  const res = await fetch('/lab-requests/mine', { headers: { Accept: 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) } });
  const body = await res.json().catch(() => null);
  const rows = document.getElementById('labRows');
  if (!res.ok || !body) { rows.innerHTML = `<tr><td colspan="5" class="muted">${esc(body?.message || 'Your requests could not be loaded.')} <a href="/lab-requests">Open the request page</a>.</td></tr>`; return; }
  const list = body.data.requests;
  labCache = list;
  const n = s => list.filter(r => r.status === s).length;
  const overdue = list.filter(r => r.overdue);
  document.getElementById('labStats').innerHTML = [['Waiting for approval', n('pending')], ['Approved', n('approved')], ['With you now', n('issued')], ['Overdue', overdue.length]]
    .map(([k, v], i) => `<div class="tw-stat${i === 3 && v ? ' is-alert' : ''}"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  document.getElementById('labOverdue').innerHTML = overdue.length
    ? `<p class="alert alert-error" role="alert"><strong>Return overdue equipment:</strong> ${overdue.map(r => `${esc(r.name)} (due ${esc(r.returnBy)})`).join(', ')}. New equipment requests are blocked until it is checked in.</p>` : '';
  const badge = document.getElementById('twLabCount');
  const open = n('pending') + n('approved') + n('issued');
  badge.hidden = !open; badge.textContent = open; badge.classList.toggle('is-alert', overdue.length > 0);
  badge.setAttribute('aria-label', `${open} open request${open === 1 ? '' : 's'}`);
  rows.innerHTML = list.length ? list.map(r => `<tr${r.overdue ? ' class="tw-overdue"' : ''}>
      <td><strong>${esc(r.name)}</strong><br><span class="muted">${esc(r.subject)}${r.className ? `, ${esc(r.className)}` : ''}</span></td>
      <td>${esc(r.quantity)} ${esc(r.unit || '')}</td><td>${esc(r.needed || '—')}</td><td>${esc(r.returnBy || '—')}</td>
      <td><span class="tw-status tw-status-${esc(r.overdue ? 'overdue' : r.status)}">${esc(r.overdue ? 'Overdue' : LAB_STATUS[r.status] || r.status)}</span></td></tr>`).join('')
    : '<tr><td colspan="5" class="muted">You have not made any requests yet. Use <strong>New request</strong> before your next practical.</td></tr>';
}

Object.assign(twLoaders, { timetable: loadTimetable, lab: loadLab, subjects: loadMySubjects, students: loadMyStudents, profile: loadProfile });

// ---------------------------------------------------------------- dashboard (the first thing a teacher sees)
let labCache = null;   // set by loadLab
let labReady = null;   // the first loadLab() call, shared so the dashboard does not fetch twice
const nowHHMM = () => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Douala' }).format(new Date());
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortClass = l => `${l.section === 'Anglophone' ? 'A' : 'F'} ${l.class_name}${l.stream && l.stream !== 'Normal' ? ' ' + l.stream : ''}`;
const isStudyName = name => /study/i.test(name || '');

async function openMarkSheet(classSubjectId, term) {
  twShow('marks');
  const sel = document.getElementById('msSubject'), termSel = document.getElementById('msTerm');
  if (sel.value !== String(classSubjectId)) { sel.value = String(classSubjectId); sel.dispatchEvent(new Event('change')); }
  if (term) { termSel.value = term; termSel.dispatchEvent(new Event('change')); }
  if (sel.value && termSel.value) document.getElementById('msForm').requestSubmit();
}

// Registers still to take today (lessons that have started, study periods excluded); also drives the sidebar badge.
function pendingRegisters(attLessons, now) {
  return (attLessons || []).filter(l => !isStudyName(l.subjectName) && l.startTime <= now && !l.registerId);
}
function setAttendanceBadge(n) {
  const badge = document.getElementById('twAttCount');
  badge.hidden = !n; badge.textContent = n;
  badge.setAttribute('aria-label', `${plural(n, 'register')} to take today`);
}
async function refreshAttendanceBadge() {
  const res = await api(`/attendance/my-lessons?date=${todayIso()}&term=${currentTerm()}`);
  if (res.ok) setAttendanceBadge(pendingRegisters(res.data.data.lessons, nowHHMM()).length);
}

async function loadDashboard() {
  const term = currentTerm();
  const base = ({ First: 0, Second: 2, Third: 4 })[term];
  document.getElementById('dbMarksTerm').textContent = `${term} term`;
  document.getElementById('dbSeq1').textContent = `Sequence ${base + 1}`;
  document.getElementById('dbSeq2').textContent = `Sequence ${base + 2}`;

  const [ctx, tt, att] = await Promise.all([
    api('/academic-context'),
    api(`/timetables/teacher?term=${term}`),
    api(`/attendance/my-lessons?date=${todayIso()}&term=${term}`),
    mySubjects.length ? null : loadMySubjects(),
    myStudents.length ? null : api('/teachers/my-students').then(r => { if (r.ok) myStudents = r.data.data || []; }),
    labCache ? null : (labReady || (labReady = profileReady.then(() => (teachesPracticals ? loadLab() : null)))),
  ]);
  const year = ctx.ok ? ctx.data.data.currentYear : null;
  const lessons = tt.ok ? tt.data.data || [] : [];
  const attLessons = att.ok ? att.data.data.lessons || [] : [];
  const today = todayName(), now = nowHHMM();
  const todays = lessons.filter(l => l.day_of_week === today).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const registers = new Map(attLessons.map(l => [l.startTime, l]));
  const pending = pendingRegisters(attLessons, now);
  setAttendanceBadge(pending.length);
  const labOpen = (labCache || []).filter(r => ['pending', 'approved', 'issued'].includes(r.status)).length;
  const labOverdue = (labCache || []).filter(r => r.overdue);

  // Key figures
  document.getElementById('dbStats').innerHTML = [
    [todays.filter(l => !isStudyName(l.subject_name)).length, 'Lessons today', ''],
    [new Set(mySubjects.map(s => s.classId)).size, 'My classes', ''],
    [myStudents.length, 'My students', ''],
    ...(teachesPracticals ? [[labOpen, 'Open lab requests', labOverdue.length ? `${labOverdue.length} overdue` : '']] : []),
  ].map(([v, label, note]) => `<div class="tp-card tp-stat${note ? ' is-alert' : ''}"><div class="tp-v">${v}</div><div class="tp-l">${label}${note ? `<strong>${esc(note)}</strong>` : ''}</div></div>`).join('');

  // Today
  const todayBox = document.getElementById('dbToday');
  if (!DAYS.includes(today)) todayBox.innerHTML = `<p class="tp-empty">No classes on ${esc(today)}.</p>`;
  else if (!todays.length) todayBox.innerHTML = '<p class="tp-empty">You have no lessons today.</p>';
  else todayBox.innerHTML = todays.map(l => {
    const reg = registers.get(l.start_time);
    const started = l.start_time <= now, current = started && l.end_time > now;
    const right = isStudyName(l.subject_name) ? '<span class="tp-muted">Study period</span>'
      : reg && reg.registerId ? `<span class="tp-done">✓ Register taken (${reg.marked}/${reg.students})</span>`
      : started ? '<button type="button" class="tp-btn soft" data-goto-tab="attendance">Take register</button>'
      : '<span class="tp-muted">Later today</span>';
    return `<div class="tp-lesson${current ? ' is-now' : ''}${l.end_time <= now ? ' is-past' : ''}">
      <div class="tp-time">${esc(l.start_time)}–${esc(l.end_time)}${current ? '<span class="tp-now">Now</span>' : ''}</div>
      <div class="tp-what"><b>${esc(shortClass(l))}</b><small>${esc(l.subject_name)}</small></div>${right}</div>`;
  }).join('');

  // Marks progress for this term, per class subject
  const progress = year ? await Promise.all(mySubjects.map(async s => {
    const r = await api(`/marks/students/${s.classSubjectId}/${term}/${year.id}`);
    const rows = r.ok ? r.data.data || [] : [];
    return { s, n: rows.length, seq1: rows.filter(x => x.seq1_score != null).length, seq2: rows.filter(x => x.seq2_score != null).length };
  })) : [];
  const bar = (k, n) => n ? `<div class="tp-progress">${k} of ${n}<div class="tp-bar"><i style="width:${Math.round((k / n) * 100)}%"></i></div></div>` : '<span class="tp-muted">No students enrolled</span>';
  document.getElementById('dbMarks').innerHTML = progress.length ? progress.map(p => `<tr>
      <td><b>${esc(`${p.s.section} ${p.s.className}${p.s.stream && p.s.stream !== 'Normal' ? ' ' + p.s.stream : ''}`)}</b><small>${esc(p.s.subject)}</small></td>
      <td>${bar(p.seq1, p.n)}</td><td>${bar(p.seq2, p.n)}</td>
      <td class="tp-right"><button type="button" class="tp-btn-outline" data-open-sheet="${p.s.classSubjectId}">${p.n && p.seq1 === p.n && p.seq2 === p.n ? 'Review marks' : 'Enter marks'}</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="tp-muted">You are not assigned to any class yet.</td></tr>';

  // Needs your attention
  const items = [];
  const alert = (title, line, button, kind = '') => items.push(`<div class="tp-alert${kind ? ' is-' + kind : ''}"><div class="tp-txt"><b>${title}</b><span>${line}</span></div>${button}</div>`);
  for (const l of pending) alert(esc(`${l.className.replace(/^\w+ — /, '').replace(/ \(Normal\)$/, '')} ${l.subjectName}`), `Register not taken · ${esc(l.startTime)}`, '<button type="button" class="tp-btn" data-goto-tab="attendance">Take register</button>');
  for (const r of labOverdue) alert(`Return ${esc(r.name)}`, `Laboratory equipment overdue since ${esc(r.returnBy)}`, '<button type="button" class="tp-btn" data-goto-tab="lab">View</button>', 'danger');
  const ready = (labCache || []).filter(r => r.status === 'approved');
  if (ready.length) alert(`${plural(ready.length, 'lab request')} approved`, 'Ready to collect from the laboratory', '<button type="button" class="tp-btn soft" data-goto-tab="lab">View</button>', 'info');
  const behind = progress.filter(p => p.n && (p.seq1 < p.n || p.seq2 < p.n));
  for (const p of behind) alert(esc(`${p.s.className}${p.s.stream && p.s.stream !== 'Normal' ? ' ' + p.s.stream : ''} ${p.s.subject}`), `${plural(2 * p.n - p.seq1 - p.seq2, 'mark')} still to enter · ${term} term`, `<button type="button" class="tp-btn" data-open-sheet="${p.s.classSubjectId}">Enter marks</button>`);
  document.getElementById('dbTodoCount').textContent = items.length ? `${items.length} pending` : '';
  document.getElementById('dbTodo').innerHTML = items.join('') || '<p class="tp-empty tp-done">✓ You are all caught up: registers are taken, marks are in and nothing is overdue.</p>';
}

// Buttons on the dashboard that jump to a section or straight into a mark sheet.
document.getElementById('tw-dashboard').addEventListener('click', ev => {
  const go = ev.target.closest('[data-goto-tab]');
  if (go) { location.hash = go.dataset.gotoTab; return; }
  const sheet = ev.target.closest('[data-open-sheet]');
  if (sheet) openMarkSheet(sheet.dataset.openSheet, currentTerm());
});
twLoaders.dashboard = loadDashboard;

// --- Marks entry (mark sheet: both sequences, out of 20) ---
let marksSubjects = [];
let markSheet = null;
const msPlaceholder = '<div class="ms-placeholder"><strong>Choose one of your classes and a term</strong>Both sequences open together, marked out of 20.</div>';
const msMsg = (text, kind) => { const m = document.getElementById('msMsg'); m.textContent = text; m.className = 'msg' + (kind ? ' ' + kind : ''); };

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

// Filter steps: each turns green once chosen; the button opens only when both are chosen.
const MS_FIELDS = [['subject', 'msSubject'], ['term', 'msTerm']];
const msField = name => document.querySelector(`#msForm [data-field="${name}"]`);
function msRefreshFilter() {
  let complete = true;
  for (const [name, id] of MS_FIELDS) {
    const ok = Boolean(document.getElementById(id).value);
    msField(name).classList.toggle('done', ok);
    if (ok) { msField(name).classList.remove('invalid'); msField(name).querySelector('.mk-hint').textContent = ''; }
    complete = complete && ok;
  }
  document.getElementById('msLoadBtn').disabled = !complete;
}
MS_FIELDS.forEach(([, id]) => document.getElementById(id).addEventListener('change', msRefreshFilter));

document.getElementById('msForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const csId = document.getElementById('msSubject').value;
  const term = document.getElementById('msTerm').value;
  if (!csId || !term) {
    for (const [name, id] of MS_FIELDS) {
      if (document.getElementById(id).value) continue;
      msField(name).classList.add('invalid');
      msField(name).querySelector('.mk-hint').textContent = 'Required';
    }
    document.getElementById(csId ? 'msTerm' : 'msSubject').focus();
    return;
  }
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
    msRefreshFilter();
  }
});

// ---------------------------------------------------------------- start
const profileReady = loadProfile();   // name in the welcome bar (the profile tab reuses it), and whether Lab shows
twLoaded.add('profile');
loadMarksSubjects();
labReady = profileReady.then(() => (teachesPracticals ? loadLab() : null));   // open-requests count beside "Laboratory requests"
twLoaded.add('lab');
refreshAttendanceBadge(); // count of registers to take, beside "Attendance"
twShow(location.hash.slice(1) || 'dashboard', { updateHash: false });
