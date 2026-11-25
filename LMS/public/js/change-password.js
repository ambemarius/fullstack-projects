// First sign-in: replace the password the administration set with the teacher's own.
(() => {
  const form = document.getElementById('cpForm');
  if (!form) return;
  const msg = document.getElementById('cpMsg'), btn = document.getElementById('cpBtn');
  const tr = s => (window.t ? window.t(s) : s);
  const say = (text, kind) => { msg.textContent = tr(text); msg.className = 'msg' + (kind ? ' ' + kind : ''); };
  let token = null;
  try { token = localStorage.getItem('token'); } catch { /* storage unavailable */ }
  if (!token) { window.location.replace('/login'); return; }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const current = document.getElementById('cpCurrent').value, next = document.getElementById('cpNext').value, again = document.getElementById('cpNext2').value;
    if (!current || !next) return say('Fill in all three boxes.', 'error');
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return say('Choose a password of at least 8 characters with letters and numbers.', 'error');
    if (next !== again) return say('The two new passwords are different.', 'error');
    if (next === current) return say('Choose a password different from the one you were given.', 'error');
    btn.disabled = true;
    try {
      const res = await fetch('/api/v1/teachers/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ current, next }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { btn.disabled = false; return say(data.message || 'Your password could not be changed.', 'error'); }
      say('Password saved. Opening your dashboard…', 'ok');
      setTimeout(() => window.location.replace('/teacher-dashboard'), 900);
    } catch {
      btn.disabled = false;
      say('No connection. Try again.', 'error');
    }
  });
})();
