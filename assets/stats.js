/* The Companion: visitor counts, course views, and ratings.
   Does nothing when assets/config.js has no server. Every page load counts as
   a visit, including a refresh. A person is counted once. A course view counts
   once per person per day. Ratings need a sign-in: one rating per person per course. */
(function () {
  'use strict';
  if (window.__companionStats) return;
  window.__companionStats = true;

  var CFG = window.COMPANION_CONFIG || {};
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) return;

  var COURSE = (window.COURSE && /^[A-Z]{2,3}[0-9]{4}P?$/.test(window.COURSE.code))
    ? window.COURSE.code : null;
  var FULL = document.body.getAttribute('data-page') === 'courses';

  var css = document.createElement('style');
  css.textContent = [
    '.cs-stats{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:10px}',
    '.cs-views,.cs-avg{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.03em;color:var(--ink-2,#4a453d)}',
    '.cs-stars{display:inline-flex;gap:1px}',
    '.cs-stars button{width:22px;height:22px;padding:0;border:none;background:transparent;color:var(--rule,#c9c1b0);font:16px/1 "IBM Plex Sans",sans-serif;cursor:pointer}',
    '.cs-stars button.on{color:var(--accent,#7a1e28)}',
    '.cs-stars button:focus-visible{outline:2px solid var(--accent,#7a1e28);outline-offset:1px}',
    '.cs-level{font-family:"IBM Plex Mono",monospace;letter-spacing:.04em}',
    '.res-rate{display:flex;align-items:center;gap:6px;margin-top:8px}',
    '.res-rate .cs-stars button{width:16px;height:16px;font-size:13px}',
    '.res-rate .cs-avg{font-size:11px}',
    'ol.courses li .cs-level{margin-left:6px;font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.04em;color:var(--ink-2,#4a453d)}',
    '.tk{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 14px;font-family:"IBM Plex Mono",monospace;color:var(--ink-2,#4a453d)}',
    '.tk-g{display:inline-flex;align-items:center;gap:7px}',
    '.tk-l{font-size:10px;letter-spacing:.12em;text-transform:uppercase}',
    '.tk-d{display:inline-flex;gap:2px}',
    '.tk-n{display:inline-block;min-width:13px;padding:2px 2px;border:1px solid var(--rule,#c9c1b0);border-radius:3px;background:var(--paper,#fbf8f1);',
    'color:var(--ink,#1c1a17);font-size:12px;font-weight:500;line-height:1.25;text-align:center;font-variant-numeric:tabular-nums}',
    '.tk-n.z{color:var(--rule,#c9c1b0)}'
  ].join('');
  document.head.appendChild(css);

  var LEVEL_NAME = { 1: 'Foundation', 2: 'Diploma', 3: 'Degree', 4: 'Elective', 5: 'PG Diploma', 6: 'PG' };

  function courseLevel(code) {
    var m = String(code || '').match(/(\d)/);
    return m ? +m[1] : 0;
  }

  function paintMarks() {
    var head = document.querySelector('.course-head');
    if (head && COURSE) {
      var n = courseLevel(COURSE);
      var kick = head.querySelector('.kicker');
      if (kick && n && !kick.querySelector('.cs-level')) {
        var s = document.createElement('span');
        s.className = 'cs-level';
        s.textContent = 'Level ' + n;
        s.title = (LEVEL_NAME[n] || 'Course level') + '. Taken from the first digit of the course code.';
        kick.appendChild(document.createTextNode(' · '));
        kick.appendChild(s);
      }
    }
    document.querySelectorAll('ol.courses > li .code').forEach(function (codeEl) {
      if (codeEl.querySelector('.cs-level')) return;
      var n = courseLevel(codeEl.textContent);
      if (!n) return;
      var s = document.createElement('span');
      s.className = 'cs-level';
      s.textContent = 'L' + n;
      s.title = 'Level ' + n + (LEVEL_NAME[n] ? ' · ' + LEVEL_NAME[n] : '');
      codeEl.appendChild(s);
    });
  }

  function starButtons(host, aria, onPick) {
    var wrap = document.createElement('span');
    wrap.className = 'cs-stars';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', aria);
    var hoverN = 0, mineN = 0;
    function paint() {
      var show = hoverN || mineN;
      Array.prototype.forEach.call(wrap.children, function (b) {
        b.classList.toggle('on', +b.getAttribute('data-n') <= show);
      });
    }
    wrap.addEventListener('mouseleave', function () { hoverN = 0; paint(); });
    for (var i = 1; i <= 5; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '★';
      b.setAttribute('data-n', String(i));
      b.setAttribute('aria-label', i + (i === 1 ? ' star' : ' stars'));
      b.addEventListener('mouseenter', function (ev) { hoverN = +ev.currentTarget.getAttribute('data-n'); paint(); });
      b.addEventListener('click', function (ev) { onPick(+ev.currentTarget.getAttribute('data-n')); });
      wrap.appendChild(b);
    }
    host.appendChild(wrap);
    return {
      set: function (n) { mineN = n || 0; paint(); },
      buttons: function () { return wrap.children; }
    };
  }

  var resourceRows = null;

  function refreshResources(client) {
    if (!resourceRows || !resourceRows.length) return;
    client.rpc('resource_scores', { p_urls: resourceRows.map(function (row) { return row.url; }) }).then(function (r) {
      var by = {};
      if (!r.error && r.data) r.data.forEach(function (row) { by[row.url] = row; });
      resourceRows.forEach(function (row) { row.apply(by[row.url] || null); });
    });
  }

  function mountResources(client) {
    if (!COURSE) return;
    if (resourceRows) { refreshResources(client); return; }
    var urls = [];
    var rows = [];
    document.querySelectorAll('.res-card').forEach(function (card) {
      var link = card.querySelector('a.res-main');
      if (!link || card.querySelector('.res-rate')) return;
      var url = link.href;
      if (!/^https?:\/\//.test(url) || url.length > 500) return;
      var line = document.createElement('div');
      line.className = 'res-rate';
      var avg = document.createElement('span');
      avg.className = 'cs-avg';
      avg.textContent = 'Sign in to rate';
      var stars = starButtons(line, 'Rate this resource from 1 to 5', function (n) {
        var auth = window.CompanionAuth;
        if (!auth || !auth.user) { if (auth) auth.signIn(); return; }
        stars.set(n);
        client.rpc('rate_resource', { p_course: COURSE, p_url: url, p_stars: n }).then(function (r) {
          if (r.error || !r.data) return;
          apply(r.data);
        });
      });
      line.appendChild(avg);
      card.appendChild(line);
      function apply(data) {
        stars.set((data && data.my_stars) || 0);
        var signed = window.CompanionAuth && CompanionAuth.user;
        Array.prototype.forEach.call(stars.buttons(), function (b) {
          b.title = signed ? 'Rate ' + b.getAttribute('data-n') : 'Sign in to rate';
        });
        avg.textContent = data && data.rating_count
          ? data.rating_avg + ' · ' + people(data.rating_count, 'rating', 'ratings')
          : (signed ? 'Rate this' : 'Sign in to rate');
      }
      urls.push(url);
      rows.push({ url: url, apply: apply });
    });
    if (!urls.length) return;
    resourceRows = rows;
    refreshResources(client);
  }

  function visitorId() {
    var key = 'companion-visitor';
    try {
      var id = localStorage.getItem(key);
      if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id;
      id = (crypto.randomUUID && crypto.randomUUID()) || fallbackUuid();
      localStorage.setItem(key, id);
      return id;
    } catch (e) {
      return fallbackUuid();
    }
  }
  function fallbackUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function num(n) {
    return (n || 0).toLocaleString('en-IN');
  }
  function people(n, one, many) {
    n = n || 0;
    return num(n) + ' ' + (n === 1 ? one : many);
  }

  var viewsEl, starsEl, avgEl, mine = 0, hover = 0;

  function paintStars() {
    if (!starsEl) return;
    var show = hover || mine;
    Array.prototype.forEach.call(starsEl.children, function (b) {
      b.classList.toggle('on', +b.getAttribute('data-n') <= show);
    });
  }

  function mountCourse() {
    var head = document.querySelector('.course-head');
    if (!head || !COURSE) return;
    var box = document.createElement('div');
    box.className = 'cs-stats';
    viewsEl = document.createElement('span');
    viewsEl.className = 'cs-views';
    viewsEl.textContent = '— views';
    var rate = document.createElement('span');
    rate.className = 'cs-rate';
    starsEl = document.createElement('span');
    starsEl.className = 'cs-stars';
    starsEl.setAttribute('role', 'group');
    starsEl.setAttribute('aria-label', 'Rate this course from 1 to 5');
    starsEl.addEventListener('mouseleave', function () { hover = 0; paintStars(); });
    for (var i = 1; i <= 5; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '★';
      b.setAttribute('data-n', String(i));
      b.setAttribute('aria-label', i + (i === 1 ? ' star' : ' stars'));
      b.addEventListener('mouseenter', function (ev) { hover = +ev.currentTarget.getAttribute('data-n'); paintStars(); });
      b.addEventListener('click', onRate);
      starsEl.appendChild(b);
    }
    avgEl = document.createElement('span');
    avgEl.className = 'cs-avg';
    rate.appendChild(starsEl);
    rate.appendChild(document.createTextNode(' '));
    rate.appendChild(avgEl);
    box.appendChild(viewsEl);
    box.appendChild(rate);
    head.appendChild(box);
  }

  function paintCourse(data) {
    if (!viewsEl || !data) return;
    var views = data.views || 0;
    viewsEl.textContent = people(views, 'view', 'views');
    mine = data.my_stars || 0;
    paintStars();
    var signed = window.CompanionAuth && CompanionAuth.user;
    Array.prototype.forEach.call(starsEl.children, function (b) {
      b.title = signed ? 'Rate ' + b.getAttribute('data-n') : 'Sign in to rate';
    });
    if (data.rating_count) {
      avgEl.textContent = data.rating_avg + ' from ' + people(data.rating_count, 'rating', 'ratings');
    } else {
      avgEl.textContent = signed ? 'Be the first to rate' : 'Sign in to rate';
    }
  }

  function onRate(ev) {
    var n = +ev.currentTarget.getAttribute('data-n');
    var auth = window.CompanionAuth;
    if (!auth || !auth.client) return;
    if (!auth.user) { auth.signIn(); return; }
    mine = n;
    paintStars();
    auth.client.rpc('rate_course', { p_course: COURSE, p_stars: n }).then(function (r) {
      if (r.error) { mine = 0; paintStars(); return; }
      paintCourse(r.data);
    });
  }

  /* A small odometer: each number is a row of digit tiles that count up once. */
  function digits(el, n, len) {
    var str = String(n);
    while (str.length < len) str = '0' + str;
    el.textContent = '';
    var lead = true;
    for (var i = 0; i < str.length; i++) {
      var t = document.createElement('span');
      var zero = str.charAt(i) === '0' && lead && i < str.length - 1;
      if (str.charAt(i) !== '0') lead = false;
      t.className = 'tk-n' + (zero ? ' z' : '');
      t.textContent = str.charAt(i);
      el.appendChild(t);
    }
  }
  function roll(el, n) {
    var len = String(n).length;
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || n < 10 || !window.requestAnimationFrame) { digits(el, n, len); return; }
    var t0 = null;
    (function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 1100);
      digits(el, Math.round(n * (1 - Math.pow(1 - k, 3))), len);
      if (k < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  function ticker(data) {
    var wrap = document.createElement('span');
    wrap.className = 'tk se-stats';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', people(data.visitors, 'visitor', 'visitors') + ', ' + people(data.visits, 'visit', 'visits'));
    [['Visitors', data.visitors], ['Visits', data.visits]].forEach(function (pair) {
      var g = document.createElement('span');
      g.className = 'tk-g';
      var l = document.createElement('span');
      l.className = 'tk-l';
      l.textContent = pair[0];
      var d = document.createElement('span');
      d.className = 'tk-d';
      d.setAttribute('aria-hidden', 'true');
      g.appendChild(l);
      g.appendChild(d);
      wrap.appendChild(g);
      roll(d, pair[1] || 0);
    });
    return wrap;
  }

  function paintTotals(data) {
    if (!data) return;
    var brand = document.querySelector('.site-end .se-brand, .colophon .co-brand');
    if (brand && !brand.querySelector('.se-stats')) brand.appendChild(ticker(data));
    var hint = document.querySelector('.hm-hint');
    if (hint && data.popular && data.popular.length && !document.getElementById('hm-pop')) {
      var pop = document.createElement('p');
      pop.className = 'hm-pop';
      pop.id = 'hm-pop';
      pop.appendChild(document.createTextNode('Most opened '));
      data.popular.forEach(function (row, i) {
        if (i) pop.appendChild(document.createTextNode(' · '));
        var a = document.createElement('a');
        var known = window.HOME_COURSES && HOME_COURSES[row.code];
        a.href = known ? known.u : ('courses/' + row.code.toLowerCase() + '.html');
        a.textContent = row.code;
        a.title = (known ? known.t + ' · ' : '') + people(row.views, 'view', 'views') +
          (row.rating_count ? ' · ' + row.rating_avg + ' stars' : '');
        pop.appendChild(a);
      });
      hint.parentNode.insertBefore(pop, hint.nextSibling);
    }
    if (FULL && data.courses) {
      var byCode = {};
      data.courses.forEach(function (row) { byCode[row.code] = row; });
      document.querySelectorAll('ol.courses > li').forEach(function (li) {
        var codeEl = li.querySelector('.code');
        var credits = li.querySelector('.credits');
        if (!codeEl || !credits || credits.querySelector('.cs-mini')) return;
        var row = byCode[(codeEl.textContent || '').trim()];
        if (!row || (!row.views && !row.rating_count)) return;
        var s = document.createElement('span');
        s.className = 'cs-mini';
        var bits = [];
        if (row.rating_count) bits.push(row.rating_avg + ' ★');
        if (row.views) bits.push(people(row.views, 'view', 'views'));
        s.textContent = bits.join(' · ');
        credits.appendChild(s);
      });
    }
  }

  function pull(client) {
    return client.rpc('record_traffic', {
      p_visitor: visitorId(),
      p_course: COURSE,
      p_full: FULL
    }).then(function (r) {
      if (r.error || !r.data) return;
      paintTotals(r.data);
      paintCourse(r.data);
    });
  }

  function start(client) {
    mountCourse();
    mountResources(client);
    pull(client);
    if (window.CompanionAuth && CompanionAuth.onChange) {
      var first = true;
      CompanionAuth.onChange(function () {
        if (first) { first = false; return; }
        pull(client);
        mountResources(client);
      });
    }
  }

  paintMarks();

  var auth = window.CompanionAuth;
  if (auth && auth.ready) {
    auth.ready.then(function (client) { if (client) start(client); });
  }
})();
