// Shared frontend helper: auth guard + API wrapper (uses the stored JWT).
const PROTECTED_PATHS = [
  '/admin-dashboard', '/teacher-dashboard', '/student-dashboard', '/parent-dashboard', '/staff-dashboard', '/attendance',
  '/timetable', '/timetable-teacher', '/timetable-student', '/promotion',
  '/teachers', '/students', '/subjects', '/allocations',
];

function getToken() {
  return localStorage.getItem('token');
}

function tokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch (_) {
    return false;
  }
}

function clearSession() {
  for (const key of ['token', 'role', 'user']) localStorage.removeItem(key);
}

function endSession(reason) {
  clearSession();
  window.location.replace('/login' + (reason ? '?reason=' + encodeURIComponent(reason) : ''));
}

(function guard() {
  const token = getToken();
  if (!PROTECTED_PATHS.includes(window.location.pathname)) return;
  if (!token) return window.location.replace('/login');
  if (tokenExpired(token)) endSession('expired');
})();

// call the JSON API with the bearer token attached
async function api(path, options = {}) {
  const token = getToken();
  if (token && tokenExpired(token)) { endSession('expired'); return { ok: false, status: 401, data: {} }; }
  const res = await fetch('/api/v1' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) endSession('expired');
  return { ok: res.ok, status: res.status, data };
}

// Print buttons: <button data-print> (no inline handlers; the CSP forbids them).
document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('[data-print]')) window.print();
});

async function logout() {
  try { await fetch('/logout', { method: 'POST' }); } catch (_) {}
  clearSession();
  sessionStorage.clear();
  window.location.href = '/login';
}

// wire any element with id="logoutBtn" (the header's navLogout is handled by nav.js)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
});

// small helper to escape values before injecting into the table
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Render a professional profile card into `el`.
// fields: [{ label, value, href?, html? }]  — html:true means value is trusted markup (badges)
function renderProfileCard(el, { name, subtitle, fields }) {
  const initials = (name || '?')
    .split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const rows = fields.map(f => {
    let value;
    if (f.html) value = `<span class="field-value">${f.value}</span>`;
    else if (f.href) value = `<a class="field-value link" href="${esc(f.href)}">${esc(f.value)}</a>`;
    else value = `<span class="field-value">${esc(f.value)}</span>`;
    return `<div class="field"><span class="field-label">${esc(f.label)}</span>${value}</div>`;
  }).join('');

  el.innerHTML = `
    <div class="profile-card">
      <div class="profile-top">
        <div class="avatar">${esc(initials)}</div>
        <div>
          <h2 class="profile-name">${esc(name)}</h2>
          <p class="profile-sub">${esc(subtitle)}</p>
        </div>
      </div>
      <div class="profile-grid">${rows}</div>
    </div>`;
}
