// School sign-up wizard: 1 school, 2 super administrator, 3 review and send. The server checks everything again.
(() => {
  const form = document.getElementById('signupForm');
  if (!form) return;
  const $ = id => document.getElementById(id);
  const panels = [...form.querySelectorAll('[data-panel]')];
  const stepItems = [...$('steps').children];
  const backBtn = $('backBtn'), nextBtn = $('nextBtn'), msg = $('formMsg');
  const regionSel = $('regionId'), divisionSel = $('divisionId'), fnSel = $('adminFunction');
  let step = 1;
  const DRAFT = 'kodoSchoolSignupDraft';

  const value = name => {
    const el = form.elements[name];
    if (!el) return '';
    if (el instanceof RadioNodeList) return el.value;
    return el.type === 'checkbox' ? el.checked : el.value.trim();
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- errors shown next to the field ----
  function clearErrors() {
    form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    form.querySelectorAll('.err').forEach(el => el.remove());
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    msg.hidden = true;
  }
  function fieldError(name, text) {
    const holder = form.querySelector(`[data-for="${name}"]`);
    if (!holder) { showMessage(text); return; }
    holder.classList.add('invalid');
    const err = document.createElement('span');
    err.className = 'err';
    err.id = 'err-' + name;
    err.textContent = text;
    holder.appendChild(err);
    const input = holder.querySelector('input, select');
    if (input) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', err.id); }
  }
  function showMessage(text) { msg.textContent = text; msg.hidden = false; }
  function focusFirstError() {
    const bad = form.querySelector('.invalid input, .invalid select');
    if (bad) bad.focus();
  }

  // ---- checks per step (the server repeats them) ----
  const phoneOk = v => /^[26]\d{8}$/.test(v.replace(/[\s().-]/g, '').replace(/^(\+?237|00237)/, ''));
  function check(n) {
    const errors = [];
    if (n === 1) {
      if (value('schoolName').length < 3) errors.push(['schoolName', 'Enter the school name.']);
      if (!value('educationSystem')) errors.push(['educationSystem', 'Choose the language system.']);
      if (value('address').length < 3) errors.push(['address', 'Enter the address.']);
      if (!value('regionId')) errors.push(['regionId', 'Choose the region.']);
      if (!value('divisionId')) errors.push(['divisionId', 'Choose the division.']);
    }
    if (n === 2) {
      if (value('adminName').length < 3) errors.push(['adminName', 'Enter the full name.']);
      if (!value('adminFunction')) errors.push(['adminFunction', 'Choose the function.']);
      if (value('adminFunction') === 'Other' && value('adminFunctionOther').length < 2) errors.push(['adminFunctionOther', 'Enter the function.']);
      if (!phoneOk(value('adminPhone'))) errors.push(['adminPhone', 'Enter a Cameroon number, for example 6 77 12 34 56.']);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value('adminEmail'))) errors.push(['adminEmail', 'Enter a valid email address.']);
    }
    if (n === 3) {
      const p = form.elements.password.value;
      if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) errors.push(['password', 'Use at least 8 characters with letters and numbers.']);
      else if (p !== form.elements.password2.value) errors.push(['password2', 'The two passwords are different.']);
      if (!value('acceptTerms')) errors.push(['acceptTerms', 'Tick this box to send the request.']);
    }
    errors.forEach(([name, text]) => fieldError(name, text));
    return errors.length === 0;
  }

  // ---- moving between steps ----
  function show(n) {
    step = n;
    panels.forEach(p => { p.hidden = Number(p.dataset.panel) !== n; });
    stepItems.forEach(li => {
      const s = Number(li.dataset.step);
      li.classList.toggle('done', s < n);
      if (s === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    backBtn.hidden = n === 1;
    nextBtn.textContent = n === 3 ? 'Send for validation' : 'Continue';
    if (n === 3) renderReview();
    const heading = panels[n - 1].querySelector('h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    form.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function selectedText(sel) { return sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text : ''; }
  function renderReview() {
    const fn = value('adminFunction') === 'Other' ? value('adminFunctionOther') : value('adminFunction');
    const rows = pairs => pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    $('review').innerHTML = `
      <section><header><h3>School</h3><button type="button" data-edit="1">Edit</button></header><dl>${rows([
        ['Name', value('schoolName')], ['Language system', value('educationSystem')], ['Address', value('address')],
        ['Region', selectedText(regionSel)], ['Division', selectedText(divisionSel)]])}</dl></section>
      <section><header><h3>Super administrator</h3><button type="button" data-edit="2">Edit</button></header><dl>${rows([
        ['Name', value('adminName')], ['Function', fn], ['Phone', '+237 ' + value('adminPhone')], ['Email', value('adminEmail')]])}</dl></section>`;
  }
  $('review').addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) { clearErrors(); show(Number(b.dataset.edit)); } });
  backBtn.addEventListener('click', () => { clearErrors(); show(step - 1); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();
    if (!check(step)) { focusFirstError(); return; }
    saveDraft();
    if (step < 3) { show(step + 1); return; }
    await send();
  });

  async function send() {
    nextBtn.disabled = true;
    nextBtn.textContent = 'Sending…';
    const body = {
      schoolName: value('schoolName'), educationSystem: value('educationSystem'), address: value('address'),
      regionId: Number(value('regionId')), divisionId: Number(value('divisionId')),
      adminName: value('adminName'), adminFunction: value('adminFunction'), adminFunctionOther: value('adminFunctionOther'),
      adminPhone: value('adminPhone'), adminEmail: value('adminEmail'),
      password: form.elements.password.value, acceptTerms: value('acceptTerms'), website: form.elements.website.value,
    };
    try {
      const res = await fetch('/api/v1/school-signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const where = { schoolName: 1, educationSystem: 1, address: 1, regionId: 1, divisionId: 1, adminName: 2, adminFunction: 2, adminFunctionOther: 2, adminPhone: 2, adminEmail: 2 }[data.field];
        if (where && where !== step) show(where);
        if (data.field) fieldError(data.field, data.message || 'Check this field.'); else showMessage(data.message || 'The request could not be sent. Try again.');
        focusFirstError();
        return;
      }
      try { localStorage.removeItem(DRAFT); } catch { /* storage unavailable */ }
      const d = data.data;
      $('doneSchool').textContent = d.schoolName;
      $('doneRef').textContent = d.reference;
      $('doneCode').textContent = d.schoolCode;
      $('doneEmail').textContent = d.adminEmail;
      form.hidden = true;
      $('done').hidden = false;
      $('done').focus();
    } catch {
      showMessage('No connection. Check your internet and try again; your details are kept.');
    } finally {
      nextBtn.disabled = false;
      nextBtn.textContent = step === 3 ? 'Send for validation' : 'Continue';
    }
  }

  // ---- region -> division ----
  async function loadRegions() {
    try {
      const res = await fetch('/api/v1/school-signup/regions');
      const { data } = await res.json();
      regionSel.innerHTML = '<option value="">Choose…</option>' + data.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    } catch {
      regionSel.innerHTML = '<option value="">Could not load regions: reload the page</option>';
    }
  }
  async function loadDivisions(selected) {
    divisionSel.disabled = true;
    if (!regionSel.value) { divisionSel.innerHTML = '<option value="">Choose the region first</option>'; return; }
    divisionSel.innerHTML = '<option value="">Loading…</option>';
    try {
      const res = await fetch('/api/v1/school-signup/divisions?regionId=' + encodeURIComponent(regionSel.value));
      const { data } = await res.json();
      divisionSel.innerHTML = '<option value="">Choose…</option>' + data.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
      if (selected) divisionSel.value = selected;
      divisionSel.disabled = false;
    } catch {
      divisionSel.innerHTML = '<option value="">Could not load divisions</option>';
    }
  }
  regionSel.addEventListener('change', () => loadDivisions());
  fnSel.addEventListener('change', () => { $('otherFunction').hidden = fnSel.value !== 'Other'; });

  // ---- draft kept on this device (never the password) ----
  const KEPT = ['schoolName', 'educationSystem', 'address', 'regionId', 'divisionId', 'adminName', 'adminFunction', 'adminFunctionOther', 'adminPhone', 'adminEmail'];
  function saveDraft() {
    try { localStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(KEPT.map(k => [k, value(k)])))); } catch { /* storage unavailable */ }
  }
  async function restoreDraft() {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { draft = null; }
    if (!draft) return;
    for (const k of KEPT) {
      if (k === 'regionId' || k === 'divisionId' || draft[k] === undefined) continue;
      const el = form.elements[k];
      if (el instanceof RadioNodeList) { const r = [...el].find(x => x.value === draft[k]); if (r) r.checked = true; } else if (el) el.value = draft[k];
    }
    $('otherFunction').hidden = fnSel.value !== 'Other';
    if (draft.regionId) { regionSel.value = draft.regionId; await loadDivisions(draft.divisionId); }
  }

  loadRegions().then(restoreDraft);
})();
