// Role-aware nav: show only the links the current role may use.
(function () {
  const role = localStorage.getItem('token')
    ? (localStorage.getItem('role') || '')
    : 'guest';

  document.querySelectorAll('#mainNav [data-roles]').forEach((link) => {
    const roles = link.getAttribute('data-roles').split(',');
    if (!roles.includes(role)) link.style.display = 'none';
  });

  document.getElementById('navLogout')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '/login';
  });
})();
