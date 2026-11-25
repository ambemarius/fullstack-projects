// Notification bell in the top bar of every signed-in page (admin dashboard, portals, staff pages).
// Items come from /api/v1/notifications: announcements, lesson and register reminders, lab requests,
// new marks, absences and fees. The count shows items not yet seen on this device; opening the bell marks
// them as seen. Refreshes every 5 minutes and when the page comes back into view.
(() => {
  let token = null;
  try { token = localStorage.getItem('token'); } catch { /* storage unavailable */ }
  if (!token || location.pathname === '/login') return;
  let claims = {};
  try { claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return; }
  if (!claims.id || claims.accountType === 'platform') return;

  const tr = s => (window.t ? window.t(s) : s);
  const SEEN_KEY = `kodoSeen:${claims.sid || 0}:${claims.accountType}:${claims.id}`;
  const readSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } };
  const writeSeen = set => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-300))); } catch { /* storage unavailable */ } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = {
    announcement: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
    lesson: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    register: '<path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="2"/>',
    lab: '<path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/>',
    mark: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    absence: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    fees: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16" cy="14" r="1.5"/>',
  };

  let items = [];
  const wrap = document.createElement('div');
  wrap.className = 'notify';
  wrap.innerHTML = `
    <button type="button" class="notify-btn" aria-haspopup="true" aria-expanded="false" aria-controls="notifyPanel" aria-label="Notifications">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
      <span class="notify-count" hidden></span>
    </button>
    <div class="notify-panel" id="notifyPanel" role="region" aria-label="Notifications" hidden>
      <div class="notify-head"><h2>Notifications</h2><button type="button" class="notify-close" aria-label="Close">&times;</button></div>
      <ul class="notify-list" aria-live="polite"></ul>
    </div>`;
  const btn = wrap.querySelector('.notify-btn'), panel = wrap.querySelector('.notify-panel');
  const count = wrap.querySelector('.notify-count'), list = wrap.querySelector('.notify-list');

  function place() {
    const spots = [['.tp-topbar .tp-user', 'prepend'], ['.admin-topbar-right', 'prepend'], ['header.topbar', 'append']];
    for (const [selector, where] of spots) {
      const target = document.querySelector(selector);
      if (!target) continue;
      const langSwitch = target.querySelector('.lang-switch');
      if (where === 'prepend') (langSwitch ? langSwitch.after(wrap) : target.prepend(wrap)); else target.append(wrap);
      return true;
    }
    return false;
  }

  function when(at) {
    if (!at) return '';
    const d = new Date(at.length === 10 ? at + 'T00:00:00' : at);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 864e5);
    const fr = window.KodoI18n && window.KodoI18n.lang === 'fr';
    if (diff === 0) return at.length > 10 ? d.toLocaleTimeString(fr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : tr('Today');
    if (diff === 1) return tr('Yesterday');
    return d.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
  }

  function render() {
    const seen = readSeen();
    const unseen = items.filter(i => !seen.has(i.id)).length;
    count.hidden = !unseen;
    count.textContent = unseen > 9 ? '9+' : String(unseen);
    btn.classList.toggle('has-warn', items.some(i => i.level === 'warn' && !seen.has(i.id)));
    btn.setAttribute('aria-label', unseen ? `${tr('Notifications')} (${unseen})` : tr('Notifications'));
    list.innerHTML = items.length ? items.map(i => {
      const inner = `<span class="notify-ic notify-${esc(i.kind)}${i.level === 'warn' ? ' is-warn' : ''}" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[i.kind] || ICON.announcement}</svg></span>
        <span class="notify-txt"><b>${esc(i.title)}</b>${i.detail ? `<small>${esc(i.detail)}</small>` : ''}</span><time>${esc(when(i.at))}</time>`;
      return `<li class="${seen.has(i.id) ? '' : 'is-new'}">${i.link ? `<a href="${esc(i.link)}">${inner}</a>` : `<div>${inner}</div>`}</li>`;
    }).join('') : `<li class="notify-empty">${esc(tr('No notifications right now.'))}</li>`;
  }

  async function load() {
    try {
      const res = await fetch('/api/v1/notifications', { headers: { Authorization: 'Bearer ' + token }, credentials: 'same-origin' });
      if (!res.ok) return;
      items = (await res.json()).data.items || [];
      render();
    } catch { /* offline: keep what is shown */ }
  }

  function open(show) {
    panel.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
    if (show) {
      render();
      const seen = readSeen();
      items.forEach(i => seen.add(i.id));
      writeSeen(seen);
      count.hidden = true;
      btn.classList.remove('has-warn');
    }
  }
  btn.addEventListener('click', () => open(panel.hidden));
  wrap.querySelector('.notify-close').addEventListener('click', () => { open(false); btn.focus(); });
  document.addEventListener('click', e => { if (!panel.hidden && !wrap.contains(e.target)) open(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  document.addEventListener('kodo:lang', render);

  function start() {
    if (!place()) return;
    load();
    setInterval(load, 5 * 60 * 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
