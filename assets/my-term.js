/* The Companion: My Term — pick this term's courses, see progress against the
   exam calendar, and work the grading formula backwards ("what end-term score
   does each grade need?"). Data: the embedded JSON blocks (course weeks from
   the generator, grading.json, dates.json), window.TERM_SYLLABUS for exam
   coverage, localStorage for watched ticks (mirrored by assets/sync.js). */
(function () {
  'use strict';
  var TS = window.TERM_SYLLABUS || { term: '', courses: {} };
  var MT = JSON.parse((document.getElementById('myterm-data') || { textContent: '{}' }).textContent);
  var G = JSON.parse((document.getElementById('grading-data') || { textContent: '{}' }).textContent);
  var DATES = JSON.parse((document.getElementById('dates-data') || { textContent: '{}' }).textContent);
  var ENGINE = window.GradingEngine;
  var S = window.CompanionSync;
  var soonestEx = null;
  var term = TS.term || (DATES && DATES.term) || '';

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function lsGet(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; }
  }

  /* grading.json courses by code */
  var GC = {};
  (G.levels || []).forEach(function (lv) { lv.courses.forEach(function (c) { GC[c.code] = c; }); });

  /* exam dates for the term, by which exam they are */
  function parseDay(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var EXAMS = {};
  ((DATES && DATES.items) || []).forEach(function (it) {
    if (it.title === 'Quiz 1') EXAMS.quiz1 = it.date;
    else if (it.title === 'Quiz 2') EXAMS.quiz2 = it.date;
    else if (it.title === 'End term exam') EXAMS.endterm = it.date;
  });
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function weekNum(label) { var m = /(\d+)/.exec(label || ''); return m ? +m[1] : null; }
  function parseCoverage(s) {
    var m = /(\d+)\s*[\u2013\u2014-]\s*(\d+)/.exec(s || '');
    if (m) return [+m[1], +m[2]];
    m = /(\d+)/.exec(s || '');
    return m ? [+m[1], +m[1]] : null;
  }
  function fmtDate(iso) {
    var d = parseDay(iso);
    return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  }

  /* next exam for one course: the first of quiz1/quiz2/endterm that is held
     this term and not yet past */
  function nextExam(code) {
    var t = TS.courses[code];
    if (!t) return null;
    var order = [['quiz1', 'Quiz 1'], ['quiz2', 'Quiz 2'], ['endterm', 'End term']];
    for (var i = 0; i < order.length; i++) {
      var key = order[i][0], part = t[key];
      var iso = EXAMS[key];
      if (!part || !part.held || !iso) continue;
      if (parseDay(iso) >= today) return { key: key, label: order[i][1], date: iso, weeks: part.weeks || '' };
    }
    return null;
  }

  function progressOf(code) {
    var p = lsGet('companion-progress-' + code, null);
    return (p && p.done) || {};
  }

  /* ---------------------------- the course picker ---------------------------- */
  var picked = [];
  var LEVELS = ['Foundation', 'Diploma', 'Degree', 'BSc', 'BS', 'PG Diploma'];
  function levelRank(l) { var i = LEVELS.indexOf(l); return i < 0 ? LEVELS.length : i; }

  function buildPicker() {
    var grid = $('mt-pick-grid');
    var pick = $('mt-pick');
    if (pick && !pick.querySelector('.mt-filter')) {
      var f = document.createElement('input');
      f.type = 'search'; f.className = 'mt-filter'; f.placeholder = 'Filter courses';
      f.setAttribute('aria-label', 'Filter courses');
      f.addEventListener('input', function () {
        var q = f.value.trim().toLowerCase();
        [].forEach.call(grid.querySelectorAll('label'), function (lab) {
          lab.hidden = !!(q && lab.textContent.toLowerCase().indexOf(q) < 0);
        });
        [].forEach.call(grid.querySelectorAll('.mt-level-h'), function (h) {
          var n = h.nextElementSibling, any = false;
          while (n && !n.classList.contains('mt-level-h')) {
            if (n.tagName === 'LABEL' && !n.hidden) any = true;
            n = n.nextElementSibling;
          }
          h.hidden = !any;
        });
      });
      grid.parentNode.insertBefore(f, grid);
    }
    grid.textContent = '';
    var codes = Object.keys(TS.courses).sort(function (a, b) {
      var la = levelRank(TS.courses[a].level), lb = levelRank(TS.courses[b].level);
      return la - lb || a.localeCompare(b);
    });
    var lastLevel = null;
    codes.forEach(function (code) {
      var c = TS.courses[code];
      if (c.level !== lastLevel) {
        lastLevel = c.level;
        grid.appendChild(el('span', 'mt-level-h', c.level));
      }
      var lab = el('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = code; cb.checked = picked.indexOf(code) >= 0;
      cb.addEventListener('change', function () {
        if (cb.checked) { if (picked.indexOf(code) < 0) picked.push(code); }
        else picked = picked.filter(function (x) { return x !== code; });
        save(); render();
      });
      lab.appendChild(cb);
      lab.appendChild(el('span', 'code', code));
      lab.appendChild(el('span', null, c.name || (MT[code] && MT[code].t) || code));
      grid.appendChild(lab);
    });
  }

  function save() {
    if (S) S.setEnrollments(term, picked);
    else try { localStorage.setItem('companion-enroll-' + term, JSON.stringify(picked)); } catch (e) {}
  }

  /* ------------------------------- the course rows ------------------------------- */
  function daysUntil(iso) { return Math.round((parseDay(iso) - today) / 86400000); }
  function inDays(n) { return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; }

  function stat(k, v, sub) {
    var t = el('div', 'mt-stat');
    t.appendChild(el('span', 'mt-stat-k', k));
    t.appendChild(el('span', 'mt-stat-v', v));
    if (sub) t.appendChild(el('span', 'mt-stat-s', sub));
    return t;
  }

  function render() {
    var grid = $('mt-grid');
    grid.textContent = '';
    $('mt-empty').hidden = picked.length > 0;
    if (picked.length) $('mt-pick').open = false;
    $('mt-pick-sum').textContent = picked.length
      ? 'Your courses (' + picked.length + ') · change'
      : 'Choose your courses';

    var rowsData = [];
    var soonest = null, soonestCodes = [], leftAll = 0, watchedAll = 0, totalAll = 0;

    picked.forEach(function (code) {
      var mt = MT[code], ts = TS.courses[code];
      var done = progressOf(code);
      var weeks = (mt && mt.weeks) || [];
      var total = 0, watched = 0, byWeek = {};
      weeks.forEach(function (w) {
        total += w.n;
        var dn = Object.keys(done).filter(function (k) { return k.indexOf(w.w + '|') === 0; }).length;
        dn = Math.min(dn, w.n);
        watched += dn;
        var num = weekNum(w.w);
        if (num != null) byWeek[num] = { n: w.n, done: dn, d: w.d || 0 };
      });
      totalAll += total; watchedAll += watched;
      var ex = nextExam(code);
      var days = ex ? Math.max(0, daysUntil(ex.date)) : null;
      var left = null, covTotal = 0, secLeft = 0, cov = ex ? parseCoverage(ex.weeks) : null;
      if (cov && total) {
        left = 0;
        for (var wnum = cov[0]; wnum <= cov[1]; wnum++) {
          var w = byWeek[wnum];
          if (!w) continue;
          covTotal += w.n; left += w.n - w.done;
          if (w.d && w.n) secLeft += (w.n - w.done) * (w.d / w.n);
        }
        leftAll += left;
      }
      if (ex) {
        if (soonest == null || days < soonest) { soonest = days; soonestCodes = [code]; soonestEx = ex; }
        else if (days === soonest) soonestCodes.push(code);
      }
      rowsData.push({ code: code, mt: mt, ts: ts, total: total, watched: watched, ex: ex, days: days,
        left: left, covTotal: covTotal, secLeft: secLeft });
    });

    rowsData.sort(function (a, b) {
      var da = a.days == null ? 9999 : a.days, db = b.days == null ? 9999 : b.days;
      return da - db;
    });

    /* summary tiles */
    var sum = $('mt-summary');
    sum.textContent = '';
    sum.hidden = picked.length === 0;
    if (picked.length) {
      sum.appendChild(stat('Courses', String(picked.length), term + ' term'));
      if (soonest != null) {
        sum.appendChild(stat('Next exam', soonestEx.label + ' · ' + fmtDate(soonestEx.date),
          inDays(soonest) + ' · ' + (soonestCodes.length > 2 ? soonestCodes.slice(0, 2).join(', ') + ' +' + (soonestCodes.length - 2) + ' more' : soonestCodes.join(', '))));
        sum.appendChild(stat('Lectures to catch up', String(leftAll), 'before the next exams'));
      } else {
        sum.appendChild(stat('Next exam', 'None left', 'for these courses this term'));
      }
      sum.appendChild(stat('Watched', totalAll ? Math.round(watchedAll * 100 / totalAll) + '%' : '—',
        totalAll ? watchedAll + ' of ' + totalAll + ' lectures' : 'no lecture lists yet'));
    }

    rowsData.forEach(function (r) {
      var row = el('div', 'mt-row');
      var main = el('div', 'mt-r-main');
      main.appendChild(el('span', 'mt-code', r.code));
      var title = el('span', 'mt-title');
      if (r.mt && r.mt.u) {
        var a = document.createElement('a'); a.href = r.mt.u;
        a.textContent = (r.mt && r.mt.t) || (r.ts && r.ts.name) || r.code;
        title.appendChild(a);
      } else title.textContent = (r.ts && r.ts.name) || r.code;
      main.appendChild(title);
      row.appendChild(main);

      var prog = el('div', 'mt-r-prog');
      if (r.total) {
        var bar = el('span', 'mt-bar');
        var fill = document.createElement('i');
        fill.style.width = Math.min(100, Math.round(r.watched * 100 / r.total)) + '%';
        bar.appendChild(fill);
        prog.appendChild(bar);
        prog.appendChild(el('span', 'mt-meta', r.watched + ' of ' + r.total + ' lectures watched'));
      } else prog.appendChild(el('span', 'mt-meta', 'No lecture list on the site yet.'));
      row.appendChild(prog);

      var exBox = el('div', 'mt-r-exam');
      if (r.ex) {
        exBox.appendChild(el('b', null, r.ex.label + ' · ' + fmtDate(r.ex.date)));
        exBox.appendChild(el('span', 'mt-meta', inDays(r.days) + (r.ex.weeks ? ' · ' + r.ex.weeks : '')));
      } else if (r.ts) exBox.appendChild(el('span', 'mt-meta', 'No exam left this term.'));
      else exBox.appendChild(el('span', 'mt-meta', 'Not in the ' + term + ' quiz circular.'));
      row.appendChild(exBox);

      if (r.ex && r.total) {
        var pace = el('span', 'mt-pace');
        if (r.left == null || !r.covTotal) {
          pace.textContent = 'Covered weeks are not in the lecture list yet.';
        } else if (!r.left) {
          pace.textContent = 'All ' + r.covTotal + ' covered lectures watched. Revision time.';
        } else {
          var days = Math.max(1, r.days);
          var perDay = r.left / days;
          var hrs = r.secLeft ? ', about ' + (Math.round(r.secLeft / 360) / 10) + ' h' : '';
          pace.textContent = r.left + ' of ' + r.covTotal + ' covered lectures left' + hrs + ' · ' +
            (perDay <= 1 ? 'about 1 a day' : 'about ' + Math.ceil(perDay) + ' a day');
          if (perDay > 3 || days <= 3) pace.className = 'mt-pace soon';
        }
        row.appendChild(pace);
      }
      grid.appendChild(row);
    });

    renderReverse();
  }

  /* -------------------- reverse calculator: end term needed -------------------- */
  var revState = { code: null, vals: {}, timer: null };

  function renderReverse() {
    var sec = $('mt-rev'), sel = $('mt-rev-course');
    var codes = picked.filter(function (c) { return GC[c]; });
    sec.hidden = codes.length === 0;
    if (!codes.length) return;
    var keep = revState.code && codes.indexOf(revState.code) >= 0 ? revState.code : codes[0];
    sel.innerHTML = '';
    codes.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c + '  ' + GC[c].title;
      sel.appendChild(o);
    });
    sel.value = keep;
    sel.onchange = function () { buildReverse(sel.value); };
    buildReverse(keep);
  }

  function buildReverse(code) {
    revState.code = code;
    revState.vals = {};
    var course = GC[code];
    var endId = ENGINE.endTermId(course);
    var box = $('mt-rev-inputs');
    box.innerHTML = '';
    var fields = {};
    course.inputs.forEach(function (inp) {
      if (inp.id === endId || inp.bonus) return;
      var wrap = el('label', 'calc-field');
      wrap.appendChild(el('span', 'cf-label', inp.label));
      var i = document.createElement('input');
      i.type = 'text'; i.inputMode = 'decimal'; i.autocomplete = 'off';
      i.placeholder = '0 to ' + (inp.max || 100);
      i.addEventListener('input', function () {
        var n = parseFloat(String(i.value).replace(',', '.'));
        revState.vals[inp.id] = isNaN(n) ? 0 : Math.max(0, Math.min(inp.max || 100, n));
        clearTimeout(revState.timer);
        revState.timer = setTimeout(function () {
          if (S) S.setScores(term, code, revState.vals);
        }, 1200);
        solve(course, endId);
      });
      wrap.appendChild(i);
      box.appendChild(wrap);
      fields[inp.id] = i;
    });

    var load = S ? S.getScores(term, code) : Promise.resolve(lsGet('companion-scores-' + term + '-' + code, null));
    Promise.resolve(load).then(function (saved) {
      if (saved && revState.code === code) {
        Object.keys(saved).forEach(function (id) {
          revState.vals[id] = saved[id];
          if (fields[id]) fields[id].value = saved[id];
        });
      }
      solve(course, endId);
    });
  }

  function solve(course, endId) {
    var chips = $('mt-rev-table');
    var note = $('mt-rev-note');
    chips.textContent = '';
    if (!endId) {
      chips.hidden = true;
      note.textContent = 'This course has no single end-term input, so it cannot be worked backwards here.';
      return;
    }
    chips.hidden = false;
    (G.bands || []).forEach(function (band) {
      var need = ENGINE.neededFinal(course, revState.vals, band.min, endId);
      var chip = el('div', 'mt-chip');
      chip.appendChild(el('span', 'mt-chip-g', band.grade));
      if (need == null) {
        chip.classList.add('is-no');
        chip.appendChild(el('span', 'mt-chip-v', '—'));
        chip.appendChild(el('span', 'mt-chip-s', 'not reachable'));
      } else if (need === 0) {
        chip.classList.add('is-ok');
        chip.appendChild(el('span', 'mt-chip-v', 'Secured'));
        chip.appendChild(el('span', 'mt-chip-s', 'any score'));
      } else {
        chip.appendChild(el('span', 'mt-chip-v', String(Math.round(need * 10) / 10)));
        chip.appendChild(el('span', 'mt-chip-s', 'or more'));
      }
      chips.appendChild(chip);
    });
    var notes = (course.notes || []).slice();
    if (course.elig) notes.unshift('Eligibility: average of your best ' + course.elig.best + ' of ' + course.elig.of + ' ' + (course.elig.label || 'weekly assignments') + ' must be 40 or more to sit the end term.');
    note.textContent = notes.length ? notes.join(' ') : '';
  }

  /* --------------------------------- boot --------------------------------- */
  buildPicker();
  var start = S ? Promise.resolve(S.ready).then(function () { return S.getEnrollments(term); })
                : Promise.resolve(lsGet('companion-enroll-' + term, []));
  start.then(function (codes) {
    picked = Array.isArray(codes) ? codes.slice() : [];
    buildPicker(); render();
  });
  document.addEventListener('companion-sync-ready', function () { render(); });
})();
