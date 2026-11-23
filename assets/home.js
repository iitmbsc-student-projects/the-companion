/* The Companion: home page (recent courses, upcoming dates, search shortcuts) */
(function () {
  'use strict';
  var C = window.HOME_COURSES || {};
  var box = document.getElementById('search-box');

  function get(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; }
  }

  /* "/" jumps to the search box; Enter opens the first match */
  document.addEventListener('keydown', function (e) {
    var t = e.target && e.target.tagName;
    if (e.key === '/' && box && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t || '')) {
      e.preventDefault(); box.focus(); box.select();
    }
  });
  if (box) box.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !box.value.trim()) return;
    var rows = document.querySelectorAll('.hm-levels li');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].style.display !== 'none') { var a = rows[i].querySelector('a'); if (a) { e.preventDefault(); location.href = a.href; } return; }
    }
  });

  /* continue where you left off: remembered in this browser only */
  var sec = document.getElementById('hm-resume'), grid = document.getElementById('hm-resume-list');
  function candidates() {
    var recent = get('companion-recent', []), hide = get('companion-home-hide', []), codes = [];
    if (!Array.isArray(recent)) recent = [];
    if (!Array.isArray(hide)) hide = [];
    recent.forEach(function (c) { if (C[c] && codes.indexOf(c) < 0 && hide.indexOf(c) < 0) codes.push(c); });
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('companion-progress-') === 0) {
          var c = k.slice('companion-progress-'.length);
          var p = get(k, null);
          if (C[c] && p && p.done && Object.keys(p.done).length && codes.indexOf(c) < 0 && hide.indexOf(c) < 0) codes.push(c);
        }
      }
    } catch (e) {}
    return codes;
  }
  function render() {
    if (!sec || !grid) return;
    var codes = candidates().slice(0, 3);
    grid.textContent = '';
    codes.forEach(function (code) {
      var c = C[code], p = get('companion-progress-' + code, null);
      var done = p && p.done ? Object.keys(p.done).length : 0;
      var a = document.createElement('a'); a.className = 'hm-rc'; a.href = c.u;
      var s1 = document.createElement('span'); s1.className = 'hm-rc-code'; s1.textContent = code;
      var s2 = document.createElement('span'); s2.className = 'hm-rc-title'; s2.textContent = c.t;
      var s3 = document.createElement('span'); s3.className = 'hm-rc-meta';
      var word = c.i || 'lecture';
      if (c.n && done) {
        s3.textContent = Math.min(done, c.n) + ' of ' + c.n + ' ' + word + 's watched';
      } else {
        s3.textContent = 'Opened recently';
      }
      a.appendChild(s1); a.appendChild(s2); a.appendChild(s3);
      if (c.n && done) {
        var bar = document.createElement('span'); bar.className = 'hm-bar'; bar.setAttribute('aria-hidden', 'true');
        var fill = document.createElement('i'); fill.style.width = Math.min(100, Math.round(done * 100 / c.n)) + '%';
        bar.appendChild(fill); a.appendChild(bar);
      }
      grid.appendChild(a);
    });
    sec.hidden = codes.length === 0;
  }
  render();
  /* "Clear list" hides every course in it from this page; watched ticks on the course pages are not touched,
     and opening a course again brings it back */
  var clr = document.getElementById('hm-forget');
  if (clr) clr.addEventListener('click', function () {
    var hide = get('companion-home-hide', []);
    if (!Array.isArray(hide)) hide = [];
    candidates().forEach(function (c) { if (hide.indexOf(c) < 0) hide.push(c); });
    try {
      localStorage.setItem('companion-home-hide', JSON.stringify(hide));
      localStorage.removeItem('companion-recent');
    } catch (e) {}
    render();
  });

  /* upcoming dates: hide what is over, label what is next */
  var list = document.getElementById('hm-dates');
  if (list) {
    var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var pd = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
    var shown = 0, LIMIT = 5;
    [].slice.call(list.querySelectorAll('li')).forEach(function (li) {
      var s = pd(li.getAttribute('data-start')), e = li.getAttribute('data-end') ? pd(li.getAttribute('data-end')) : s;
      var w = li.querySelector('.hm-when');
      if (e < today || shown >= LIMIT) { li.hidden = true; return; }
      shown++;
      var d = Math.round((s - today) / 86400000), txt, soon = false;
      if (s <= today) { txt = (+s === +today && +e === +s) ? 'Today' : 'On now'; soon = true; }
      else if (d === 1) { txt = 'Tomorrow'; soon = true; }
      else if (d <= 13) { txt = 'In ' + d + ' days'; soon = d <= 7; }
      else if (d <= 60) { txt = 'In ' + Math.round(d / 7) + ' weeks'; }
      else { txt = 'In ' + Math.round(d / 30) + ' months'; }
      if (w) { w.textContent = txt; w.className = 'hm-when' + (soon ? ' soon' : ''); }
    });
    var empty = document.getElementById('hm-dates-empty');
    if (empty) empty.hidden = shown > 0;
    list.hidden = shown === 0;
  }
})();
