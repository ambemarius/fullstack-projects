// Role-aware login: posts to the correct endpoint for admin / teacher / student / parent.
const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');
const roleSel = document.getElementById('role');
const identInput = document.getElementById('identifier');
const identLabel = document.getElementById('identLabel');
const loginBtn = document.getElementById('loginBtn');

const ENDPOINT = {
  admin: '/api/v1/admin/login',
  teacher: '/api/v1/teachers/login',
  student: '/api/v1/students/login',
  parent: '/api/v1/parents/login',
  auxiliary: '/api/v1/auxiliary/login',
};
const HOME = {
  admin: '/admin-dashboard',
  teacher: '/teacher-dashboard',
  student: '/student-dashboard',
  parent: '/parent-dashboard',
  auxiliary: '/staff-dashboard',
};

const IDENT_CONFIG = {
  admin:   { label: 'Email',     type: 'email', placeholder: 'Enter your email',     field: 'email' },
  teacher: { label: 'Email',     type: 'email', placeholder: 'Enter your email',     field: 'email' },
  student: { label: 'Matricule', type: 'text',  placeholder: 'Enter your matricule', field: 'matricule' },
  parent:  { label: 'Phone',     type: 'tel',   placeholder: 'Enter your phone number', field: 'phone' },
  auxiliary: { label: 'Email',   type: 'email', placeholder: 'Enter your school email', field: 'email' },
};

function updateIdentLabel() {
  const cfg = IDENT_CONFIG[roleSel.value];
  identLabel.firstChild.nodeValue = cfg.label + ' ';
  identInput.type = cfg.type;
  identInput.placeholder = cfg.placeholder;
}
roleSel.addEventListener('change', updateIdentLabel);
updateIdentLabel();

const savedRole = localStorage.getItem('role');
if (savedRole && IDENT_CONFIG[savedRole]) { roleSel.value = savedRole; updateIdentLabel(); }
// /login?as=teacher (links on the landing page) opens with that account type chosen.
const askedRole = new URLSearchParams(window.location.search).get('as');
if (askedRole && IDENT_CONFIG[askedRole]) { roleSel.value = askedRole; updateIdentLabel(); }

const reason = new URLSearchParams(window.location.search).get('reason');
if (reason === 'expired') {
  msg.textContent = 'Your session expired. Please sign in again.';
  msg.className = 'msg error';
  for (const key of ['token', 'role', 'user']) localStorage.removeItem(key);
}

