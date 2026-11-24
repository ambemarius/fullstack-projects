// KodoSchool public site: phone menu.
(() => {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  if (!nav || !burger) return;
  const setOpen = open => {
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); burger.focus(); }
  });
})();
