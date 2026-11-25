// Admin tool pages outside the dashboard (timetable, …): the side menu's open/close button on phones,
// the administrator's name in the top bar, and signing out (to the home page, like the dashboard).
(() => {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('menuToggle')?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') sidebar?.classList.remove('open'); });
  async function signOut() {
    try { await fetch('/logout', { method: 'POST' }); } catch (_) { /* offline: still clear this device */ }
    for (const key of ['token', 'role', 'user']) localStorage.removeItem(key);
    window.location.href = '/';
  }
  document.getElementById('sidebarLogout')?.addEventListener('click', signOut);
  document.getElementById('topLogout')?.addEventListener('click', signOut);
  const info = document.getElementById('adminInfo');
  if (info && typeof api === 'function') {
    api('/admin/profile').then(({ ok, data }) => { if (ok) info.textContent = data.data.name || data.data.email; });
  }
})();
