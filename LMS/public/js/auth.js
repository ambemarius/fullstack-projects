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

// School code: from a school's own link (?school=CODE), else the one last used on this device.
const schoolInput = document.getElementById('schoolCode');
if (schoolInput) {
  let remembered = '';
  try { remembered = localStorage.getItem('schoolCode') || ''; } catch { /* storage unavailable */ }
  schoolInput.value = new URLSearchParams(window.location.search).get('school') || remembered;
}

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

  loginBtn.classList.add('loading');
  loginBtn.textContent = 'Signing in';

  try {
    const res = await fetch(ENDPOINT[role], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [cfg.field]: identifier, password, schoolCode: schoolInput ? schoolInput.value.trim() : '' }),
    });
    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.message || 'Invalid credentials. Please try again.';
      msg.className = 'msg error';
      loginBtn.classList.remove('loading');
      loginBtn.textContent = 'Sign in';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.data));
    localStorage.setItem('role', role);
    try { if (schoolInput && schoolInput.value.trim()) localStorage.setItem('schoolCode', schoolInput.value.trim().toUpperCase()); } catch { /* storage unavailable */ }
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
