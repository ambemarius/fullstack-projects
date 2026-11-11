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

  // ----- Tab switching -----
  const tabs = document.querySelectorAll('.sidebar-tab');
  const panels = {
    home: document.getElementById('tab-home'),
    registration: document.getElementById('tab-registration'),
    finance: document.getElementById('tab-finance'),
    evaluation: document.getElementById('tab-evaluation'),
    personnel: document.getElementById('tab-personnel'),
  };
  const panelTitle = document.getElementById('panelTitle');

  function switchTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    Object.keys(panels).forEach(k => panels[k].classList.toggle('active', k === tabName));
    panelTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    location.hash = tabName;
    sessionStorage.setItem('adminTab', tabName);
  }
  lms.switchTab = switchTab;

  tabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ----- Sidebar collapse on mobile -----
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.querySelectorAll('.sidebar-tab').forEach(t => t.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  }));

  // ----- Logout -----
  function doLogout() { localStorage.clear(); sessionStorage.clear(); window.location.href = '/login'; }
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

  // ----- Registration sub-tab switching -----
  const regSubtabs = document.querySelectorAll('#tab-registration .reg-subtab');
  const regSubpanels = {
    student: document.getElementById('sub-student'),
    teacher: document.getElementById('sub-teacher'),
    subject: document.getElementById('sub-subject'),
    classes: document.getElementById('sub-classes'),
    auxiliary: document.getElementById('sub-auxiliary'),
    'academic-years': document.getElementById('sub-academic-years'),
  };

  regSubtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      regSubtabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.keys(regSubpanels).forEach(k => regSubpanels[k].classList.toggle('active', k === btn.dataset.sub));
      location.hash = 'registration/' + btn.dataset.sub;
      sessionStorage.setItem('adminTab', 'registration');
      sessionStorage.setItem('adminSubTab', btn.dataset.sub);
    });
  });

  // ----- Evaluation sub-tab switching -----
  const evalSubtabs = document.querySelectorAll('#tab-evaluation .reg-subtab');
  const evalSubpanels = {
    marks: document.getElementById('sub-marks'),
    'course-review': document.getElementById('sub-course-review'),
    'report-cards': document.getElementById('sub-report-cards'),
  };

  evalSubtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      evalSubtabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.keys(evalSubpanels).forEach(k => evalSubpanels[k].classList.toggle('active', k === btn.dataset.sub));
      sessionStorage.setItem('evalSubTab', btn.dataset.sub);
      sessionStorage.setItem('adminTab', 'evaluation');
      location.hash = 'evaluation/' + btn.dataset.sub;
    });
  });

  // ----- Restore tab from sessionStorage -----
  lms.activateFromStorage = function () {
    const tab = sessionStorage.getItem('adminTab') || 'home';
    if (panels[tab]) switchTab(tab);
    if (tab === 'registration') {
      const sub = sessionStorage.getItem('adminSubTab');
      if (sub) {
        const subBtn = [...regSubtabs].find(button => button.dataset.sub === sub);
        if (subBtn) subBtn.click();
      }
    }
    if (tab === 'evaluation') {
      const sub = sessionStorage.getItem('evalSubTab');
      if (sub) {
        const subBtn = [...evalSubtabs].find(button => button.dataset.sub === sub);
        if (subBtn) subBtn.click();
      }
    }
  };
})();
