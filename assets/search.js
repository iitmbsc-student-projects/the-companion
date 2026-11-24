/* The Companion: lecture search on the home page. The course-chip filtering
   lives in assets/site.js; this adds a second lane — matching individual
   lectures across every course, from assets/search-index.json (written by
   tools/generate.py), deep-linking to the exact lecture via the course page's
   hash routing. The index is fetched once, on the first real query. */
(function () {
  'use strict';
  var box = document.getElementById('search-box');
  var list = document.getElementById('hm-lec-results');
  var head = document.getElementById('hm-lec-head');
  if (!box || !list || !head) return;

  var INDEX = null, loading = false, pending = null;
  var MAX = 12;

  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim(); }

  function ensureIndex(q) {
    if (INDEX) { show(q); return; }
    pending = q;
    if (loading) return;
    loading = true;
    fetch('assets/search-index.json').then(function (r) { return r.json(); }).then(function (data) {
      INDEX = data.map(function (c) {
        return {
          c: c.c, t: c.t, u: c.u, lc: norm(c.c + ' ' + c.t),
          items: (c.i || []).map(function (it) {
            return { n: it[0], t: it[1], h: it[2], w: it[3], lt: norm(it[0] + ' ' + it[1]) };
          })
        };
      });
      if (pending != null) show(pending);
    }).catch(function () { INDEX = []; });
  }

  function show(q) {
    var tokens = norm(q).split(' ').filter(Boolean);
    if (!tokens.length || !INDEX) { hide(); return; }
    var out = [];
    for (var ci = 0; ci < INDEX.length && out.length < MAX * 4; ci++) {
      var course = INDEX[ci];
      for (var ii = 0; ii < course.items.length; ii++) {
        var it = course.items[ii];
        var score = 0, ok = true;
        for (var ti = 0; ti < tokens.length; ti++) {
          var tk = tokens[ti];
          var inLec = it.lt.indexOf(tk) >= 0, inCourse = course.lc.indexOf(tk) >= 0;
          if (!inLec && !inCourse) { ok = false; break; }
          score += inLec ? (it.lt.indexOf(tk + ' ') === 0 || it.lt.indexOf(' ' + tk) >= 0 ? 3 : 2) : 1;
        }
        /* at least one token must hit the lecture itself, or everything in a course matches */
        if (ok && tokens.some(function (tk) { return it.lt.indexOf(tk) >= 0; })) {
          out.push({ course: course, it: it, score: score });
        }
      }
    }
    out.sort(function (a, b) { return b.score - a.score; });
    out = out.slice(0, MAX);
    list.textContent = '';
    out.forEach(function (r) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = r.course.u + '#' + r.it.h;
      var code = document.createElement('span'); code.className = 'lr-code'; code.textContent = r.course.c;
      var w = document.createElement('span'); w.className = 'lr-w'; w.textContent = r.it.w + ' · ' + r.it.n;
      var t = document.createElement('span'); t.className = 'lr-t'; t.textContent = r.it.t;
      a.appendChild(code); a.appendChild(w); a.appendChild(t);
      li.appendChild(a);
      list.appendChild(li);
    });
    head.hidden = list.hidden = out.length === 0;
  }

  function hide() { head.hidden = true; list.hidden = true; list.textContent = ''; }

  var timer;
  box.addEventListener('input', function () {
    clearTimeout(timer);
    var q = box.value.trim();
    if (q.length < 3) { hide(); return; }
    timer = setTimeout(function () { ensureIndex(q); }, 120);
  });
})();
