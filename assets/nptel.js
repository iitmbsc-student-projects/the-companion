/* NPTEL page: the two table tabs, search, and the "open this term" and credit filters. No storage. */
(function () {
  'use strict';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.np-tab'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('data-panel')); });
  var box = document.getElementById('np-search'), open = document.getElementById('np-open');
  var count = document.getElementById('np-count'), none = document.getElementById('np-none');
  var other = document.getElementById('np-other'), clear = document.getElementById('np-clear');
  var crBtns = Array.prototype.slice.call(document.querySelectorAll('.np-cr'));
  if (!tabs.length || !box) return;

  /* lower case, no accents, letters and digits only, single spaces */
  function norm(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  var rows = Array.prototype.slice.call(document.querySelectorAll('.np-panel tr.np-row'));
  var words = rows.map(function (r) { return norm(r.getAttribute('data-q')).split(' '); });
  var panelOf = rows.map(function (r) { return panels.indexOf(r.closest('.np-panel')); });
  /* the cells that get highlighted, with their original text */
  var marks = rows.map(function (r) {
    return Array.prototype.slice.call(r.querySelectorAll('.np-code, .np-name, td[data-l="Professor"], .np-limit')).map(function (el) {
      return { el: el, text: el.textContent };
    });
  });
  var credit = '', loose = false, tokens = [], ready = false;   /* no URL changes while the page loads: the browser would scroll to the fragment */

  function matches(k, mode) {
    return tokens.every(function (t) {
      return words[k].some(function (w) { return mode ? w.indexOf(t) !== -1 : w.indexOf(t) === 0; });
    });
  }
  function url() {
    var q = box.value.trim(), cur = current();
    return location.pathname + (q ? '?q=' + encodeURIComponent(q) : '') + (cur > 0 ? '#' + panels[cur].id : '');
  }
  function current() { for (var i = 0; i < tabs.length; i++) if (tabs[i].getAttribute('aria-selected') === 'true') return i; return 0; }

  function select(i, focus, sync) {
    tabs.forEach(function (t, j) {
      t.setAttribute('aria-selected', j === i ? 'true' : 'false');
      t.tabIndex = j === i ? 0 : -1;
      panels[j].hidden = j !== i;
    });
    if (focus) tabs[i].focus();
    if (sync && ready && window.history && history.replaceState) history.replaceState(null, '', url());
    paint(); summary();
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

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function highlight(text) {
    var out = '', last = 0, hit = false, re = /[\p{L}\p{N}]+/gu, m;
    while ((m = re.exec(text))) {
      var w = norm(m[0]), best = null, at = 0;
      tokens.forEach(function (t) {
        var i = w.indexOf(t);
        if ((loose ? i !== -1 : i === 0) && (!best || t.length > best.length)) { best = t; at = i; }
      });
      if (best) {
        out += esc(text.slice(last, m.index + at)) + '<mark>' + esc(text.substr(m.index + at, best.length)) + '</mark>';
        last = m.index + at + best.length; hit = true;
      }
    }
    return hit ? out + esc(text.slice(last)) : null;
  }
  /* highlight the visible rows of the open list; put the plain text back everywhere else */
  function paint() {
    var cur = current();
    rows.forEach(function (r, k) {
      var live = panelOf[k] === cur && !r.hidden && tokens.length;
      marks[k].forEach(function (m) {
        var h = live ? highlight(m.text) : null;
        if (h) m.el.innerHTML = h; else if (m.el.firstElementChild || m.el.textContent !== m.text) m.el.textContent = m.text;
      });
    });
  }

  function summary() {
    var i = current(), p = panels[i];
    var vis = p.querySelectorAll('tr.np-row:not([hidden])').length, total = p.querySelectorAll('tr.np-row').length;
    var name = tabs[i].querySelector('.np-tab-t').textContent;
    var filtered = tokens.length || open.checked || credit !== '';
    count.textContent = filtered ? vis + ' of ' + total + ' courses in ' + name + (loose && tokens.length ? ', matching parts of words' : '')
                                 : total + ' courses in ' + name;
    none.hidden = vis > 0;
    clear.hidden = !filtered;
    /* matches waiting in the other list */
    var j = tabs.length > 1 ? (i + 1) % tabs.length : -1;
    if (j > -1 && filtered) {
      var n = panels[j].querySelectorAll('tr.np-row:not([hidden])').length;
      if (n) {
        other.hidden = false;
        other.innerHTML = '';
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'np-jump';
        b.textContent = 'See ' + n + ' in ' + tabs[j].querySelector('.np-tab-t').textContent;
        b.addEventListener('click', function () { select(j, false, true); });
        other.appendChild(b);
      } else { other.hidden = true; other.textContent = ''; }
    } else { other.hidden = true; other.textContent = ''; }
  }

  function apply(auto) {
    tokens = norm(box.value).split(' ').filter(Boolean);
    var openOnly = open.checked;
    function run(mode) {
      var n = 0;
      rows.forEach(function (r, k) {
        var ok = !tokens.length || matches(k, mode);
        if (ok && openOnly && r.getAttribute('data-open') !== '1') ok = false;
        if (ok && credit !== '' && r.getAttribute('data-g') !== credit) ok = false;
        r.hidden = !ok; if (ok) n++;
      });
      return n;
    }
    loose = false;
    if (!run(false) && tokens.length) { loose = true; if (!run(true)) loose = false; }
    panels.forEach(function (p, j) {
      p.querySelectorAll('.level-group').forEach(function (g) {
        g.hidden = g.querySelectorAll('tr.np-row:not([hidden])').length === 0;
      });
      var n = p.querySelectorAll('tr.np-row:not([hidden])').length, el = tabs[j].querySelector('.np-tab-n');
      var total = +el.getAttribute('data-total');
      el.textContent = n === total ? total : n + ' of ' + total;
    });
    /* nothing here but something in the other list: go there */
    var cur = current();
    if (auto && panels[cur].querySelectorAll('tr.np-row:not([hidden])').length === 0) {
      for (var j = 0; j < panels.length; j++) {
        if (panels[j].querySelectorAll('tr.np-row:not([hidden])').length) { select(j, false, false); break; }
      }
    }
    if (ready && window.history && history.replaceState) history.replaceState(null, '', url());
    paint(); summary();
  }

  box.addEventListener('input', function () { apply(true); });
  box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.value) { box.value = ''; apply(false); } });
  open.addEventListener('change', function () { apply(true); });
  crBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      credit = b.getAttribute('data-g');
      crBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      apply(true);
    });
  });
  clear.addEventListener('click', function () {
    box.value = ''; open.checked = false; credit = '';
    crBtns.forEach(function (x, i) { x.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); });
    apply(false); box.focus();
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target, tag = t && t.tagName;
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); box.focus(); box.select(); }
  });

  function fromHash() {
    var start = panels.map(function (p) { return p.id; }).indexOf((location.hash || '').slice(1));
    if (start > -1) select(start, false, false);
  }
  /* a menu link to #table-3 while already on this page: switch the list and bring the tabs into view */
  window.addEventListener('hashchange', function () {
    fromHash();
    var t = document.querySelector('.np-tabs');
    if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' });
  });
  var m = /[?&]q=([^&#]*)/.exec(location.search);
  if (m) { try { box.value = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) {} }
  select(0, false, false);
  fromHash();
  apply(!!m && !/^#table-/.test(location.hash));
  ready = true;
})();
