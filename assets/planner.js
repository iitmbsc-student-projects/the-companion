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
  var openStages = {};
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
    var miss = c ? prereqsMet(code) : [];
    if (miss.length && !isPass(code)) sub += (sub ? ' · ' : '') + 'after ' + miss.join(', ');
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

  function section(id, title, detail, body, startOpen) {
    var box = el('details', 'pl-stage');
    box.open = openStages[id] != null ? openStages[id] : !!startOpen;
    box.addEventListener('toggle', function () { openStages[id] = box.open; });
    var sum = el('summary');
    sum.appendChild(el('span', 'pl-stage-t', title));
    box.appendChild(sum);
    if (detail) box.appendChild(el('p', 'pl-detail', detail));
    body.forEach(function (n) { box.appendChild(n); });
    return box;
  }

  function render() {
    var y = window.scrollY;
    var model = compute();
    var root = $('pl-root');
    root.textContent = '';

    var summary = el('div', 'pl-summary');
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
    root.appendChild(summary);

    var miles = el('ol', 'pl-miles');
    (RULES.milestones || []).forEach(function (m) {
      var li = el('li', model.flags[m.id] ? 'is-on' : '');
      li.textContent = m.label.replace(' certificate', '').replace('Foundation + ', '') + ' ' + m.credits;
      li.title = m.label + ', ' + m.credits + ' credits';
      miles.appendChild(li);
    });
    root.appendChild(miles);

    var nxt = nextUp(model);
    var nextBox = el('div', 'pl-next');
    nextBox.appendChild(el('h2', null, nxt.label === 'Done' ? 'Nothing left on this path' : 'Open next · ' + nxt.label));
    if (nxt.codes.length) {
      var ul = el('ul', 'pl-next-list');
      nxt.codes.slice(0, 8).forEach(function (code) {
        var c = CAT[code];
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = c.u; a.textContent = code + ' · ' + c.t;
        li.appendChild(a);
        ul.appendChild(li);
      });
      nextBox.appendChild(ul);
    } else if (nxt.label === 'BSc electives' || nxt.label === 'BS electives') {
      var gap = nxt.label === 'BSc electives'
        ? RULES.bsc_elective_credits - model.bscEl.got - model.nptelBsc
        : RULES.bs_elective_credits - model.bsEl.got - model.nptelBs - model.appBs;
      nextBox.appendChild(el('p', null, Math.max(0, gap) + ' elective credits still to place. Any degree elective works; the first 8 count toward the BSc and the next 28 toward the BS.'));
    } else if (nxt.label !== 'Done') {
      nextBox.appendChild(el('p', null, 'Finish the course that unlocks the rest of this stage, or set a grade above.'));
    }
    if (model.cgpa != null && model.flags.bs && RULES.pg_cgpa_min) {
      var ok = model.cgpa >= RULES.pg_cgpa_min;
      nextBox.appendChild(el('p', 'pl-detail', (ok ? 'CGPA is at or above ' : 'CGPA is under ') + RULES.pg_cgpa_min + ', the published line for applying to the PG Diploma.'));
    }
    root.appendChild(nextBox);

    if (model.closed.length) {
      root.appendChild(el('p', 'pl-warn', 'Option 1 is selected, so ' + model.closed.join(' and ') + ' do not add credits. The academics page says that pair stays closed after Business Analytics.'));
    }

    var trackBox = el('div', 'pl-tracks');
    trackBox.appendChild(el('span', 'pl-k', 'Diploma in Data Science track'));
    (RULES.diploma_ds.tracks || []).forEach(function (t) {
      var lab = el('label', 'pl-track' + (plan.track === t.id ? ' is-on' : ''));
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = 'ds-track'; inp.value = t.id; inp.checked = plan.track === t.id;
      inp.addEventListener('change', function () {
        plan.track = t.id; persist(); render();
      });
      lab.appendChild(inp);
      var tx = el('span');
      tx.appendChild(el('b', null, t.label));
      tx.appendChild(el('span', 'pl-detail', t.detail || ''));
      lab.appendChild(tx);
      trackBox.appendChild(lab);
    });
    root.appendChild(trackBox);

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
    root.appendChild(transfers);

    function rows(codes, noteFor) {
      var box = el('div', 'pl-courses');
      (codes || []).forEach(function (code) { box.appendChild(courseRow(code, noteFor ? noteFor(code) : '')); });
      return box;
    }

    var active = nxt.label;
    function stageTitle(name, codes) {
      return name + '  ' + passedCount(codes) + '/' + (codes || []).length;
    }
    root.appendChild(section('foundation', stageTitle('Foundation', RULES.foundation),
      '32 credits. Both diplomas open once these are passed.',
      [rows(RULES.foundation)], active === 'Foundation' || !model.gradedCount));
    root.appendChild(section('dip-prog', stageTitle('Diploma in Programming', RULES.diploma_programming),
      '27 credits.',
      [rows(RULES.diploma_programming)], active === 'Diploma in Programming'));
    var dsCodes = RULES.diploma_ds.mandatory.concat(model.dsTrack.courses);
    root.appendChild(section('dip-ds', stageTitle('Diploma in Data Science', dsCodes),
      '21 credits required, plus the 6-credit track above.',
      [rows(RULES.diploma_ds.mandatory), rows(model.dsTrack.courses)],
      active === 'Diploma in Data Science'));
    root.appendChild(section('core', stageTitle('Degree core', RULES.degree_core),
      '20 credits inside the BSc. Needs both diplomas.',
      [rows(RULES.degree_core)], active === 'Degree core'));

    var elNote = 'The first ' + RULES.bsc_elective_credits + ' credits count toward the BSc (' + model.bscEl.got + ' so far), the next ' +
      RULES.bs_elective_credits + ' toward the BS (' + model.bsEl.got + ' so far).';
    var electiveCodes = model.electivePool.slice();
    var electiveRows = rows(electiveCodes);
    var filter = document.createElement('input');
    filter.type = 'search'; filter.className = 'pl-filter'; filter.placeholder = 'Filter electives';
    filter.value = electiveQuery;
    filter.addEventListener('input', function () {
      electiveQuery = filter.value;
      var q = electiveQuery.trim().toLowerCase();
      [].forEach.call(electiveRows.children, function (row) {
        row.hidden = q && row.textContent.toLowerCase().indexOf(q) < 0;
      });
    });
    if (electiveQuery) filter.dispatchEvent(new Event('input'));
    root.appendChild(section('electives', 'Degree electives  ' + model.bscEl.got + '+' + model.bsEl.got + ' cr',
      elNote, [filter, electiveRows], active === 'BSc electives' || active === 'BS electives'));

    var pgCodes = (RULES.pg_core || []).concat(RULES.pg_electives || []);
    root.appendChild(section('pg', stageTitle('PG Diploma', pgCodes),
      'After the BS. A course already counted above is not added again.',
      [rows(RULES.pg_core), rows(RULES.pg_electives)],
      active === 'PG Diploma core' || active === 'PG Diploma electives'));
    root.appendChild(section('mtech', stageTitle('MTech', RULES.mtech),
      '20-credit project, after the PG Diploma.',
      [rows(RULES.mtech)], active === 'MTech project'));

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
