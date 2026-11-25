// Role-aware nav: show only the links the current role may use.
(function () {
  const role = localStorage.getItem('token')
    ? (localStorage.getItem('role') || '')
    : 'guest';

  document.querySelectorAll('#mainNav [data-roles]').forEach((link) => {
    const roles = link.getAttribute('data-roles').split(',');
    if (!roles.includes(role)) link.style.display = 'none';
  });

  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await fetch('/logout', { method: 'POST' }); } catch (_) {}
    for (const key of ['token', 'role', 'user']) localStorage.removeItem(key);
    sessionStorage.clear();
    window.location.href = '/';   // signing out lands on the home page
  });
})();
