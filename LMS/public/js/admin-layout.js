(function () {
  const TOKEN = localStorage.getItem('token');
  const ROLE = localStorage.getItem('role');
  if (!TOKEN || ROLE !== 'admin') {
    const currentPath = window.location.pathname;
    if (currentPath === '/admin-dashboard') {
      const welcomeMsg = document.getElementById('welcomeMsg');
      if (welcomeMsg) welcomeMsg.textContent = 'Please sign in again to continue.';
    }
    return;
  }

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

  tabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ----- Sidebar collapse on mobile -----
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.querySelectorAll('.sidebar-tab').forEach(t => t.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  }));

  // ===== REGISTRATION: SUB-TAB SWITCHING =====
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

  // ===== STUDENT: Load classes dropdown =====
  // (Student, teacher, subject, class, auxiliary, academic year, evaluation,
  //  and personnel logic has moved to dedicated modules:
  //  admin-core.js, admin-students.js, admin-teachers.js,
  //  admin-registration.js, admin-evaluation.js)

  // ----- Restore tab from sessionStorage on page load -----
  function activateFromStorage() {
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
  }

  function gradeFromScore(score, maxScore) {
    if (score === null || score === undefined || maxScore === 0) return 'F';
    const pct = (score / maxScore) * 100;
    if (pct >= 91) return 'A';
    if (pct >= 81) return 'B';
    if (pct >= 71) return 'C';
    if (pct >= 61) return 'D';
    if (pct >= 51) return 'E';
    return 'F';
  }

// ===== EVALUATION: SUB-TAB SWITCHING =====
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
  activateFromStorage();
  // ===== EVALUATION: SHARED LOADERS =====
})();
