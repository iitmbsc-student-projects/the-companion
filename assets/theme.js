/* The Companion: colour theme switcher (Current / Light / Dark), remembered in localStorage */
(function () {
  'use strict';
  var KEY = 'companion-theme', NAMES = { current: 'Current', light: 'Light', dark: 'Dark' };
  function saved() { try { var t = localStorage.getItem(KEY); return NAMES[t] ? t : 'current'; } catch (e) { return 'current'; } }
  function apply(t) {
    if (t === 'current') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('.theme-switch button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.themeSet === t ? 'true' : 'false');
    });
  }
  var box = document.createElement('div');
  box.className = 'theme-switch';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Colour theme');
  Object.keys(NAMES).forEach(function (k) {
    var b = document.createElement('button');
    b.type = 'button'; b.dataset.themeSet = k;
    b.title = NAMES[k] + ' theme'; b.setAttribute('aria-label', NAMES[k] + ' theme');
    b.addEventListener('click', function () {
      try { localStorage.setItem(KEY, k); } catch (e) {}
      apply(k);
    });
    box.appendChild(b);
  });
  // Where the switcher lives:
  //  - top bar (wide screens) / floating bottom-left (phones: no room, and the bar's backdrop-filter would trap a fixed child)
  //  - course pages: inside the sidebar, or floating top-right while the sidebar is hidden
  var slot = document.getElementById('theme-slot');
  var narrow = window.matchMedia('(max-width: 640px)');
  function place() {
    var inSlot = slot && !(slot.hasAttribute('data-float-narrow') && narrow.matches) &&
      !(slot.dataset.collapsible === 'sidebar' && document.body.classList.contains('sidebar-collapsed'));
    if (inSlot) { box.classList.remove('floating'); slot.appendChild(box); }
    else { box.classList.add('floating'); document.body.appendChild(box); }
  }
  place();
  if (narrow.addEventListener) narrow.addEventListener('change', place);
  if (slot && slot.dataset.collapsible === 'sidebar') {
    new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  apply(saved());
})();
