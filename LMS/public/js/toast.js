// toast.js — lightweight toast notification system
(function () {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  function show(message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    var icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.setAttribute('role', 'alert');
    toast.innerHTML =
      '<span class="toast-icon">' + (icons[type] || '') + '</span>' +
      '<span>' + message + '</span>' +
      '<button class="toast-close" aria-label="Close">&times;</button>';

    toast.querySelector('.toast-close').addEventListener('click', function () { dismiss(toast); });
    container.appendChild(toast);

    var timer = setTimeout(function () { dismiss(toast); }, duration);
    toast._timer = timer;
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
