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
};
const HOME = {
  admin: '/admin-dashboard',
  teacher: '/teacher-dashboard',
  student: '/student-dashboard',
  parent: '/parent-dashboard',
};

const IDENT_CONFIG = {
  admin:   { label: 'Email',     type: 'email', placeholder: 'Enter your email',     field: 'email' },
  teacher: { label: 'Email',     type: 'email', placeholder: 'Enter your email',     field: 'email' },
  student: { label: 'Matricule', type: 'text',  placeholder: 'Enter your matricule', field: 'matricule' },
  parent:  { label: 'Phone',     type: 'tel',   placeholder: 'Enter your phone number', field: 'phone' },
};

function updateIdentLabel() {
  const cfg = IDENT_CONFIG[roleSel.value];
  identLabel.firstChild.nodeValue = cfg.label + ' ';
  identInput.type = cfg.type;
  identInput.placeholder = cfg.placeholder;
}
roleSel.addEventListener('change', updateIdentLabel);
updateIdentLabel();

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
      body: JSON.stringify({ [cfg.field]: identifier, password }),
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
    window.location.href = HOME[role];
  } catch (err) {
    msg.textContent = 'Network error — please check your connection.';
    msg.className = 'msg error';
    loginBtn.classList.remove('loading');
    loginBtn.textContent = 'Sign in';
  }
});
