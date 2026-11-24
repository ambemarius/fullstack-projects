// Student and parent dashboards: side menu of sections (overview, results, attendance, library loans, ...),
// the same layout as the teacher panel. <body data-panel="Parent"> names the panel in the page title. Each section is a link #name; the address keeps the open section.
(function () {
  const links = [...document.querySelectorAll('.tp-link[data-tab]')];
  if (!links.length) return;
  const menuBtn = document.getElementById('tpMenuBtn');
  const overlay = document.getElementById('tpOverlay');

  function closeMenu() {
    document.body.classList.remove('nav-open');
    overlay.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function show(tab, { updateHash = true } = {}) {
    const link = links.find(l => l.dataset.tab === tab) || links[0];
    links.forEach(l => {
      const on = l === link;
      l.classList.toggle('active', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
      const panel = document.getElementById('sp-' + l.dataset.tab);
      if (panel) panel.hidden = !on;
    });
    const label = link.querySelector('span').textContent;
    document.getElementById('tpTitle').textContent = label;
    document.title = `${label} – ${document.body.dataset.panel || 'Student'} – KodoSchool`;
    closeMenu();
    if (updateHash && location.hash !== '#' + link.dataset.tab) history.replaceState(null, '', '#' + link.dataset.tab);
  }

  window.addEventListener('hashchange', () => {
    show(location.hash.slice(1), { updateHash: false });
    window.scrollTo(0, 0);
    document.getElementById('tpContent').focus({ preventScroll: true });
  });

  menuBtn.addEventListener('click', () => {
    const open = !document.body.classList.contains('nav-open');
    document.body.classList.toggle('nav-open', open);
    overlay.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) links.find(l => l.classList.contains('active'))?.focus();
  });
  overlay.addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { closeMenu(); menuBtn.focus(); } });
  document.querySelector('[data-signout]')?.addEventListener('click', () => logout());

  // Name and initials in the top bar.
  window.setStudentName = window.setPanelUser = full => {
    document.getElementById('tpUserName').textContent = full;
    document.getElementById('tpAvatar').textContent = full.split(/\s+/).filter(w => /^[A-Za-zÀ-ÿ]/.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  window.showPanel = tab => { location.hash = tab; };
  show(location.hash.slice(1) || 'overview', { updateHash: false });
})();
