// Presentation only. All record access remains enforced by the server.
(() => {
  const tabs = [...document.querySelectorAll('.sidebar-tab[role="tab"]')];
  const panels = Object.fromEntries(['home','registration','finance','evaluation','personnel'].map(k => [k, document.getElementById('tab-' + k)]));
  const groups = {
    registration: { key: 'adminSubTab', buttons: [...document.querySelectorAll('#tab-registration .reg-subtab')] },
    evaluation: { key: 'evalSubTab', buttons: [...document.querySelectorAll('#tab-evaluation .reg-subtab')] },
    personnel: { key: 'personnelSubTab', buttons: [...document.querySelectorAll('#tab-personnel .reg-subtab')] }
  };
  Object.values(panels).forEach(panel => panel?.setAttribute('role', 'tabpanel'));
  Object.values(groups).forEach(group => group.buttons.forEach(button => document.getElementById('sub-' + button.dataset.sub)?.setAttribute('role', 'tabpanel')));

  function setSelected(buttons, isActive) {
    buttons.forEach(button => {
      const active = isActive(button);
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
  }
  function show(tab, sub, updateHash = true) {
    if (!panels[tab]) return;
    setSelected(tabs, button => button.dataset.tab === tab);
    Object.entries(panels).forEach(([key, panel]) => panel?.classList.toggle('active', key === tab));
    document.getElementById('panelTitle').textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
    sessionStorage.setItem('adminTab', tab);
    const group = groups[tab];
    if (group) {
      const wanted = sub || sessionStorage.getItem(group.key);
      sub = group.buttons.find(button => button.dataset.sub === wanted)?.dataset.sub || group.buttons[0]?.dataset.sub;
      setSelected(group.buttons, button => button.dataset.sub === sub);
      group.buttons.forEach(button => document.getElementById('sub-' + button.dataset.sub)?.classList.toggle('active', button.dataset.sub === sub));
      if (sub) sessionStorage.setItem(group.key, sub);
    }
    if (updateHash) location.hash = tab + (group && sub ? '/' + sub : '');
  }
  function restore() {
    const [requested, sub] = location.hash.replace(/^#/, '').split('/');
    const saved = sessionStorage.getItem('adminTab');
    show(panels[requested] ? requested : panels[saved] ? saved : 'home', sub);
  }
  // Arrow keys move between tabs in a tablist; Home/End jump to the ends.
  function arrowKeys(buttons, activate) {
    buttons.forEach((button, index) => button.addEventListener('keydown', event => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let next;
      if (event.key in keys) next = (index + keys[event.key] + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].focus();
      activate(buttons[next]);
    }));
  }
  tabs.forEach(button => button.addEventListener('click', () => {
    show(button.dataset.tab);
    document.getElementById('sidebar')?.classList.remove('open');
  }));
  arrowKeys(tabs, button => show(button.dataset.tab));
  for (const [tab, group] of Object.entries(groups)) {
    group.buttons.forEach(button => button.addEventListener('click', () => show(tab, button.dataset.sub)));
    arrowKeys(group.buttons, button => show(tab, button.dataset.sub));
  }
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  window.addEventListener('hashchange', restore);
  window.LMSNavigation = { switchTab: tab => show(tab) };
  restore();
})();
