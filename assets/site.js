/* The Companion: shared behaviour (menus, fuzzy search, back-to-top) */
(function () {
  'use strict';

  /* ---------- Top-bar menus (built from assets/menu-data.js) ---------- */
  var MENU = window.COMPANION_MENU || { courses: { total: 0, items: [] }, links: { total: 0, items: [] } };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function item(href, roman, title, count) {
    return '<a href="' + href + '">' + (roman ? '<span class="mi-roman">' + esc(roman) + '</span>' : '') +
      '<span class="mi-title">' + esc(title) + '</span><span class="mi-count">' + count + '</span></a>';
  }
  var mc = document.getElementById('menu-courses');
  if (mc) mc.innerHTML = '<a class="menu-all" href="courses.html"><span class="mi-title">All courses</span><span class="mi-count">' +
    MENU.courses.total + '</span></a>' +
    MENU.courses.items.map(function (i) { return item('courses.html#' + i.id, i.roman, i.title, i.count); }).join('');
  var ml = document.getElementById('menu-links');
  if (ml) ml.innerHTML = '<a class="menu-all" href="links.html"><span class="mi-title">All links</span><span class="mi-count">' +
    MENU.links.total + '</span></a>' +
    MENU.links.items.map(function (i) { return item('links.html#links-' + i.id, '', i.title, i.count); }).join('');

  if (ml) ml.innerHTML += '<a class="menu-more menu-more-first" href="calculator.html"><span class="mi-title">Grade calculator</span></a>' +
    '<a class="menu-more" href="contributors.html"><span class="mi-title">Contributors</span></a>' +
    '<a class="menu-more" href="scam-alert.html"><span class="mi-title">Scam alert</span></a>';

  var jump = document.getElementById('level-jump');
  if (jump) jump.innerHTML = MENU.courses.items.map(function (i) {
    return '<a href="#' + i.id + '">' + esc(i.title) + ' <span class="jump-n">' + i.count + '</span></a>';
  }).join('');

  var navItems = document.querySelectorAll('.nav-item');
  var canHover = window.matchMedia('(hover: hover)').matches;
  var closeTimer;
  function setOpen(el, open) {
    navItems.forEach(function (n) {
      if (n !== el) { n.classList.remove('open'); n.querySelector('.nav-caret').setAttribute('aria-expanded', 'false'); }
    });
    el.classList.toggle('open', open);
    el.querySelector('.nav-caret').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  navItems.forEach(function (el) {
    el.querySelector('.nav-caret').addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(el, canHover ? true : !el.classList.contains('open'));
    });
    el.querySelector('.menu').addEventListener('click', function () { setOpen(el, false); });
    el.querySelector('.nav-main').addEventListener('click', function () { setOpen(el, false); });
    if (canHover) {
      el.addEventListener('mouseenter', function () { clearTimeout(closeTimer); setOpen(el, true); });
      el.addEventListener('mouseleave', function () { closeTimer = setTimeout(function () { setOpen(el, false); }, 160); });
    }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item')) navItems.forEach(function (n) { setOpen(n, false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') navItems.forEach(function (n) { setOpen(n, false); });
  });

  /* ---------- Fuzzy search ---------- */
  var box = document.getElementById('search-box');
  if (box) {
    var STOP = { for: 1, of: 1, and: 1, in: 1, to: 1, the: 1, with: 1, a: 1, an: 1, on: 1 };
    var norm = function (s) {
      return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim();
    };
    // Optimal-string-alignment distance (insert, delete, replace, swap adjacent), with early exit.
    function dist(a, b, max) {
      var la = a.length, lb = b.length;
      if (Math.abs(la - lb) > max) return max + 1;
      var prev2 = null, prev = [], cur, i, j;
      for (j = 0; j <= lb; j++) prev[j] = j;
      for (i = 1; i <= la; i++) {
        cur = [i];
        var rowMin = i;
        for (j = 1; j <= lb; j++) {
          var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
          var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
          if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
          cur[j] = v;
          if (v < rowMin) rowMin = v;
        }
        if (rowMin > max) return max + 1;
        prev2 = prev; prev = cur;
      }
      return prev[lb];
    }
    function textOf(el) {   // text nodes joined by spaces, so adjacent spans never glue words together
      var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) out.push(n.nodeValue);
      return out.join(' ');
    }
    var rows = Array.prototype.slice.call(document.querySelectorAll('ol.courses li, ul.links-grid li'));
    var index = rows.map(function (li) {
      var text = norm(textOf(li)), words = text.split(' ');
      return {
        li: li, words: words, compact: words.join(''),
        initials: words.filter(function (w) { return !STOP[w]; }).map(function (w) { return w[0]; }).join('')
      };
    });
    function tokenMatches(t, ix) {
      var n = t.length;
      if (ix.compact.indexOf(t) !== -1) return true;               // substring, also across word breaks
      if (n >= 2 && (n >= 3 ? ix.initials.indexOf(t) !== -1 : ix.initials.indexOf(t) === 0)) return true; // MLT, NLP, BDM
      var max = /[0-9]/.test(t) ? 0 : n >= 8 ? 2 : n >= 4 ? 1 : 0;   // codes must match exactly
      if (!max) return false;
      for (var k = 0; k < ix.words.length; k++) {
        var w = ix.words[k];
        if (dist(t, w, max) <= max) return true;                   // typo in a whole word
        if (w.length > n && dist(t, w.slice(0, n), max) <= max) return true;  // typo in a word prefix
      }
      return false;
    }
    // Words students use that are not in the course titles
    var ALIAS = { dbms: ['database'], sql: ['database'], calculus: ['mathematics'], algebra: ['mathematics'],
      math: ['mathematics'], maths: ['mathematics'], stats: ['statistics'], stat: ['statistics'],
      ml: ['machine', 'learning'], dl: ['deep', 'learning'], ai: ['intelligence'], dsa: ['data', 'structures'],
      os: ['operating'], cv: ['vision'], oop: ['object'], java: ['programming'], tds: ['tools'] };
    function tokenOk(t, ix) {
      if (tokenMatches(t, ix)) return true;
      var a = ALIAS[t];
      return !!a && a.every(function (x) { return tokenMatches(x, ix); });
    }
    var none = document.getElementById('no-results');
    function filter(q) {
      var tokens = norm(q).split(' ').filter(Boolean);
      document.body.classList.toggle('searching', tokens.length > 0);
      var shown = 0;
      index.forEach(function (ix) {
        var ok = tokens.every(function (t) { return tokenOk(t, ix); });
        ix.li.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      document.querySelectorAll('section.level').forEach(function (sec) {
        var lis = sec.querySelectorAll('ol.courses li');
        if (!lis.length) return;
        sec.style.display = Array.prototype.some.call(lis, function (li) { return li.style.display !== 'none'; }) ? '' : 'none';
      });
      document.querySelectorAll('.link-group').forEach(function (g) {
        g.style.display = Array.prototype.some.call(g.querySelectorAll('li'), function (li) { return li.style.display !== 'none'; }) ? '' : 'none';
      });
      if (none) none.hidden = shown > 0 || !tokens.length;
    }
    box.addEventListener('input', function () { filter(box.value); });
    filter('');
  }

  /* ---------- Back to top ---------- */
  var up = document.getElementById('back-to-top');
  if (up) {
    window.addEventListener('scroll', function () { up.classList.toggle('show', window.scrollY > 480); });
    up.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
})();
