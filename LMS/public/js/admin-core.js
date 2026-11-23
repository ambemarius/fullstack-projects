// Table action buttons: <button data-action="editStudent" data-id="5" [data-arg="…"]>.
// Capture phase so the click does not also select the table row (replaces inline onclick + stopPropagation).
const ADMIN_ACTIONS = new Set(['editSubject', 'deleteSubject', 'acceptSubject', 'inlineEditClass', 'inlineDeleteClass', 'inlineAcceptClass',
  'editAuxiliary', 'deleteAuxiliary', 'acceptAuxiliary', 'setCurrentAY', 'deleteAY', 'toggleStatus',
  'editStudent', 'deleteStudent', 'acceptStudent', 'editTeacher', 'deleteTeacher', 'acceptTeacher']);
document.addEventListener('click', (e) => {
  const button = e.target.closest && e.target.closest('[data-action]');
  if (!button || !ADMIN_ACTIONS.has(button.dataset.action) || button.disabled) return;
  const handler = window[button.dataset.action];
  if (typeof handler !== 'function') return;
  e.stopPropagation();
  const id = Number(button.dataset.id);
  button.dataset.arg !== undefined ? handler(id, button.dataset.arg) : handler(id);
}, true);

(function () {
  const TOKEN = localStorage.getItem('token');
  const ROLE = localStorage.getItem('role');
  if (!TOKEN || ROLE !== 'admin') {
    const currentPath = window.location.pathname;
    if (currentPath === '/admin-dashboard') {
      const welcomeMsg = document.getElementById('welcomeMsg');
      if (welcomeMsg) welcomeMsg.textContent = 'Please sign in again to continue.';
    }
    window.LMS = { ready: false };
    return;
  }

  const lms = {
    ready: true,
    _onReady: [],
    switchTab: null,
    loadStats: null,
    loadPersonnel: null,
    loadTeacherTable: null,
  };
  window.LMS = lms;

  lms.switchTab = window.LMSNavigation.switchTab;

  // ----- Logout -----
  async function doLogout() {
    try { await fetch('/logout', { method: 'POST' }); } catch (_) {}
    for (const key of ['token','role','user']) localStorage.removeItem(key);
    for (const key of ['adminTab','adminSubTab','evalSubTab']) sessionStorage.removeItem(key);
    window.location.href = '/login';
  }
  document.getElementById('sidebarLogout')?.addEventListener('click', doLogout);
  document.getElementById('topLogout')?.addEventListener('click', doLogout);

  // ----- Load profile -----
  const adminInfo = document.getElementById('adminInfo');
  const welcomeMsg = document.getElementById('welcomeMsg');
  async function loadProfile() {
    const { ok, data } = await api('/admin/profile');
    if (ok) {
      const name = data.data.name || data.data.email;
      adminInfo.textContent = name;
      welcomeMsg.innerHTML = `Welcome, <strong>${esc(name)}</strong>!`;
    } else {
      adminInfo.textContent = 'Could not load profile';
    }
  }
  loadProfile();

  // ----- Load stats -----
  async function loadStats() {
    const { ok, data } = await api('/admin/stats');
    if (ok && data.data) {
      document.getElementById('statTeachers').textContent = data.data.teachers ?? 0;
      document.getElementById('statStudents').textContent = data.data.students ?? 0;
      document.getElementById('statSubjects').textContent = data.data.subjects ?? 0;
      document.getElementById('statClasses').textContent = data.data.classes ?? 0;
    }
  }
  lms.loadStats = loadStats;
  loadStats();

})();
