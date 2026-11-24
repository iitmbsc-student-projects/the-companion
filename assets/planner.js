/* The Companion: degree planner and CGPA.
   Rules live in data/degree.json (embedded). Grades stay in this browser and,
   when signed in, in public.degree_plans. A course's credits count once.
   Letter grades follow the grading document on this site (E and above pass). */
(function () {
  'use strict';

  var RULES = JSON.parse((document.getElementById('degree-rules') || { textContent: '{}' }).textContent);
  var CATALOG = JSON.parse((document.getElementById('degree-catalog') || { textContent: '[]' }).textContent);
  var BANDS = JSON.parse((document.getElementById('degree-bands') || { textContent: '{}' }).textContent);
  var S = window.CompanionSync;

  var CAT = {};
  CATALOG.forEach(function (c) { CAT[c.c] = c; });

  var GP = {};
  (BANDS.bands || []).forEach(function (b) { GP[b.grade] = b.gp; });
  if (BANDS.fail) GP[BANDS.fail.grade] = BANDS.fail.gp;
  var PASS = {};
  (BANDS.bands || []).forEach(function (b) { PASS[b.grade] = 1; });
  var GRADES = (BANDS.bands || []).map(function (b) { return b.grade; });
  if (BANDS.fail) GRADES.push(BANDS.fail.grade);

  var KEY = 'companion-degree-plan';
  var plan = { grades: {}, track: 'ba', nptel: 0, apprenticeship: 0 };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function lsGet(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
  }
  function credits(code) { return (CAT[code] && CAT[code].cr) || 0; }
  function isPass(code) { return !!PASS[plan.grades[code]]; }
  function prereqCodes(q) {
    return (String(q || '').match(/\b[A-Z]{2}\d{4}P?\b/g) || []);
  }
  function prereqsMet(code) {
    var missing = prereqCodes(CAT[code] && CAT[code].q).filter(function (p) { return !isPass(p); });
    return missing;
  }

  function trackOf(id) {
    var tracks = (RULES.diploma_ds && RULES.diploma_ds.tracks) || [];
    for (var i = 0; i < tracks.length; i++) if (tracks[i].id === id) return tracks[i];
    return tracks[0] || { id: 'ba', courses: [], label: '' };
  }

  function clampPlan(p) {
    p = p || {};
    var grades = {};
    var src = p.grades || {};
    Object.keys(src).forEach(function (code) {
      if (CAT[code] && GRADES.indexOf(src[code]) >= 0) grades[code] = src[code];
    });
    var track = p.track === 'dl' ? 'dl' : 'ba';
    var nptel = Math.max(0, Math.min(RULES.nptel_max || 8, parseInt(p.nptel, 10) || 0));
    var app = Math.max(0, Math.min(RULES.apprenticeship_max || 12, parseInt(p.apprenticeship, 10) || 0));
    return { grades: grades, track: track, nptel: nptel, apprenticeship: app };
  }

  /* Credits count once. Required stages claim their courses first; leftover
     passes fill BSc electives (8), then BS electives (28). NPTEL (max 8)
     tops up electives, BSc first. Apprenticeship (max 12) tops up BS only.
     PG credits are added only for passes not already counted in the 142. */
  function compute() {
    var used = {};
    function claim(codes) {
      var got = 0, missing = [], done = [];
      (codes || []).forEach(function (code) {
        if (!CAT[code]) { missing.push(code); return; }
        if (isPass(code)) {
          if (!used[code]) { used[code] = 1; got += credits(code); }
          done.push(code);
        } else missing.push(code);
      });
      var need = (codes || []).reduce(function (s, code) { return s + credits(code); }, 0);
      return { got: got, need: need, missing: missing, done: done, complete: missing.length === 0 && (codes || []).length > 0 };
    }
    function takeUpTo(codes, cap) {
      var got = 0, picked = [];
      codes.forEach(function (code) {
        if (used[code] || !isPass(code) || !CAT[code]) return;
        var cr = credits(code);
        if (got + cr <= cap) { used[code] = 1; got += cr; picked.push(code); }
      });
      return { got: got, picked: picked };
    }

    var foundation = claim(RULES.foundation);
    var dipProg = claim(RULES.diploma_programming);
    var dsTrack = trackOf(plan.track);
    var dsMan = claim(RULES.diploma_ds.mandatory);
    var dsOpt = claim(dsTrack.courses);
    var dipDs = {
      got: dsMan.got + dsOpt.got,
      need: dsMan.need + dsOpt.need,
      missing: dsMan.missing.concat(dsOpt.missing),
      complete: dsMan.complete && dsOpt.complete
    };
    var cores = claim(RULES.degree_core);

    var electivePool = [];
    Object.keys(CAT).forEach(function (code) {
      if (CAT[code].program === 'BS elective') electivePool.push(code);
    });
    if (plan.track === 'dl') {
      ['MS2001P', 'MS2002'].forEach(function (code) {
        if (CAT[code] && electivePool.indexOf(code) < 0) electivePool.push(code);
      });
    }
    electivePool.sort();
    var bscEl = takeUpTo(electivePool, RULES.bsc_elective_credits);
    var bsEl = takeUpTo(electivePool, RULES.bs_elective_credits);

    var bscGap = Math.max(0, RULES.bsc_elective_credits - bscEl.got);
    var bsGap = Math.max(0, RULES.bs_elective_credits - bsEl.got);
    var nptelLeft = plan.nptel;
    var nptelBsc = Math.min(nptelLeft, bscGap);
    nptelLeft -= nptelBsc;
    var nptelBs = Math.min(nptelLeft, bsGap);
    var appBs = Math.min(plan.apprenticeship, Math.max(0, bsGap - nptelBs));

    var pgCore = claim(RULES.pg_core);
    var pgEl = takeUpTo(RULES.pg_electives, RULES.pg_elective_credits);
    var pgPassedCredits = (RULES.pg_electives || []).reduce(function (s, code) {
      return s + (isPass(code) ? credits(code) : 0);
    }, 0);
    var mtech = claim(RULES.mtech);

    var courseCredits = 0;
    Object.keys(used).forEach(function (code) { courseCredits += credits(code); });
    var total = courseCredits + nptelBsc + nptelBs + appBs;

    var flags = {
      foundation: foundation.complete,
      one_diploma: foundation.complete && (dipProg.complete || dipDs.complete),
      both_diplomas: foundation.complete && dipProg.complete && dipDs.complete,
      bsc: false, bs: false, pg: false, mtech: false
    };
    flags.bsc = flags.both_diplomas && cores.complete && (bscEl.got + nptelBsc) >= RULES.bsc_elective_credits;
    flags.bs = flags.bsc && (bsEl.got + nptelBs + appBs) >= RULES.bs_elective_credits;
    flags.pg = flags.bs && pgCore.complete && pgPassedCredits >= RULES.pg_elective_credits;
    flags.mtech = flags.pg && mtech.complete;

    var num = 0, den = 0, counted = 0;
    Object.keys(plan.grades).forEach(function (code) {
      if (!CAT[code] || GP[plan.grades[code]] == null) return;
      num += GP[plan.grades[code]] * credits(code);
      den += credits(code);
      counted++;
    });

    var closed = [];
    if (plan.track === 'ba') {
      ['DA2001', 'DA2001P'].forEach(function (code) {
        if (isPass(code)) closed.push(code);
      });
    }

    return {
      used: used, foundation: foundation, dipProg: dipProg, dipDs: dipDs, dsTrack: dsTrack,
      cores: cores, bscEl: bscEl, bsEl: bsEl,
      nptelBsc: nptelBsc, nptelBs: nptelBs, appBs: appBs,
      pgCore: pgCore, pgEl: pgEl, pgPassedCredits: pgPassedCredits, mtech: mtech,
      total: total, flags: flags, cgpa: den ? num / den : null, gradedCredits: den, gradedCount: counted,
      closed: closed, electivePool: electivePool
    };
  }

  function nextUp(model) {
    function open(codes, gateOpen) {
      if (!gateOpen) return [];
      return (codes || []).filter(function (code) {
        return CAT[code] && !isPass(code) && prereqsMet(code).length === 0;
      });
    }
    if (!model.flags.foundation) return { label: 'Foundation', codes: open(RULES.foundation, true) };
    if (!model.dipProg.complete) return { label: 'Diploma in Programming', codes: open(RULES.diploma_programming, true) };
    if (!model.dipDs.complete) {
      return { label: 'Diploma in Data Science', codes: open(RULES.diploma_ds.mandatory.concat(model.dsTrack.courses), true) };
    }
    if (!model.cores.complete) return { label: 'Degree core', codes: open(RULES.degree_core, model.flags.both_diplomas) };
    if (!model.flags.bsc) return { label: 'BSc electives', codes: [] };
    if (!model.flags.bs) return { label: 'BS electives', codes: [] };
    if (!model.pgCore.complete) return { label: 'PG Diploma core', codes: open(RULES.pg_core, model.flags.bs) };
    if (model.pgPassedCredits < RULES.pg_elective_credits) return { label: 'PG Diploma electives', codes: open(RULES.pg_electives, model.flags.bs) };
    if (!model.mtech.complete) return { label: 'MTech project', codes: open(RULES.mtech, model.flags.pg) };
    return { label: 'Done', codes: [] };
  }

  var saveTimer;
  var LKEY = 'companion-planner-level';
  var level = '';
  try { level = localStorage.getItem(LKEY) || ''; } catch (e) { level = ''; }
  var electiveQuery = '';
  function persist() {
    plan = clampPlan(plan);
    try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch (e) {}
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (S && S.setDegreePlan) S.setDegreePlan(plan);
    }, 600);
  }

  function gradeSelect(code) {
    var sel = document.createElement('select');
    sel.className = 'pl-grade';
    sel.setAttribute('aria-label', 'Grade for ' + code);
    var blank = document.createElement('option');
    blank.value = ''; blank.textContent = '—';
    sel.appendChild(blank);
    GRADES.forEach(function (g) {
      var o = document.createElement('option');
      o.value = g; o.textContent = g;
      sel.appendChild(o);
    });
    sel.value = plan.grades[code] || '';
    sel.addEventListener('change', function () {
      if (sel.value) plan.grades[code] = sel.value;
      else delete plan.grades[code];
      persist();
      render();
    });
    return sel;
  }

  function courseRow(code, note) {
    var c = CAT[code];
    var row = el('div', 'pl-course' + (isPass(code) ? ' is-done' : ''));
    var meta = el('div', 'pl-c-meta');
    var codeEl = el('span', 'pl-code', code);
    meta.appendChild(codeEl);
    if (c && c.u) {
      var a = document.createElement('a');
      a.href = c.u; a.textContent = c.t;
      meta.appendChild(a);
    } else meta.appendChild(el('span', null, (c && c.t) || code));
    var sub = (c ? c.cr + ' cr' : '');
    if (note) sub += (sub ? ' · ' : '') + note;
    if (sub) meta.appendChild(el('span', 'pl-sub', sub));
    row.appendChild(meta);
    row.appendChild(gradeSelect(code));
    return row;
  }

  function passedCount(codes) {
    var n = 0;
    (codes || []).forEach(function (code) { if (isPass(code)) n++; });
    return n;
  }

  function render() {
    var y = window.scrollY;
    var model = compute();
    var root = $('pl-root');
    root.textContent = '';

    var summary = el('div', 'pl-top');
    var cg = el('div', 'pl-stat');
    cg.appendChild(el('span', 'pl-stat-k', 'CGPA'));
    cg.appendChild(el('span', 'pl-stat-v', model.cgpa == null ? '—' : (Math.round(model.cgpa * 100) / 100).toFixed(2)));
    cg.appendChild(el('span', 'pl-stat-s', model.gradedCount ? model.gradedCount + ' graded · ' + model.gradedCredits + ' cr in the average' : 'No grades yet'));
    summary.appendChild(cg);
    var cr = el('div', 'pl-stat');
    cr.appendChild(el('span', 'pl-stat-k', 'Credits counted'));
    cr.appendChild(el('span', 'pl-stat-v', String(model.total)));
    var nextMs = (RULES.milestones || []).filter(function (m) { return !model.flags[m.id] || model.total < m.credits; })[0];
    var stat = 'Every listed exit is covered';
    if (nextMs) {
      var gap = nextMs.credits - model.total;
      if (!model.flags[nextMs.id] && gap <= 0) stat = 'Credit total is enough, but a course requirement for ' + nextMs.label + ' is still open';
      else if (gap > 0 && model.flags[nextMs.id]) stat = gap + ' credits short of ' + nextMs.label + ' because some of its courses were already counted earlier';
      else stat = Math.max(0, gap) + ' credits to ' + nextMs.label;
    }
    cr.appendChild(el('span', 'pl-stat-s', stat));
    summary.appendChild(cr);
    var miles = el('ol', 'pl-miles');
    (RULES.milestones || []).forEach(function (m) {
      var li = el('li', model.flags[m.id] ? 'is-on' : '');
      li.textContent = m.label.replace(' certificate', '').replace('Foundation + ', '') + ' ' + m.credits;
      li.title = m.label + ', ' + m.credits + ' credits';
      miles.appendChild(li);
    });
    summary.appendChild(miles);
    root.appendChild(summary);

    var nxt = nextUp(model);
    if (model.cgpa != null && model.flags.bs && RULES.pg_cgpa_min) {
      var okc = model.cgpa >= RULES.pg_cgpa_min;
      root.appendChild(el('p', 'pl-detail pl-cgpa-note', (okc ? 'CGPA is at or above ' : 'CGPA is under ') + RULES.pg_cgpa_min + ', the published line for applying to the PG Diploma.'));
    }

    if (model.closed.length) {
      root.appendChild(el('p', 'pl-warn', 'Option 1 is selected, so ' + model.closed.join(' and ') + ' do not add credits. The academics page says that pair stays closed after Business Analytics.'));
    }

    function rows(codes, noteFor) {
      var box = el('div', 'pl-courses');
      (codes || []).forEach(function (code) { box.appendChild(courseRow(code, noteFor ? noteFor(code) : '')); });
      return box;
    }
    function group(label, node) {
      var g = el('div', 'pl-group');
      if (label) g.appendChild(el('span', 'pl-k', label));
      g.appendChild(node);
      return g;
    }
    function trackPicker() {
      var trackBox = el('div', 'pl-tracks');
      trackBox.appendChild(el('span', 'pl-k', 'Diploma in Data Science track'));
      (RULES.diploma_ds.tracks || []).forEach(function (t) {
        var lab = el('label', 'pl-track' + (plan.track === t.id ? ' is-on' : ''));
        var inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'ds-track'; inp.value = t.id; inp.checked = plan.track === t.id;
        inp.addEventListener('change', function () { plan.track = t.id; persist(); render(); });
        lab.appendChild(inp);
        var tx = el('span');
        tx.appendChild(el('b', null, t.label));
        tx.appendChild(el('span', 'pl-detail', t.detail || ''));
        lab.appendChild(tx);
        trackBox.appendChild(lab);
      });
      return trackBox;
    }
    function transferFields() {
      var transfers = el('div', 'pl-transfers');
      function numField(label, key, max) {
        var lab = el('label', 'pl-transfer');
        lab.appendChild(el('span', null, label));
        var inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.max = String(max); inp.step = '1';
        inp.value = String(plan[key]);
        inp.addEventListener('change', function () {
          plan[key] = Math.max(0, Math.min(max, parseInt(inp.value, 10) || 0));
          inp.value = String(plan[key]);
          persist(); render();
        });
        lab.appendChild(inp);
        lab.appendChild(el('span', 'pl-sub', '0–' + max + ', not in CGPA'));
        return lab;
      }
      transfers.appendChild(numField('NPTEL credits', 'nptel', RULES.nptel_max || 8));
      transfers.appendChild(numField('Apprenticeship credits', 'apprenticeship', RULES.apprenticeship_max || 12));
      return transfers;
    }
    function electivesBody() {
      var elNote = 'The first ' + RULES.bsc_elective_credits + ' credits count toward the BSc (' + model.bscEl.got + ' so far), the next ' +
        RULES.bs_elective_credits + ' toward the BS (' + model.bsEl.got + ' so far).';
      var electiveRows = rows(model.electivePool);
      var filter = document.createElement('input');
      filter.type = 'search'; filter.className = 'pl-filter'; filter.placeholder = 'Filter electives';
      filter.setAttribute('aria-label', 'Filter electives');
      filter.value = electiveQuery;
      filter.addEventListener('input', function () {
        electiveQuery = filter.value;
        var q = electiveQuery.trim().toLowerCase();
        [].forEach.call(electiveRows.children, function (row) {
          row.hidden = q && row.textContent.toLowerCase().indexOf(q) < 0;
        });
      });
      if (electiveQuery) filter.dispatchEvent(new Event('input'));
      return [el('p', 'pl-detail', elNote), group('Transferred credits', transferFields()), filter, electiveRows];
    }

    /* ---- Levels: pick one from the dropdown, see only its courses ---- */
    var dsCodes = RULES.diploma_ds.mandatory.concat(model.dsTrack.courses);
    var pgCodes = (RULES.pg_core || []).concat(RULES.pg_electives || []);
    var LEVELS = [
      { id: 'foundation', label: 'Foundation', stage: ['Foundation'], codes: RULES.foundation,
        detail: '32 credits. Both diplomas open once these are passed.',
        body: function () { return [rows(RULES.foundation)]; } },
      { id: 'dip-prog', label: 'Diploma in Programming', stage: ['Diploma in Programming'], codes: RULES.diploma_programming,
        detail: '27 credits.',
        body: function () { return [rows(RULES.diploma_programming)]; } },
      { id: 'dip-ds', label: 'Diploma in Data Science', stage: ['Diploma in Data Science'], codes: dsCodes,
        detail: '21 credits required, plus the 6-credit track.',
        body: function () {
          return [trackPicker(), group('Required', rows(RULES.diploma_ds.mandatory)), group('Your track', rows(model.dsTrack.courses))];
        } },
      { id: 'core', label: 'BSc degree core', stage: ['Degree core'], codes: RULES.degree_core,
        detail: '20 credits inside the BSc. Needs both diplomas.',
        body: function () { return [rows(RULES.degree_core)]; } },
      { id: 'electives', label: 'Degree electives (BSc and BS)', stage: ['BSc electives', 'BS electives'], codes: model.electivePool,
        detail: '', body: electivesBody },
      { id: 'pg', label: 'PG Diploma', stage: ['PG Diploma core', 'PG Diploma electives'], codes: pgCodes,
        detail: 'After the BS. A course already counted above is not added again.',
        body: function () { return [group('Core', rows(RULES.pg_core)), group('Electives', rows(RULES.pg_electives))]; } },
      { id: 'mtech', label: 'MTech', stage: ['MTech project'], codes: RULES.mtech,
        detail: '20-credit project, after the PG Diploma.',
        body: function () { return [rows(RULES.mtech)]; } }
    ];
    function levelById(id) {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i];
      return null;
    }
    function levelForStage(label) {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].stage.indexOf(label) >= 0) return LEVELS[i];
      return null;
    }
    function creditsOf(codes, passedOnly) {
      return (codes || []).reduce(function (n, code) { return n + (!passedOnly || isPass(code) ? credits(code) : 0); }, 0);
    }
    if (!levelById(level)) { var firstOpen = levelForStage(nxt.label); level = (firstOpen || LEVELS[0]).id; }
    var cur = levelById(level);
    var idx = LEVELS.indexOf(cur);

    var bar = el('div', 'pl-bar');
    var lv = el('label', 'pl-lv');
    lv.appendChild(el('span', 'pl-k', 'Level'));
    var sel = document.createElement('select');
    sel.className = 'pl-select';
    LEVELS.forEach(function (L) {
      var o = document.createElement('option');
      o.value = L.id;
      var pc = passedCount(L.codes);
      o.textContent = L.label + (L.id === 'electives' ? '  ·  ' + (model.bscEl.got + model.bsEl.got) + ' cr' : '  ·  ' + pc + '/' + (L.codes || []).length);
      sel.appendChild(o);
    });
    sel.value = level;
    sel.addEventListener('change', function () { level = sel.value; try { localStorage.setItem(LKEY, level); } catch (e) {} render(); });
    lv.appendChild(sel);
    bar.appendChild(lv);
    var steps = el('div', 'pl-steps');
    function stepBtn(text, target) {
      var b = el('button', 'pl-step', text);
      b.type = 'button';
      b.disabled = !target;
      if (target) b.addEventListener('click', function () { level = target.id; try { localStorage.setItem(LKEY, level); } catch (e) {} render(); });
      return b;
    }
    steps.appendChild(stepBtn('← Previous', LEVELS[idx - 1]));
    steps.appendChild(stepBtn('Next →', LEVELS[idx + 1]));
    bar.appendChild(steps);
    root.appendChild(bar);

    var panel = el('section', 'pl-panel');
    panel.appendChild(el('h2', 'pl-panel-t', cur.label));
    var total = (cur.codes || []).length;
    var done = passedCount(cur.codes);
    if (cur.id === 'electives') {
      var cap = RULES.bsc_elective_credits + RULES.bs_elective_credits;
      var got = model.bscEl.got + model.bsEl.got + model.nptelBsc + model.nptelBs + model.appBs;
      panel.appendChild(el('p', 'pl-prog-t', got + ' of ' + cap + ' elective credits placed'));
      var pb0 = el('div', 'pl-prog'); var pf0 = el('span');
      pf0.style.width = Math.min(100, Math.round(got / cap * 100)) + '%';
      pb0.appendChild(pf0); panel.appendChild(pb0);
    } else {
      panel.appendChild(el('p', 'pl-prog-t', done + ' of ' + total + ' courses passed · ' + creditsOf(cur.codes, true) + ' of ' + creditsOf(cur.codes, false) + ' credits'));
      var pb = el('div', 'pl-prog'); var pf = el('span');
      pf.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
      pb.appendChild(pf); panel.appendChild(pb);
    }
    if (cur.detail) panel.appendChild(el('p', 'pl-detail', cur.detail));
    cur.body().forEach(function (n) { panel.appendChild(n); });
    root.appendChild(panel);

    var clear = el('p', 'pl-clear');
    var btn = el('button', 'sb-link', 'Clear grades in this browser');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      if (!confirm('Clear every grade, the track and the transferred credits?')) return;
      plan = { grades: {}, track: 'ba', nptel: 0, apprenticeship: 0 };
      persist();
      render();
    });
    clear.appendChild(btn);
    root.appendChild(clear);
    window.scrollTo(0, y);
  }

  function boot(saved) {
    if (saved) plan = clampPlan(saved);
    else {
      var local = lsGet(KEY);
      if (local) plan = clampPlan(local);
    }
    render();
  }

  if (S && S.getDegreePlan) {
    Promise.resolve(S.ready).then(function () { return S.getDegreePlan(); }).then(boot).catch(function () { boot(null); });
  } else boot(null);
})();
