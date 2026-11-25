// Show / hide password: an eye button inside every <input type="password" data-reveal>.
// The field goes back to hidden when the form is sent, so the password is not left on screen.
(() => {
  const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.2M6.6 6.6A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></svg>';
  const tr = s => (window.t ? window.t(s) : s);

  document.querySelectorAll('input[type="password"][data-reveal]').forEach(input => {
    if (!input.id) input.id = 'pw-' + Math.random().toString(36).slice(2, 8);
    const wrap = document.createElement('span');
    wrap.className = 'pw-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.setAttribute('aria-controls', input.id);
    wrap.appendChild(btn);

    function set(shown) {
      input.type = shown ? 'text' : 'password';
      btn.innerHTML = shown ? EYE_OFF : EYE;
      btn.setAttribute('aria-pressed', String(shown));
      btn.setAttribute('aria-label', tr(shown ? 'Hide password' : 'Show password'));
      btn.title = tr(shown ? 'Hide password' : 'Show password');
    }
    set(false);
    btn.addEventListener('click', () => {
      const pos = input.selectionStart;
      set(input.type === 'password');
      input.focus();
      try { input.setSelectionRange(pos, pos); } catch { /* not supported for this input */ }
    });
    input.form?.addEventListener('submit', () => set(false));
  });
})();
