/* NPTEL page: search, "open this term" and credit filters. Plain scripts, no storage. */
(function () {
  'use strict';
  var box = document.getElementById('np-search'), open = document.getElementById('np-open');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.np-row'));
  if (!box || !rows.length) return;
  var crBtns = Array.prototype.slice.call(document.querySelectorAll('.np-cr'));
  var count = document.getElementById('np-count'), none = document.getElementById('np-none');
  function norm(s) { return String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  var hay = rows.map(function (r) { return norm(r.getAttribute('data-q')); });
  function apply() {
    var tokens = norm(box.value).split(' ').filter(Boolean);
    var credits = crBtns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-cr'); });
    var shown = 0;
    rows.forEach(function (r, i) {
      var ok = tokens.every(function (t) { return hay[i].indexOf(t) !== -1; });
      if (ok && open.checked && r.getAttribute('data-open') !== '1') ok = false;
      if (ok && credits.length && credits.indexOf(r.getAttribute('data-cr')) === -1) ok = false;
      r.hidden = !ok;
      if (ok) shown++;
    });
    document.querySelectorAll('.np-sec').forEach(function (sec) {
      var n = sec.querySelectorAll('.np-row:not([hidden])').length;
      sec.hidden = n === 0;
      var c = sec.querySelector('.group-count');
      if (c) c.textContent = n === +c.getAttribute('data-total') ? n : n + ' of ' + c.getAttribute('data-total');
    });
    count.textContent = 'Showing ' + shown + ' of ' + rows.length + ' courses';
    none.hidden = shown > 0;
  }
  box.addEventListener('input', apply);
  open.addEventListener('change', apply);
  crBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      apply();
    });
  });
  apply();
})();
