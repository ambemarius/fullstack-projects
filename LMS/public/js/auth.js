// Role-aware login: posts to the correct endpoint for admin / teacher / student.
const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');
const roleSel = document.getElementById('role');
const identInput = document.getElementById('identifier');
const identLabel = document.getElementById('identLabel');

const ENDPOINT = {
  admin: '/api/v1/admin/login',
  teacher: '/api/v1/teachers/login',
  student: '/api/v1/students/login',
};
const HOME = {
  admin: '/admin-dashboard',
  teacher: '/teacher-dashboard',
  student: '/student-dashboard',
};

// students log in with a matricule, everyone else with an email
function updateIdentLabel() {
  const isStudent = roleSel.value === 'student';
  identLabel.firstChild.nodeValue = isStudent ? 'Matricule ' : 'Email ';
  identInput.type = isStudent ? 'text' : 'email';
}
roleSel.addEventListener('change', updateIdentLabel);
updateIdentLabel();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  msg.className = 'msg';

  const role = roleSel.value;
  const identifier = identInput.value.trim();
  const password = document.getElementById('password').value;
  const body = role === 'student'
    ? { matricule: identifier, password }
    : { email: identifier, password };

  try {
    const res = await fetch(ENDPOINT[role], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.message || 'Login failed';
      msg.className = 'msg error';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.data));
    localStorage.setItem('role', role);
    window.location.href = HOME[role];
  } catch (err) {
    msg.textContent = 'Network error — is the server running?';
    msg.className = 'msg error';
  }
});