// School code: only super administrators type it. Other accounts are found in the school whose administrator
// created them; the code is asked for only if the same details open accounts in two schools (the server says 409).
// Pre-filled from a school's own link (?school=CODE), else the one last used on this device.
const schoolInput = document.getElementById('schoolCode');      // hidden: the chosen school's code
const schoolSearch = document.getElementById('schoolSearch');   // visible: "Your school" dropdown with filter
const schoolList = document.getElementById('schoolList');
const schoolField = document.getElementById('schoolCodeField');
let codeAskedByServer = false;
let schools = [];          // { code, name, place } from /api/v1/schools/search
let activeIndex = -1;
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function chooseSchool(school) {
  schoolInput.value = school ? school.code : '';
  if (school) schoolSearch.value = school.name;
  closeSchoolList();
}
function closeSchoolList() {
  schoolList.hidden = true;
  schoolSearch.setAttribute('aria-expanded', 'false');
  schoolSearch.removeAttribute('aria-activedescendant');
  activeIndex = -1;
}
function renderSchoolList() {
  const q = schoolSearch.value.trim().toLowerCase();
  const shown = schools.filter(s => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  schoolList.innerHTML = shown.length
    ? shown.map((s, i) => `<li role="option" id="school-opt-${i}" data-code="${escHtml(s.code)}" aria-selected="${s.code === schoolInput.value}"><b>${escHtml(s.name)}</b>${s.place ? `<small>${escHtml(s.place)}</small>` : ''}</li>`).join('')
    : '<li class="school-none" role="presentation">No school with that name uses KodoSchool yet.</li>';
  schoolList.hidden = false;
  schoolSearch.setAttribute('aria-expanded', 'true');
  activeIndex = -1;
}
function moveActive(step) {
  const options = [...schoolList.querySelectorAll('[role="option"]')];
  if (!options.length) return;
  activeIndex = (activeIndex + step + options.length) % options.length;
  options.forEach((o, i) => o.classList.toggle('active', i === activeIndex));
  schoolSearch.setAttribute('aria-activedescendant', options[activeIndex].id);
  options[activeIndex].scrollIntoView({ block: 'nearest' });
}
async function loadSchools() {
  try {
    const res = await fetch('/api/v1/schools/search');
    schools = (await res.json()).data || [];
  } catch { schools = []; }
  // A school's own link (?school=CODE), else the school last used on this device.
  let remembered = '';
  try { remembered = localStorage.getItem('schoolCode') || ''; } catch { /* storage unavailable */ }
  const wanted = (new URLSearchParams(window.location.search).get('school') || remembered).toUpperCase();
  const found = schools.find(s => s.code.toUpperCase() === wanted);
  if (found) chooseSchool(found);
}
if (schoolSearch) {
  schoolSearch.addEventListener('focus', renderSchoolList);
  schoolSearch.addEventListener('input', () => { schoolInput.value = ''; renderSchoolList(); });
  schoolSearch.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (schoolList.hidden) renderSchoolList(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter' && !schoolList.hidden && activeIndex >= 0) {
      e.preventDefault();
      const opt = schoolList.querySelectorAll('[role="option"]')[activeIndex];
      chooseSchool(schools.find(s => s.code === opt.dataset.code));
    } else if (e.key === 'Escape') closeSchoolList();
  });
  schoolList.addEventListener('mousedown', e => {
    const opt = e.target.closest('[role="option"]');
    if (!opt) return;
    e.preventDefault();
    chooseSchool(schools.find(s => s.code === opt.dataset.code));
  });
  document.getElementById('schoolToggle').addEventListener('click', () => {
    if (schoolList.hidden) { schoolSearch.focus(); renderSchoolList(); } else closeSchoolList();
  });
  schoolSearch.addEventListener('blur', () => setTimeout(() => {
    // A name typed in full (or a school code) counts as choosing that school.
    if (!schoolInput.value) {
      const typed = schoolSearch.value.trim().toLowerCase();
      const exact = schools.find(s => s.name.toLowerCase() === typed || s.code.toLowerCase() === typed);
      if (exact) chooseSchool(exact);
    }
    closeSchoolList();
  }, 120));
  loadSchools();
}
function schoolCodeShown() { return roleSel.value === 'admin' || codeAskedByServer; }
function updateSchoolField() {
  if (!schoolField) return;
  schoolField.hidden = !schoolCodeShown();
}
roleSel.addEventListener('change', () => { codeAskedByServer = false; updateSchoolField(); });
updateSchoolField();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  msg.className = 'msg';

  const role = roleSel.value;
  const cfg = IDENT_CONFIG[role];
  const identifier = identInput.value.trim();
  const password = document.getElementById('password').value;

  if (!identifier || !password) {
    msg.textContent = 'Please fill in all fields';
    msg.className = 'msg error';
    return;
  }
  if (role === 'admin' && schoolInput && !schoolInput.value.trim()) {
    msg.textContent = schoolSearch && schoolSearch.value.trim() ? 'Choose your school from the list.' : 'Choose your school.';
    msg.className = 'msg error';
    schoolSearch.focus();
    return;
  }

  loginBtn.classList.add('loading');
  loginBtn.textContent = 'Signing in';

  try {
    const res = await fetch(ENDPOINT[role], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [cfg.field]: identifier, password, schoolCode: schoolInput && schoolCodeShown() ? schoolInput.value.trim() : '' }),
    });
    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.message || 'Invalid credentials. Please try again.';
      msg.className = 'msg error';
      if (res.status === 409 && schoolInput) { codeAskedByServer = true; updateSchoolField(); msg.textContent = 'This account exists in more than one school. Choose your school.'; schoolSearch.focus(); }
      loginBtn.classList.remove('loading');
      loginBtn.textContent = 'Sign in';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.data));
    localStorage.setItem('role', role);
    try { if (schoolInput && schoolCodeShown() && schoolInput.value.trim()) localStorage.setItem('schoolCode', schoolInput.value.trim().toUpperCase()); } catch { /* storage unavailable */ }
    // First sign-in: the teacher chooses their own password before anything else.
    if (role === 'teacher' && data.mustChangePassword) { window.location.href = '/change-password'; return; }
    // Return to the page that asked for sign-in, but only a same-site path.
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : HOME[role];
  } catch (err) {
    msg.textContent = 'Network error — please check your connection.';
    msg.className = 'msg error';
    loginBtn.classList.remove('loading');
    loginBtn.textContent = 'Sign in';
  }
});
