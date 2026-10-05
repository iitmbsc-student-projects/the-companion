/* The Companion: grade calculator. Reads the course formulas from #grading-data and works out T live. */
(function () {
  'use strict';
  var raw = document.getElementById('grading-data');
  var sel = document.getElementById('calc-course');
  var body = document.getElementById('calc-body');
  if (!raw || !sel || !body) return;

  var data = JSON.parse(raw.textContent);
  var courses = {}, tiers = [];
  var levelBox = document.getElementById('calc-levels');
  function tierName(title) { return title.indexOf('Diploma') === 0 ? 'Diploma' : title; }
  data.levels.forEach(function (lv) {
    var name = tierName(lv.title), t = null;
    tiers.forEach(function (x) { if (x.name === name) t = x; });
    if (!t) { t = { name: name, groups: [] }; tiers.push(t); }
    t.groups.push(lv);
    lv.courses.forEach(function (c) { courses[c.code] = c; c._tier = name; });
  });
  var tierBtns = {};
  tiers.forEach(function (t) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'calc-level'; b.textContent = t.name;
    b.addEventListener('click', function () { pickTier(t.name, null); });
    levelBox.appendChild(b); tierBtns[t.name] = b;
  });
  function fillCourses(name) {
    sel.innerHTML = '';
    var t = tiers.filter(function (x) { return x.name === name; })[0];
    t.groups.forEach(function (lv) {
      var host = sel;
      if (t.groups.length > 1) { host = document.createElement('optgroup'); host.label = lv.title; sel.appendChild(host); }
      lv.courses.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c.code; o.textContent = c.code + '  ' + c.title;
        host.appendChild(o);
      });
    });
    tiers.forEach(function (x) {
      tierBtns[x.name].setAttribute('aria-pressed', x.name === name ? 'true' : 'false');
      tierBtns[x.name].classList.toggle('is-on', x.name === name);
    });
  }
  function pickTier(name, code) {
    fillCourses(name);
    var first = code || sel.options[0].value;
    sel.value = first;
    savePref(first);
    try { history.replaceState(null, '', '#' + first.toLowerCase()); } catch (e) {}
    build(first);
  }

  var KEY = 'companion-calc-course';
  function readPref() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function savePref(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function num(v) {
    if (v === '' || v == null) return null;
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  function fmt(n) {
    if (!isFinite(n)) return '0';
    return (Math.round(n * 100) / 100).toString();
  }

  function compile(expr, names) {
    return new Function(names.join(','), 'max', 'min', 'return (' + expr + ');');
  }
  function run(fn, names, vals) {
    var args = names.map(function (n) { return vals[n] || 0; });
    return fn.apply(null, args.concat([Math.max, Math.min]));
  }

  function gradeFor(t) {
    for (var i = 0; i < data.bands.length; i++) { if (t >= data.bands[i].min) return data.bands[i]; }
    return { grade: data.fail.grade, gp: data.fail.gp };
  }

  var course = null, state = null;

  function build(code) {
    course = courses[code];
    if (!course) return;
    state = { inputs: {}, weekly: [], gaaDirty: false };
    body.innerHTML = '';

    var head = el('div', 'calc-head');
    head.appendChild(el('h2', 'calc-title', course.title));
    head.appendChild(el('span', 'calc-code', course.code + '  ·  ' + course.level));
    body.appendChild(head);

    state.mini = el('div', 'calc-mini'); state.mini.hidden = true;
    state.mini.setAttribute('aria-live', 'polite');
    body.appendChild(state.mini);

    var cols = el('div', 'calc-cols');
    var left = el('div', 'calc-left');
    var right = el('div', 'calc-right');
    cols.appendChild(left); cols.appendChild(right);
    body.appendChild(cols);

    // marks
    var box = el('div', 'calc-card calc-marks');
    box.appendChild(el('h3', 'calc-h', 'Your marks'));
    box.appendChild(el('p', 'calc-help', 'Leave a box empty if you have not taken it. It counts as 0, as in the grading document.'));
    var grid = el('div', 'calc-grid');
    course.inputs.forEach(function (inp) {
      var mx = inp.max || 100;
      var wrap = el('label', 'calc-field' + (inp.bonus ? ' is-bonus' : ''));
      wrap.appendChild(el('span', 'cf-label', inp.label));
      var i = document.createElement('input');
      i.type = 'text'; i.inputMode = 'decimal'; i.autocomplete = 'off';
      i.placeholder = '0 to ' + mx;
      i.setAttribute('data-id', inp.id);
      if (course.weekly && inp.id === course.weekly.gaa) i.addEventListener('input', function () { state.gaaDirty = i.value.trim() !== ''; });
      i.addEventListener('input', update);
      wrap.appendChild(i);
      var hint = (inp.hint || '').replace(/^0 if not attempted\.?$/i, '').replace(/\.$/, '');
      var txt = /out of/i.test(hint) ? hint : (hint ? hint + (mx !== 100 ? '. Out of ' + mx : '') : (mx !== 100 ? 'Out of ' + mx : ''));
      var h = el('span', 'cf-hint', txt ? txt + '.' : '');
      if (!txt) h.hidden = true;
      wrap.appendChild(h);
      var err = el('span', 'cf-err'); err.hidden = true;
      wrap.appendChild(err);
      grid.appendChild(wrap);
      state.inputs[inp.id] = { el: i, err: err, max: mx, hint: h, hintTxt: txt ? txt + '.' : '' };
    });
    box.appendChild(grid);
    left.appendChild(box);

    // weekly scores: eligibility check, and GAA filled in for you
    if (course.elig || course.weekly) {
      var nW = course.weekly ? course.weekly.n : course.elig.of;
      var wl = (course.weekly && course.weekly.labels) || null;
      var eb = el('div', 'calc-card calc-eligbox' + (course.weekly ? ' is-weekly' : ''));
      eb.appendChild(el('h3', 'calc-h', course.weekly ? 'Weekly assignments' : 'End term eligibility'));
      var help = 'Optional. ';
      if (course.weekly) {
        help += 'Enter your weekly scores and the ' + course.weekly.gaa + ' box above fills in by itself' +
          (course.weekly.best ? ' (average of your best ' + course.weekly.best + ' of ' + course.weekly.n + ')' : '') +
          '. Or type your ' + course.weekly.gaa + ' there yourself. Empty weeks count as 0.';
      }
      if (course.elig) {
        help += course.weekly
          ? ' The average of your best ' + course.elig.best + ' of the first ' + course.elig.of + ' weeks is also checked against the 40 needed for the end term.'
          : 'Enter your ' + course.elig.label + ' to see the average of your best ' + course.elig.best + ' of ' + course.elig.of + '. You need 40 or more.';
      }
      eb.appendChild(el('p', 'calc-help', help));
      var wg = el('div', 'calc-weeks');
      for (var k = 0; k < nW; k++) {
        var w = el('label', 'calc-week');
        w.appendChild(el('span', null, wl ? wl[k] : 'W' + (k + 1)));
        var wi = document.createElement('input');
        wi.type = 'text'; wi.inputMode = 'decimal'; wi.autocomplete = 'off'; wi.placeholder = '0';
        wi.addEventListener('input', update);
        w.appendChild(wi);
        wg.appendChild(w);
        state.weekly.push(wi);
      }
      eb.appendChild(wg);
      state.eligOut = el('p', 'calc-elig');
      eb.appendChild(state.eligOut);
      left.appendChild(eb);
    }

    // results
    var res = el('div', 'calc-card calc-result');
    res.appendChild(el('h3', 'calc-h', 'Your score'));
    state.big = el('div', 'calc-big');
    state.sub = el('p', 'calc-sub');
    state.bonusLine = el('p', 'calc-bonus');
    state.grade = el('div', 'calc-grade');
    state.gates = el('ul', 'calc-gates');
    res.appendChild(state.big); res.appendChild(state.sub); res.appendChild(state.bonusLine); res.appendChild(state.grade); res.appendChild(state.gates);
    res.appendChild(el('p', 'calc-est', 'Estimate only. Not an official score.'));
    right.appendChild(res);

    // notes
    if (course.notes && course.notes.length) {
      var nb = el('div', 'calc-card');
      nb.appendChild(el('h3', 'calc-h', 'Good to know'));
      var ul = el('ul', 'calc-notes');
      course.notes.forEach(function (n) { ul.appendChild(el('li', null, n)); });
      nb.appendChild(ul);
      right.appendChild(nb);
    }

    var det = document.createElement('details');
    det.className = 'calc-formula';
    det.appendChild(el('summary', null, 'Show the formula'));
    det.appendChild(el('code', null, 'T = ' + course.formula.replace(/\*/g, ' × ').replace(/\s+/g, ' ')));
    right.appendChild(det);

    var gd = document.createElement('details');
    gd.className = 'calc-formula';
    gd.appendChild(el('summary', null, 'Show the grade table'));
    var tbl = el('div', 'calc-table');
    data.bands.forEach(function (b, i) {
      var upper = i === 0 ? '100' : String(data.bands[i - 1].min);
      var r = el('div', 'ct-row');
      r.appendChild(el('span', 'ct-g', b.grade));
      r.appendChild(el('span', null, i === 0 ? 'T ' + b.min + ' or more' : b.min + ' to under ' + upper));
      r.appendChild(el('span', 'ct-p', b.gp + ' points'));
      tbl.appendChild(r);
    });
    var rf = el('div', 'ct-row');
    rf.appendChild(el('span', 'ct-g', data.fail.grade)); rf.appendChild(el('span', null, 'Under ' + data.pass_mark)); rf.appendChild(el('span', 'ct-p', data.fail.gp + ' points'));
    tbl.appendChild(rf);
    gd.appendChild(tbl);
    var st = el('ul', 'calc-notes calc-status');
    data.statuses.forEach(function (s) {
      var li = el('li'); li.appendChild(el('strong', null, s.grade + ': ')); li.appendChild(document.createTextNode(s.text)); st.appendChild(li);
    });
    gd.appendChild(st);
    right.appendChild(gd);

    try { course._fn = compile(course.formula, course.inputs.map(function (i) { return i.id; })); } catch (e) { course._fn = null; }
    course._gate = (course.gates || []).map(function (g) {
      var names = course.inputs.map(function (i) { return i.id; }).concat(['T']);
      try { return { label: g.label, fn: compile(g.expr, names) }; } catch (e) { return { label: g.label, fn: null }; }
    });
    update();
  }

  function update() {
    if (!course) return;
    // weekly scores
    if (state.weekly.length) {
      var ws = state.weekly.map(function (w) { var v = num(w.value); return v == null ? 0 : Math.max(0, Math.min(100, v)); });
      var filled = state.weekly.some(function (w) { return w.value.trim() !== ''; });
      var sum = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0); };
      var top = function (arr, k) { return arr.slice().sort(function (a, b) { return b - a; }).slice(0, k); };
      if (course.elig) {
        if (!filled) {
          state.eligOut.textContent = '';
          state.eligOut.className = 'calc-elig';
        } else {
          var first = ws.slice(0, course.elig.of);
          var avg = sum(top(first, course.elig.best)) / course.elig.best;
          var ok = avg >= 40;
          state.eligOut.className = 'calc-elig ' + (ok ? 'is-ok' : 'is-no');
          state.eligOut.textContent = 'Average of your best ' + course.elig.best + ': ' + fmt(avg) + (ok ? '. This meets the 40 needed.' : '. This is below the 40 needed.');
        }
      }
      if (course.weekly) {
        var gi = state.inputs[course.weekly.gaa];
        if (filled && !state.gaaDirty) {
          var k2 = course.weekly.best || ws.length;
          var gaa = sum(top(ws, k2)) / k2;
          gi.el.value = String(Math.round(gaa * 100) / 100);
          gi.hint.textContent = 'Filled in from your weekly scores.';
          gi.hint.hidden = false;
        } else if (!filled && !state.gaaDirty) {
          gi.el.value = '';
          gi.hint.textContent = gi.hintTxt; gi.hint.hidden = !gi.hintTxt;
        } else {
          gi.hint.textContent = gi.hintTxt; gi.hint.hidden = !gi.hintTxt;
        }
      }
    }

    var names = course.inputs.map(function (i) { return i.id; });
    var vals = {}, vals0 = {}, any = false, bad = false;
    course.inputs.forEach(function (inp) {
      var s = state.inputs[inp.id];
      var raw = s.el.value.trim();
      var n = num(raw);
      s.err.hidden = true; s.el.classList.remove('is-bad');
      if (raw !== '' && n == null) {
        s.err.textContent = 'Enter a number.'; s.err.hidden = false; s.el.classList.add('is-bad'); bad = true; n = null;
      } else if (n != null && n < 0) {
        s.err.textContent = 'Marks cannot be negative.'; s.err.hidden = false; s.el.classList.add('is-bad'); bad = true; n = null;
      } else if (n != null && n > s.max) {
        s.err.textContent = 'The maximum is ' + s.max + '.'; s.err.hidden = false; s.el.classList.add('is-bad'); bad = true; n = null;
      }
      if (n != null) any = true;
      vals[inp.id] = n == null ? 0 : n;
      vals0[inp.id] = inp.bonus ? 0 : vals[inp.id];
    });

    if (!course._fn) { state.big.textContent = '–'; return; }
    if (!any) {
      state.big.textContent = '–';
      state.sub.textContent = 'Enter your marks to see your score.';
      state.bonusLine.textContent = '';
      state.grade.innerHTML = '';
      state.gates.innerHTML = '';
      state.mini.hidden = true;
      return;
    }
    var hasBonus = course.inputs.some(function (i) { return i.bonus; });
    var t0 = run(course._fn, names, vals0);
    var t1 = run(course._fn, names, vals);
    var main = hasBonus ? t0 : t1;
    state.big.textContent = fmt(main);
    state.big.appendChild(el('span', 'calc-of', ' / 100'));
    state.sub.textContent = hasBonus ? 'Without bonus marks.' : 'Final course score T.';
    if (hasBonus && vals.B > 0) {
      state.bonusLine.textContent = 'With your bonus: ' + fmt(t1) + '. The bonus is added only if you pass the course.';
    } else if (hasBonus) {
      state.bonusLine.textContent = 'Bonus marks are added on top only if you pass the course.';
    } else {
      state.bonusLine.textContent = '';
    }
    state.gates.innerHTML = '';
    var gateFail = false;
    course._gate.forEach(function (g) {
      if (!g.fn) return;
      var names2 = names.concat(['T']);
      var v2 = {}; names.forEach(function (n) { v2[n] = vals0[n]; }); v2.T = t0;
      var ok = false;
      try { ok = !!run(g.fn, names2, v2); } catch (e) {}
      var li = el('li', ok ? 'is-ok' : 'is-no');
      li.appendChild(el('span', 'cg-mark', ok ? 'Met' : 'Not met'));
      li.appendChild(document.createTextNode(' ' + g.label));
      state.gates.appendChild(li);
      if (!ok) gateFail = true;
    });

    var tg = hasBonus && t0 >= data.pass_mark ? t1 : t0;
    var gr = gradeFor(tg);
    state.grade.innerHTML = '';
    state.grade.className = 'calc-grade' + (gr.grade === data.fail.grade ? ' is-fail' : gateFail ? ' is-pending' : '');
    state.grade.appendChild(el('span', 'cgr-letter', gr.grade));
    state.mini.hidden = false;
    state.mini.className = 'calc-mini' + (gr.grade === data.fail.grade ? ' is-fail' : gateFail ? ' is-pending' : '');
    state.mini.innerHTML = '';
    var ms = el('span', 'cm-s', 'Score '); ms.appendChild(el('strong', null, fmt(main))); ms.appendChild(document.createTextNode(' / 100'));
    var mg = el('span', 'cm-g', 'Grade '); mg.appendChild(el('strong', null, gr.grade));
    state.mini.appendChild(ms); state.mini.appendChild(mg);
    var gt = el('span', 'cgr-text');
    gt.appendChild(el('strong', null, gr.grade === data.fail.grade ? 'Below the pass mark of ' + data.pass_mark : 'Letter grade, ' + gr.gp + ' grade points'));
    var failed = gr.grade === data.fail.grade, withBonus = hasBonus && t0 >= data.pass_mark && vals.B > 0;
    gt.appendChild(el('span', null, failed
      ? (hasBonus && vals.B > 0 ? 'Bonus marks are added only when you pass, so they do not lift this.' : 'You need ' + data.pass_mark + ' or more to pass.')
      : gateFail ? 'You would not be awarded this until the conditions below are met.'
      : withBonus ? 'Counted with your bonus, using the handbook table.' : 'From your score alone, using the handbook table.'));
    state.grade.appendChild(gt);
  }

  var start = (location.hash || '').replace('#', '').toUpperCase();
  if (!courses[start]) start = readPref();
  if (!courses[start]) start = Object.keys(courses)[0];
  fillCourses(courses[start]._tier);
  sel.value = start;
  build(start);
  sel.addEventListener('change', function () {
    savePref(sel.value);
    try { history.replaceState(null, '', '#' + sel.value.toLowerCase()); } catch (e) {}
    build(sel.value);
  });
})();
