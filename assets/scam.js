/* Scam alert page: provider search, and the section bar that follows you down the page. No storage. */
(function () {
  'use strict';
  var box = document.getElementById('pv-search'), rows = Array.prototype.slice.call(document.querySelectorAll('.pv-row'));
  var count = document.getElementById('pv-count'), none = document.getElementById('pv-none');
  function norm(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  var hay = rows.map(function (r) { return norm(r.getAttribute('data-q')).split(' '); });
  var names = rows.map(function (r) { return norm(r.querySelector('th').textContent).replace(/ /g, ''); });
  function apply() {
    var tokens = norm(box.value).split(' ').filter(Boolean), flat = tokens.join(''), shown = 0;
    rows.forEach(function (r, k) {
      var ok = !tokens.length || tokens.every(function (t) { return hay[k].some(function (w) { return w.indexOf(t) === 0; }); }) ||
               (flat.length >= 3 && names[k].indexOf(flat) !== -1);
      r.hidden = !ok; if (ok) shown++;
    });
    count.textContent = tokens.length ? shown + ' of ' + rows.length + ' providers match' : rows.length + ' providers on the list';
    none.hidden = !tokens.length || shown > 0;
  }
  if (box && rows.length) { box.addEventListener('input', apply); apply(); }

  /* the bar: mark the section you are reading, and keep that link in view on phones */
  var nav = document.getElementById('sc-nav'), links = nav ? Array.prototype.slice.call(nav.querySelectorAll('a')) : [];
  var groups = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  if (!links.length) return;
  var ticking = false;
  function update() {
    ticking = false;
    var bar = document.querySelector('.topbar'), line = (bar ? bar.offsetHeight : 0) + nav.offsetHeight + 24, cur = 0;
    groups.forEach(function (g, i) { if (g && g.getBoundingClientRect().top <= line) cur = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = groups.length - 1;
    links.forEach(function (a, i) {
      if (i === cur) {
        if (a.getAttribute('aria-current') !== 'true') {
          a.setAttribute('aria-current', 'true');
          if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2;
        }
      } else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
