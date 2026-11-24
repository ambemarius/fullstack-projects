// Shows the signed-in account's school (name, and code where asked) in page headings:
// <span data-school-name>, <span data-school-code>. The school comes from the sign-in token on the server.
(() => {
  const names = document.querySelectorAll('[data-school-name]');
  const codes = document.querySelectorAll('[data-school-code]');
  if (!names.length && !codes.length) return;
  let token = null;
  try { token = localStorage.getItem('token'); } catch { /* storage unavailable */ }
  fetch('/api/v1/schools/mine', { headers: token ? { Authorization: 'Bearer ' + token } : {}, credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : null))
    .then(body => {
      if (!body || !body.data) return;
      names.forEach(el => { el.textContent = body.data.name; });
      codes.forEach(el => { el.textContent = body.data.code; el.closest('[data-school-code-row]')?.removeAttribute('hidden'); });
    })
    .catch(() => {});
})();
