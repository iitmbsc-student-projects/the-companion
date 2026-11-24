/* The Companion: colour theme switcher (Paper / Light / Dark / Pink / Sky), remembered in localStorage */
(function () {
  'use strict';
  var KEY = 'companion-theme', NAMES = { current: 'Paper', light: 'Light', dark: 'Dark', pink: 'Pink', sky: 'Blue' };
  function saved() { try { var t = localStorage.getItem(KEY); return NAMES[t] ? t : 'current'; } catch (e) { return 'current'; } }
  function apply(t) {
    if (t === 'current') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    menu.setAttribute('data-cur', t);
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
    b.innerHTML = '<i class="sw"></i><span class="lb">' + NAMES[k] + '</span>';
    box.appendChild(b);
  });
  // In the top bar the five swatches live behind one small button, so the bar stays a single quiet row.
  var menu = document.createElement('div');
  menu.className = 'tm';
  var tbtn = document.createElement('button');
  tbtn.type = 'button'; tbtn.className = 'tm-btn';
  tbtn.setAttribute('aria-haspopup', 'true'); tbtn.setAttribute('aria-expanded', 'false');
  tbtn.setAttribute('aria-controls', 'tm-pop'); tbtn.setAttribute('aria-label', 'Colour theme'); tbtn.title = 'Colour theme';
  tbtn.innerHTML = '<i class="tm-sw"></i>';
  var pop = document.createElement('div');
  pop.className = 'tm-pop'; pop.id = 'tm-pop';
  menu.appendChild(tbtn); menu.appendChild(pop);
  function setMenu(open) { menu.classList.toggle('open', open); tbtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  tbtn.addEventListener('click', function (e) { e.stopPropagation(); setMenu(!menu.classList.contains('open')); });
  pop.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('click', function (e) { if (!menu.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); tbtn.focus(); }
  });

  // Where the switcher lives:
  //  - top bar (wide screens) / floating bottom-left (phones: no room, and the bar's backdrop-filter would trap a fixed child)
  //  - course pages: inside the sidebar, or floating top-right while the sidebar is hidden
  //  - phones: in the page footer (#theme-foot), so it never covers content
  var slot = document.getElementById('theme-slot');
  var foot = document.getElementById('theme-foot');
  var narrow = window.matchMedia('(max-width: 760px)');
  var shell = document.createElement('aside');   // a floating switcher still sits inside a landmark
  shell.className = 'theme-float'; shell.setAttribute('aria-label', 'Colour theme');
  function place() {
    var inSlot = slot && !(slot.hasAttribute('data-float-narrow') && narrow.matches) &&
      !(slot.dataset.collapsible === 'sidebar' && document.body.classList.contains('sidebar-collapsed'));
    var inBar = inSlot && slot.hasAttribute('data-float-narrow');
    if (inBar) { box.classList.remove('floating'); pop.appendChild(box); slot.appendChild(menu); }
    else if (inSlot) { box.classList.remove('floating'); slot.appendChild(box); }
    else if (foot && narrow.matches) { box.classList.remove('floating'); foot.appendChild(box); }
    else { box.classList.add('floating'); shell.appendChild(box); if (!shell.parentNode) document.body.appendChild(shell); }
    if (box.parentNode !== shell && shell.parentNode) shell.parentNode.removeChild(shell);
    if (!inBar && menu.parentNode) menu.parentNode.removeChild(menu);
  }
  place();
  if (narrow.addEventListener) narrow.addEventListener('change', place);
  if (slot && slot.dataset.collapsible === 'sidebar') {
    new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  apply(saved());
})();
