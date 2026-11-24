/* NPTEL page: the two table tabs, search and the "open this term" filter. No storage. */
(function () {
  'use strict';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.np-tab'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('data-panel')); });
  var box = document.getElementById('np-search'), open = document.getElementById('np-open');
  var count = document.getElementById('np-count'), none = document.getElementById('np-none');
  if (!tabs.length || !box) return;
  function norm(s) { return String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  var rows = Array.prototype.slice.call(document.querySelectorAll('.np-panel tr.np-row'));
  var hay = rows.map(function (r) { return norm(r.getAttribute('data-q')); });

  function select(i, focus, hash) {
    tabs.forEach(function (t, j) {
      t.setAttribute('aria-selected', j === i ? 'true' : 'false');
      t.tabIndex = j === i ? 0 : -1;
      panels[j].hidden = j !== i;
    });
    if (focus) tabs[i].focus();
    if (hash && window.history && history.replaceState) history.replaceState(null, '', '#' + panels[i].id);
    summary();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i, false, true); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = tabs.length;
      if (k === 'ArrowRight') { e.preventDefault(); select((i + 1) % n, true, true); }
      else if (k === 'ArrowLeft') { e.preventDefault(); select((i + n - 1) % n, true, true); }
      else if (k === 'Home') { e.preventDefault(); select(0, true, true); }
      else if (k === 'End') { e.preventDefault(); select(n - 1, true, true); }
    });
  });

  function current() { for (var i = 0; i < tabs.length; i++) if (tabs[i].getAttribute('aria-selected') === 'true') return i; return 0; }
  function summary() {
    var i = current(), p = panels[i], vis = p.querySelectorAll('tr.np-row:not([hidden])').length;
    var total = p.querySelectorAll('tr.np-row').length;
    count.textContent = 'Showing ' + vis + ' of ' + total + ' courses in this list';
    none.hidden = vis > 0;
  }
  function apply() {
    var tokens = norm(box.value).split(' ').filter(Boolean), openOnly = open.checked;
    rows.forEach(function (r, k) {
      var ok = tokens.every(function (t) { return hay[k].indexOf(t) !== -1; });
      if (ok && openOnly && r.getAttribute('data-open') !== '1') ok = false;
      r.hidden = !ok;
    });
    panels.forEach(function (p, j) {
      p.querySelectorAll('.level-group').forEach(function (g) {
        g.hidden = g.querySelectorAll('tr.np-row:not([hidden])').length === 0;
      });
      var n = p.querySelectorAll('tr.np-row:not([hidden])').length, el = tabs[j].querySelector('.np-tab-n');
      var total = +el.getAttribute('data-total');
      el.textContent = n === total ? total : n + '/' + total;
    });
    summary();
  }
  box.addEventListener('input', apply);
  open.addEventListener('change', apply);

  function fromHash() {
    var start = panels.map(function (p) { return p.id; }).indexOf((location.hash || '').slice(1));
    if (start > -1) select(start, false, false);
  }
  window.addEventListener('hashchange', fromHash);
  select(0, false, false);
  fromHash();
  apply();
})();
