// toast.js — lightweight toast notification system
(function () {
  function container() {
    let el = document.querySelector('.toast-container');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  }

  function inferType(message) {
    if (/fail|error|invalid|cannot|unable|denied|not found|required|too |wrong|expired|missing/i.test(message)) return 'error';
    if (/success|saved|added|updated|deleted|removed|created|sent|done|linked|generated|published/i.test(message)) return 'success';
    return 'info';
  }

  function show(message, type, duration) {
    message = String(message == null ? '' : message);
    type = type || inferType(message);
    duration = duration || (type === 'error' ? 6000 : 4000);
    var icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = icons[type] || '';
    var text = document.createElement('span');
    text.textContent = message;
    var close = document.createElement('button');
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '&times;';
    close.addEventListener('click', function () { dismiss(toast); });
    toast.append(icon, text, close);
    container().appendChild(toast);

    toast._timer = setTimeout(function () { dismiss(toast); }, duration);
    return toast;
  }

  function dismiss(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.add('removing');
    setTimeout(function () { toast.remove(); }, 300);
  }

  window.toast = show;
})();
