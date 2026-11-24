// KodoSchool platform console: sign-in, schools and their activity, sign-up validation, activity log, password.
// The platform token is kept apart from school sign-ins (localStorage "platformToken", sent as a bearer token).
(() => {
  const KEY = 'platformToken';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = d => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const ago = d => {
    if (!d) return '<span class="muted">No activity yet</span>';
    const days = Math.floor((Date.now() - new Date(d)) / 864e5);
    const label = days < 1 ? 'Today' : days === 1 ? 'Yesterday' : days < 30 ? `${days} days ago` : new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `<span title="${esc(when(d))}"${days > 30 ? ' class="pc-stale"' : ''}>${label}</span>`;
  };
  const token = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const setToken = t => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

  async function call(path, options = {}) {
    const t = token();
    const res = await fetch('/api/v1/platform' + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith('/login')) { setToken(null); window.location.href = '/platform/login'; }
    return { ok: res.ok, status: res.status, data };
  }

  // ---------------------------------------------------------------- sign-in page
  const loginForm = $('pcLoginForm');
  if (loginForm) {
    if (token()) window.location.href = '/platform';
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('pcLoginMsg');
      msg.textContent = ''; msg.className = 'msg';
      const res = await call('/login', { method: 'POST', body: JSON.stringify({ email: $('pcEmail').value, password: $('pcPassword').value }) });
      if (!res.ok) { msg.textContent = res.data.message || 'Could not sign in.'; msg.className = 'msg error'; return; }
      setToken(res.data.data.token);
      window.location.href = '/platform';
    });
    return;
  }

  // ---------------------------------------------------------------- console
  if (!$('pcSchools')) return;
  if (!token()) { window.location.href = '/platform/login'; return; }
  const msg = $('pcMsg');
  const say = (text, kind) => { msg.textContent = text; msg.className = 'msg' + (kind ? ' ' + kind : ''); };
  $('pcSignOut').addEventListener('click', () => { setToken(null); window.location.href = '/platform/login'; });

  const tabs = [...document.querySelectorAll('.pc-tabs [data-tab]')];
  const loaders = { schools: loadSchools, signups: loadSignups, audit: loadAudit, account: () => {} };
  function showTab(name) {
    if (!loaders[name]) name = 'schools';
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    document.querySelectorAll('.pc-panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
    say('');
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    loaders[name]();
  }
  tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

  // ---- schools ----
  async function loadSchools() {
    const res = await call('/schools');
    if (!res.ok) return say(res.data.message || 'Could not load the schools.', 'error');
    const { schools, totals } = res.data.data;
    $('pcTotals').innerHTML = [['Schools', totals.schools], ['Active', totals.active], ['Students', totals.students], ['Teachers', totals.teachers], ['Sign-ups waiting', totals.pendingSignups]]
      .map(([k, v]) => `<div><b>${Number(v).toLocaleString('en-US')}</b><span>${k}</span></div>`).join('');
    const pending = $('pcPending');
    pending.hidden = !totals.pendingSignups; pending.textContent = totals.pendingSignups;
    $('pcSchools').innerHTML = schools.length ? schools.map(s => `<tr>
      <td><b>${esc(s.name)}</b><br><small class="muted"><code>${esc(s.code)}</code> · ${esc(s.education_system)} · since ${esc(new Date(s.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }))}</small></td>
      <td><span class="ps-badge pc-${esc(s.status)}">${esc(s.status[0].toUpperCase() + s.status.slice(1))}</span></td>
      <td class="n">${s.students}</td><td class="n">${s.teachers}</td><td class="n">${s.classes}</td>
      <td class="n">${s.marks_30d}</td><td class="n">${s.registers_30d}</td><td class="n">${s.payments_30d}</td>
      <td>${ago(s.last_activity)}</td>
      <td>${s.status === 'active' ? `<button type="button" class="btn btn-secondary btn-sm" data-suspend="${s.id}" data-name="${esc(s.name)}">Suspend</button>`
        : s.status === 'suspended' ? `<button type="button" class="btn btn-sm" data-reactivate="${s.id}" data-name="${esc(s.name)}">Reactivate</button>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="10" class="muted">No schools yet.</td></tr>';
  }
  $('pcSchools').addEventListener('click', async e => {
    const s = e.target.closest('[data-suspend]'), r = e.target.closest('[data-reactivate]');
    if (!s && !r) return;
    const name = (s || r).dataset.name;
    let body;
    if (s) {
      const reason = window.prompt(`Suspend ${name}? Its staff, parents and students will no longer be able to sign in.\n\nReason (kept in the activity log):`);
      if (reason === null) return;
      body = { status: 'suspended', reason };
    } else {
      if (!window.confirm(`Reactivate ${name}? Its accounts can sign in again.`)) return;
      body = { status: 'active' };
    }
    const res = await call(`/schools/${(s || r).dataset[s ? 'suspend' : 'reactivate']}/status`, { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) return say(res.data.message || 'Could not change the school.', 'error');
    say(`${name} is now ${res.data.data.status}.`, 'ok');
    loadSchools();
  });

  // ---- sign-ups ----
  let signupStatus = 'pending', isolationReady = false;
  const statusTabs = [...document.querySelectorAll('.ps-tabs [data-status]')];
  function signupCard(r) {
    const badge = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' }[r.status];
    const review = r.status === 'pending' ? '' : `<p class="ps-review">${badge} ${esc(when(r.reviewed_at))}${r.reviewed_by_name ? ' by ' + esc(r.reviewed_by_name) : ''}${r.review_note ? ': ' + esc(r.review_note) : ''}</p>`;
    const actions = r.status !== 'pending' ? '' : `
      <div class="ps-actions">
        <button type="button" class="btn" data-approve="${r.id}"${isolationReady ? '' : ' disabled title="Paused until row-level security is on"'}>Approve and create the school</button>
        <details class="ps-reject"><summary class="btn btn-secondary">Reject…</summary>
          <form data-reject="${r.id}"><label>Reason (kept with the request)<textarea name="note" required minlength="3" maxlength="500" rows="2"></textarea></label>
          <button type="submit" class="btn btn-danger">Reject request</button></form></details>
      </div>`;
    return `<article class="ps-card">
      <header><div><h2>${esc(r.school_name)}</h2><p class="muted">${esc(r.reference)} · sent ${esc(when(r.created_at))}</p></div><span class="ps-badge ps-${r.status}">${badge}</span></header>
      <div class="ps-cols">
        <dl><dt>Language system</dt><dd>${esc(r.education_system)}</dd><dt>Address</dt><dd>${esc(r.address)}</dd>
            <dt>Region / division</dt><dd>${esc(r.region)} / ${esc(r.division)}</dd><dt>School code</dt><dd><code>${esc(r.proposed_code)}</code></dd></dl>
        <dl><dt>Super administrator</dt><dd>${esc(r.admin_name)}</dd><dt>Function</dt><dd>${esc(r.admin_function)}</dd>
            <dt>Phone</dt><dd><a href="tel:${esc(r.admin_phone)}">${esc(r.admin_phone)}</a></dd><dt>Email</dt><dd><a href="mailto:${esc(r.admin_email)}">${esc(r.admin_email)}</a></dd></dl>
      </div>${review}${actions}</article>`;
  }
  async function loadSignups() {
    $('psList').innerHTML = '<p class="muted">Loading…</p>';
    const res = await call('/signups?status=' + encodeURIComponent(signupStatus));
    if (!res.ok) { $('psList').innerHTML = ''; return say(res.data.message || 'Could not load the sign-ups.', 'error'); }
    const d = res.data.data;
    isolationReady = d.isolationReady;
    $('isolationNotice').hidden = isolationReady;
    for (const [k, n] of Object.entries(d.counts)) { const el = document.querySelector(`[data-count="${k}"]`); if (el) el.textContent = n; }
    $('psList').innerHTML = d.requests.length ? d.requests.map(signupCard).join('')
      : `<div class="empty-state"><h3>No ${signupStatus === 'pending' ? 'sign-ups waiting' : signupStatus === 'all' ? 'sign-ups yet' : signupStatus + ' sign-ups'}</h3><p>Schools that register on the public site appear here.</p></div>`;
  }
  statusTabs.forEach(t => t.addEventListener('click', () => {
    signupStatus = t.dataset.status;
    statusTabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
    loadSignups();
  }));
  $('psList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-approve]');
    if (!btn) return;
    const name = btn.closest('.ps-card').querySelector('h2').textContent;
    if (!window.confirm(`Create ${name} and its super administrator now?`)) return;
    btn.disabled = true;
    const res = await call(`/signups/${btn.dataset.approve}/approve`, { method: 'POST' });
    if (!res.ok) { btn.disabled = false; return say(res.data.message || 'Could not approve.', 'error'); }
    say(`${name} is active. School code ${res.data.data.schoolCode}; the super administrator signs in with ${res.data.data.adminEmail}.`, 'ok');
    loadSignups();
  });
  $('psList').addEventListener('submit', async e => {
    const form = e.target.closest('[data-reject]');
    if (!form) return;
    e.preventDefault();
    const res = await call(`/signups/${form.dataset.reject}/reject`, { method: 'POST', body: JSON.stringify({ note: form.elements.note.value }) });
    if (!res.ok) return say(res.data.message || 'Could not reject.', 'error');
    say('Request rejected.', 'ok');
    loadSignups();
  });

  // ---- activity log ----
  const ACTIONS = { signed_in: 'Signed in', password_changed: 'Changed password', school_suspended: 'Suspended a school', school_reactivated: 'Reactivated a school', signup_approved: 'Approved a sign-up', signup_rejected: 'Rejected a sign-up' };
  async function loadAudit() {
    const res = await call('/audit');
    if (!res.ok) return say(res.data.message || 'Could not load the activity log.', 'error');
    const rows = res.data.data;
    $('pcAudit').innerHTML = rows.length ? rows.map(r => `<tr><td>${esc(when(r.created_at))}</td><td>${esc(r.by_name || '')}</td>
      <td>${esc(ACTIONS[r.action] || r.action)}</td><td>${esc(r.school_name || (r.target_type ? `${r.target_type} ${r.target_id}` : ''))}</td><td>${esc(r.detail || '')}</td></tr>`).join('')
      : '<tr><td colspan="5" class="muted">Nothing yet.</td></tr>';
  }

  // ---- account ----
  $('pcPasswordForm').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('pcNext').value !== $('pcNext2').value) return say('The two new passwords are different.', 'error');
    const res = await call('/password', { method: 'PUT', body: JSON.stringify({ current: $('pcCurrent').value, next: $('pcNext').value }) });
    if (!res.ok) return say(res.data.message || 'Could not change the password.', 'error');
    e.target.reset();
    say('Password changed.', 'ok');
  });

  // ---- start ----
  call('/me').then(res => {
    if (!res.ok) return;
    $('pcWho').textContent = res.data.data.name;
    $('main').hidden = false;
    showTab(location.hash.slice(1) || 'schools');
  });
})();
