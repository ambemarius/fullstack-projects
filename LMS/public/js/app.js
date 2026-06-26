// Shared frontend helper: auth guard + API wrapper (uses the stored JWT).
const TOKEN = localStorage.getItem('token');
const PROTECTED_PATHS = ['/admin-dashboard', '/teacher-dashboard', '/student-dashboard'];

// Only redirect when the user is on a protected page and has no session.
if (!TOKEN && PROTECTED_PATHS.includes(window.location.pathname)) {
  window.location.replace('/login');
}

// call the JSON API with the bearer token attached
async function api(path, options = {}) {
  const res = await fetch('/api/v1' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + TOKEN,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return { ok: res.ok, status: res.status, data };
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

// wire any element with id="logoutBtn"
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
});

// small helper to escape values before injecting into the table
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
