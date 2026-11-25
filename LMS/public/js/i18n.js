// English / French. The pages are written in English; in French, known text is swapped for its translation
// (window.KODO_FR, window.KODO_FR_PATTERNS) and swapped back when the visitor returns to English.
// Text added later by scripts (lists, the notification bell, messages) is translated as it appears.
// The choice is remembered on the device (localStorage "lang"). window.t(text) translates text in scripts.
(() => {
  const KEY = 'lang';
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'svg']);
  let lang = 'en';
  try { lang = localStorage.getItem(KEY) === 'fr' ? 'fr' : 'en'; } catch { /* storage unavailable */ }
  // A link can choose the language: ?lang=fr or ?lang=en (then remembered like the switch).
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked === 'fr' || asked === 'en') lang = asked;

  const original = new WeakMap();      // text node -> English text
  const originalAttr = new WeakMap();  // element -> { attribute: English value }
  const written = new WeakMap();      // text node -> the value this script last wrote
  const writtenAttr = new WeakMap();  // element -> { attribute: value this script last wrote }
  let applying = false;

  function translateText(text) {
    if (lang !== 'fr' || !text) return text;
    const dict = window.KODO_FR || {};
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
    const core = text.trim().replace(/\s+/g, ' ');
    if (!core) return text;
    if (Object.prototype.hasOwnProperty.call(dict, core)) return lead + dict[core] + trail;
    for (const [re, to] of window.KODO_FR_PATTERNS || []) {
      if (re.test(core)) return lead + core.replace(re, to) + trail;
    }
    return text;
  }
  window.t = translateText;

  function skipped(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (SKIP.has(n.nodeName) || n.hasAttribute('data-no-translate')) return true;
    }
    return false;
  }

  function apply(root) {
    if (!root) return;
    applying = true;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
      if (root.nodeType === 3) nodes.push(root);
      for (const node of nodes) {
        if (!node.parentElement || skipped(node.parentElement)) continue;
        if (!original.has(node)) original.set(node, node.nodeValue);
        const en = original.get(node);
        const next = lang === 'fr' ? translateText(en) : en;
        if (node.nodeValue !== next) node.nodeValue = next;
        written.set(node, next);
      }
      const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll('[placeholder],[aria-label],[title],[alt]')] : [];
      for (const el of elements) {
        if (skipped(el)) continue;
        for (const attr of ATTRS) {
          if (!el.hasAttribute(attr)) continue;
          const store = originalAttr.get(el) || {};
          if (!(attr in store)) { store[attr] = el.getAttribute(attr); originalAttr.set(el, store); }
          const next = lang === 'fr' ? translateText(store[attr]) : store[attr];
          if (el.getAttribute(attr) !== next) el.setAttribute(attr, next);
          (writtenAttr.get(el) || writtenAttr.set(el, {}).get(el))[attr] = next;
        }
      }
      if (root === document.body) {
        if (!original.has(document)) original.set(document, document.title);
        document.title = lang === 'fr' ? translateText(original.get(document)) : original.get(document);
      }
    } finally {
      applying = false;
    }
  }

  // Scripts change the page after it loads: translate what they add (and forget text they replace).
  const observer = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'characterData') {
        if (written.get(r.target) === r.target.nodeValue) continue;   // our own change
        original.delete(r.target);
        if (lang === 'fr') apply(r.target);
      }
      else if (r.type === 'attributes') {
        if ((writtenAttr.get(r.target) || {})[r.attributeName] === r.target.getAttribute(r.attributeName)) continue;   // our own change
        const store = originalAttr.get(r.target);
        if (store) { delete store[r.attributeName]; if (lang === 'fr') apply(r.target); }
      } else for (const n of r.addedNodes) if (lang === 'fr' && (n.nodeType === 1 || n.nodeType === 3)) apply(n);
    }
  });

  function setLang(next) {
    lang = next === 'fr' ? 'fr' : 'en';
    try { localStorage.setItem(KEY, lang); } catch { /* storage unavailable */ }
    document.documentElement.lang = lang;
    apply(document.body);
    document.querySelectorAll('.lang-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.dispatchEvent(new CustomEvent('kodo:lang', { detail: { lang } }));
  }
  window.KodoI18n = { setLang, get lang() { return lang; }, apply };

  // The EN | FR switch, placed in each page's top bar.
  function switchMarkup() {
    const box = document.createElement('div');
    box.className = 'lang-switch';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language');
    box.setAttribute('data-no-translate', '');
    box.innerHTML = '<button type="button" data-lang="en" lang="en" title="English">EN</button><button type="button" data-lang="fr" lang="fr" title="Français">FR</button>';
    box.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
    return box;
  }
  function placeSwitch() {
    const spots = [
      ['.nav-ctas', 'prepend'],            // public site, desktop
      ['.nav .burger', 'before'],          // public site, phone (beside the menu button)
      ['.tp-topbar .tp-user', 'prepend'],  // teacher, student and parent portals
      ['.admin-topbar-right', 'prepend'],  // admin dashboard
      ['header.topbar', 'append'],         // older pages and sign-in
    ];
    for (const [selector, where] of spots) {
      const target = document.querySelector(selector);
      if (!target) continue;
      const el = switchMarkup();
      if (selector === '.nav .burger') el.classList.add('lang-switch-mobile');
      if (where === 'prepend') target.prepend(el); else if (where === 'before') target.before(el); else target.append(el);
    }
  }

  function start() {
    placeSwitch();
    setLang(lang);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
