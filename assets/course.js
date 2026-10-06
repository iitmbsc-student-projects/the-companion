// The Companion: behaviour for every course page (sidebar, lecture player, progress, routing).
// Shared by all courses. The only per-course input is window.COURSE = {code, weeks}, set inline in each page.
// Per-lecture data sourced from the course's lecture playlist
// (title, YouTube video id, direct slide link) — not the generic autoplay playlist.
const WEEKS_DATA = window.COURSE.weeks;

const navSection = document.getElementById('lecture-nav');
const navDashboard = document.getElementById('nav-dashboard');
const panelDashboard = document.getElementById('panel-dashboard');
const panelLecture = document.getElementById('panel-lecture');
const navSyllabus = document.getElementById('nav-syllabus');
const panelSyllabus = document.getElementById('panel-syllabus');
const extraNavs = Array.from(document.querySelectorAll('[data-extra]'));
const extraPanels = Array.from(document.querySelectorAll('.extra-panel'));
function clearExtras(){
  extraNavs.forEach(el => el.classList.remove('active'));
  extraPanels.forEach(el => el.classList.remove('active'));
}
const frame = document.getElementById('video-frame');
const emptyOverlay = document.getElementById('video-empty');
const eyebrow = document.getElementById('current-eyebrow');
const titleEl = document.getElementById('current-title');
const actions = document.getElementById('current-actions');

// Quiz/end-term coverage for the Calendar section is pulled live from the shared
// term-syllabus.js file (single source of truth for every course page) —
// update the term data there and every course page picks it up automatically.
(function(){
  const COURSE_CODE = window.COURSE.code;
  const T = window.TERM_SYLLABUS;
  const d = T && T.courses && T.courses[COURSE_CODE];
  const noteEl = document.getElementById('calendar-term-note');
  function fill(whatId, whenId, label, part){
    const whatEl = document.getElementById(whatId), whenEl = document.getElementById(whenId);
    if (!whatEl || !whenEl) return;
    if (!part || !part.held){
      whatEl.textContent = label;
      whenEl.textContent = 'Not held this term';
    } else {
      whatEl.textContent = `${label} — covers ${part.weeks}`;
      whenEl.textContent = part.mode;
    }
  }
  if (d){
    fill('cal-q1-what','cal-q1-when','Quiz 1', d.quiz1);
    fill('cal-q2-what','cal-q2-when','Quiz 2', d.quiz2);
    fill('cal-et-what','cal-et-when','End-term examination', d.endterm);
    if (noteEl) noteEl.textContent = `Coverage per the ${T.term} term quiz-syllabus circular.`;
  } else if (noteEl) {
    noteEl.textContent = 'Quiz/end-term coverage not published yet for this course.';
  }
})();

// Each week is a real Bootstrap accordion item: data-bs-toggle/data-bs-target/data-bs-parent
// drive the actual expand/collapse (with Bootstrap's own animation and ARIA state syncing),
// in place of the hand-rolled openWeek/toggleWeek toggling this used before.
WEEKS_DATA.forEach((week, wi) => {
  const collapseId = `week-collapse-${wi}`;
  const isFirst = false;   // every week starts collapsed

  const group = document.createElement('div');
  group.className = 'week-group accordion-item';
  group.dataset.w = wi;

  const h = document.createElement('h2');
  h.className = 'accordion-header';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'week-title accordion-button' + (isFirst ? '' : ' collapsed');
  btn.setAttribute('data-bs-toggle', 'collapse');
  btn.setAttribute('data-bs-target', `#${collapseId}`);
  btn.setAttribute('aria-expanded', isFirst ? 'true' : 'false');
  btn.setAttribute('aria-controls', collapseId);
  btn.innerHTML = `<span>${week.w}</span><span class="chev">›</span><i class="wbar"></i>`;
  h.appendChild(btn);
  group.appendChild(h);

  const collapseWrap = document.createElement('div');
  collapseWrap.id = collapseId;
  collapseWrap.className = 'accordion-collapse collapse' + (isFirst ? ' show' : '');

  const body = document.createElement('div');
  body.className = 'accordion-body';
  body.innerHTML = '<div class="wk-actions"><button type="button" class="sb-link wk-act"></button></div>';
  week.items.forEach((item, ii) => {
    const row = document.createElement('div');
    row.className = 'lecture-item' + (item.v ? '' : ' novid');
    row.dataset.w = wi; row.dataset.i = ii;
    row.innerHTML = `<span class="lnum">${item.n}</span><span class="ltitle">${item.t}</span><button type="button" class="lcheck" role="checkbox" aria-checked="false" aria-label="Watched" title="Mark as watched or not watched"></button>`;
    body.appendChild(row);
  });
  collapseWrap.appendChild(body);
  group.appendChild(collapseWrap);
  navSection.appendChild(group);
});

// Weeks open and close instantly here (several can be open at once). Bootstrap's own click handling
// still animates a click on the week heading; it reads the same "show" class, so the two agree.
function setWeek(wi, open){
  const el = document.getElementById('week-collapse-' + wi); if (!el) return;
  el.classList.toggle('show', open);
  const btn = navSection.querySelector('.week-group[data-w="' + wi + '"] .week-title');
  if (btn) { btn.classList.toggle('collapsed', !open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
}
const openWeek = wi => setWeek(wi, true);
const isOpen = wi => { const el = document.getElementById('week-collapse-' + wi); return !!el && el.classList.contains('show'); };
function revealRow(wi, ii){
  const row = navSection.querySelector('.lecture-item[data-w="' + wi + '"][data-i="' + ii + '"]');
  if (!row || row.classList.contains('is-hid')) return;
  const r = row.getBoundingClientRect(), b = navSection.getBoundingClientRect();
  if (r.top < b.top + 8 || r.bottom > b.bottom - 8) navSection.scrollTop += (r.top - b.top) - navSection.clientHeight / 3;
}

// The address bar remembers where you are (#week-1/1.4, #syllabus, #tab-...) so a reload or a shared
// link lands on the same lecture instead of the Dashboard.
function setHash(h){
  try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (e) {}
}
const slug = key => key.toLowerCase().replace(/\s+/g, '-').replace(/\|/g, '/').replace(/#/g, '~');

function showDashboard(){
  setHash('');
  curLec = null; updateStep();
  mHere.textContent = 'Dashboard';
  clearExtras();
  navDashboard.classList.add('active');
  navSyllabus.classList.remove('active');
  navSection.querySelectorAll('.lecture-item').forEach(el => el.classList.remove('active'));
  panelDashboard.classList.add('active');
  panelSyllabus.classList.remove('active');
  panelLecture.classList.remove('active');
  window.scrollTo(0, 0);
}

function showSyllabus(){
  setHash('syllabus');
  curLec = null; updateStep();
  mHere.textContent = 'Syllabus';
  clearExtras();
  navSyllabus.classList.add('active');
  navDashboard.classList.remove('active');
  navSection.querySelectorAll('.lecture-item').forEach(el => el.classList.remove('active'));
  panelSyllabus.classList.add('active');
  panelDashboard.classList.remove('active');
  panelLecture.classList.remove('active');
  window.scrollTo(0, 0);
}

function showExtra(id){
  setHash('tab-' + id);
  clearExtras();
  navDashboard.classList.remove('active');
  navSyllabus.classList.remove('active');
  navSection.querySelectorAll('.lecture-item').forEach(el => el.classList.remove('active'));
  panelDashboard.classList.remove('active');
  panelSyllabus.classList.remove('active');
  panelLecture.classList.remove('active');
  extraNavs.forEach(el => el.classList.toggle('active', el.dataset.extra === id));
  curLec = null; updateStep();
  const xn = extraNavs.filter(el => el.dataset.extra === id)[0]; if (xn) mHere.textContent = xn.textContent;
  const panel = document.getElementById('panel-x-' + id);
  if (panel){
    panel.classList.add('active');
    // embedded sites load only when their tab is first opened
    panel.querySelectorAll('iframe[data-src]').forEach(f => { f.src = f.dataset.src; f.removeAttribute('data-src'); });
  }
  window.scrollTo(0, 0);
}

// ---- progress: watched lectures are remembered in this browser only ----
const PKEY = 'companion-progress-' + window.COURSE.code;
let prog = { done: {}, last: null };
try { const r = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (r && r.done) prog = r; } catch (e) {}
function saveProg(){ try { localStorage.setItem(PKEY, JSON.stringify(prog)); } catch (e) {} }
// previous / next lecture, across weeks
const FLAT = [];
WEEKS_DATA.forEach((wk, wi) => wk.items.forEach((it, ii) => FLAT.push({ wi: wi, ii: ii, t: it.t, n: it.n })));
let curLec = null;
const POS = {};
FLAT.forEach((f, i) => {
  f.idx = i;
  const seen = FLAT.slice(0, i).filter(g => g.wi === f.wi && g.n === f.n).length;
  f.key = WEEKS_DATA[f.wi].w + '|' + f.n + (seen ? '#' + seen : '');
  POS[f.wi + '.' + f.ii] = f;
});
const isDone = f => !!prog.done[f.key];
function setDone(f, v){
  if (v) prog.done[f.key] = 1; else delete prog.done[f.key];
  saveProg(); renderProgress();
}
const lecDone = document.getElementById('lec-done');
const resumeBox = document.getElementById('resume'), rsGo = document.getElementById('rs-go'), rsReset = document.getElementById('rs-reset');
let resumeF = null, resumeFresh = true;
const sbCont = document.getElementById('sb-continue');
function renderProgress(){
  navSection.querySelectorAll('.lecture-item').forEach(el => {
    const on = isDone(POS[el.dataset.w + '.' + el.dataset.i]);
    el.classList.toggle('done', on);
    el.querySelector('.lcheck').setAttribute('aria-checked', on ? 'true' : 'false');
  });
  navSection.querySelectorAll('.week-group').forEach(g => {
    const wi = +g.dataset.w, items = FLAT.filter(f => f.wi === wi);
    const n = items.filter(isDone).length;
    g.querySelector('.week-title').title = n ? n + ' of ' + items.length + ' watched' : '';   // the heading's fill shows progress; the count is a tooltip
    g.querySelector('.wbar').style.width = items.length ? (n / items.length * 100) + '%' : '0';
    g.classList.toggle('complete', n > 0 && n === items.length);
    g.querySelector('.wk-act').textContent = n === items.length ? 'Clear this week' : 'Mark week watched';
  });
  if (curLec) {
    const on = isDone(POS[curLec.wi + '.' + curLec.ii]);
    lecDone.classList.toggle('is-done', on);
    lecDone.setAttribute('aria-pressed', on ? 'true' : 'false');
    lecDone.querySelector('.lbl').textContent = on ? 'Watched' : 'Mark watched';
  }
  // dashboard card
  if (!FLAT.length) { resumeBox.hidden = true; sbCont.hidden = true; return; }
  resumeBox.hidden = false;
  const total = FLAT.length, count = FLAT.filter(isDone).length;
  const last = prog.last ? FLAT.filter(f => f.key === prog.last)[0] : null;
  const firstUndone = FLAT.filter(f => !isDone(f))[0] || null;
  const target = last ? (isDone(last) ? FLAT[last.idx + 1] || firstUndone : last) : (firstUndone || FLAT[0]);
  resumeF = target;
  const fresh = !last && count === 0;
  resumeFresh = fresh;
  document.getElementById('rs-k').textContent = fresh ? 'Start here' : count === total ? 'All done' : 'Continue where you left off';
  document.getElementById('rs-title').textContent = target ? WEEKS_DATA[target.wi].w + ' · ' + target.n + '  ' + target.t : 'You have watched every lecture.';
  document.getElementById('rs-fill').style.width = (count / total * 100) + '%';
  document.getElementById('rs-n').textContent = count + ' of ' + total + ' lectures watched';
  rsReset.hidden = count === 0 && !last;
  rsGo.hidden = !target;
  rsGo.innerHTML = '<span>' + (fresh ? 'Start' : 'Continue') + '</span>' + ARROW.right;
  // sidebar card
  sbCont.hidden = false;
  document.getElementById('sc-k').textContent = fresh ? 'Start here' : count === total ? 'All done' : 'Continue';
  document.getElementById('sc-t').textContent = target ? target.n + '  ' + target.t : 'You have watched every lecture';
  document.getElementById('sc-fill').style.width = (count / total * 100) + '%';
  document.getElementById('sc-n').textContent = count + ' of ' + total + ' watched';
  sbCont.disabled = !target;
  applyFilter();
}
rsGo.addEventListener('click', () => { if (resumeF) selectLecture(resumeF.wi, resumeF.ii); });
sbCont.addEventListener('click', () => { if (resumeF) selectLecture(resumeF.wi, resumeF.ii); });

// ---- find a lecture / unwatched only ----
const searchEl = document.getElementById('lec-search'), onlyBtn = document.getElementById('f-unwatched'), emptyEl = document.getElementById('sb-empty');
let savedOpen = null;
function applyFilter(){
  const q = searchEl.value.trim().toLowerCase(), only = onlyBtn.getAttribute('aria-pressed') === 'true';
  const filtering = !!q || only, tokens = q.split(/\s+/).filter(Boolean);
  if (filtering && !savedOpen) savedOpen = WEEKS_DATA.map((_, wi) => isOpen(wi));
  let shown = 0;
  WEEKS_DATA.forEach((wk, wi) => {
    let cnt = 0;
    navSection.querySelectorAll('.lecture-item[data-w="' + wi + '"]').forEach(row => {
      const f = POS[wi + '.' + row.dataset.i], hay = (f.n + ' ' + f.t).toLowerCase();
      const keepOpenRow = row.classList.contains('active');
      const ok = tokens.every(t => hay.indexOf(t) >= 0) && !(only && isDone(f) && !keepOpenRow);
      row.classList.toggle('is-hid', !ok);
      if (ok) cnt++;
    });
    shown += cnt;
    navSection.querySelector('.week-group[data-w="' + wi + '"]').classList.toggle('is-hid', filtering && cnt === 0);
    if (filtering) setWeek(wi, cnt > 0);
  });
  if (!filtering && savedOpen) { savedOpen.forEach((o, wi) => setWeek(wi, o)); savedOpen = null; }
  emptyEl.hidden = !(filtering && shown === 0);
}
searchEl.addEventListener('input', applyFilter);
searchEl.addEventListener('keydown', e => { if (e.key === 'Escape' && searchEl.value) { searchEl.value = ''; applyFilter(); e.stopPropagation(); } });
onlyBtn.addEventListener('click', () => { onlyBtn.setAttribute('aria-pressed', onlyBtn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); applyFilter(); });
document.getElementById('wk-expand').addEventListener('click', () => WEEKS_DATA.forEach((_, wi) => { if (!navSection.querySelector('.week-group[data-w="' + wi + '"]').classList.contains('is-hid')) setWeek(wi, true); }));
document.getElementById('wk-collapse').addEventListener('click', () => WEEKS_DATA.forEach((_, wi) => setWeek(wi, false)));
let resetTimer;
rsReset.addEventListener('click', () => {
  if (rsReset.dataset.sure) {
    prog = { done: {}, last: null }; saveProg();
    delete rsReset.dataset.sure; rsReset.textContent = 'Reset'; clearTimeout(resetTimer);
    renderProgress();
  } else {
    rsReset.dataset.sure = '1'; rsReset.textContent = 'Click again to clear your progress';
    resetTimer = setTimeout(() => { delete rsReset.dataset.sure; rsReset.textContent = 'Reset'; }, 4000);
  }
});
lecDone.addEventListener('click', () => { if (curLec) { const f = POS[curLec.wi + '.' + curLec.ii]; setDone(f, !isDone(f)); } });
const lecPrev = document.getElementById('lec-prev'), lecNext = document.getElementById('lec-next'), mNext = document.getElementById('m-next');
const ARROW = {
  left: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"/></svg>',
  right: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>'
};
function stepLabel(btn, text, f, dir) {
  const num = f ? '<span class="ls-n">' + f.n + '</span>' : '';
  btn.innerHTML = dir === 'left' ? ARROW.left + '<span>' + text + '</span>' + num : '<span>' + text + '</span>' + num + ARROW.right;
  btn.disabled = !f;
  btn.title = f ? f.n + '  ' + f.t : '';
}
function updateStep() {
  const idx = curLec ? FLAT.findIndex(f => f.wi === curLec.wi && f.ii === curLec.ii) : -1;
  const prev = idx > 0 ? FLAT[idx - 1] : null;
  const next = idx >= 0 ? FLAT[idx + 1] || null : FLAT[0] || null;
  stepLabel(lecPrev, 'Previous', prev, 'left');
  stepLabel(lecNext, 'Next', next, 'right');
  renderProgress();
  const goal = idx >= 0 ? next : resumeF;
  if (goal) {
    mNext.hidden = false;
    mNext.innerHTML = (idx >= 0 ? 'Next' : resumeFresh ? 'Start' : 'Continue') + ARROW.right;
    mNext.setAttribute('aria-label', (idx >= 0 ? 'Next lecture: ' : resumeFresh ? 'Start with ' : 'Continue with ') + goal.t);
  } else mNext.hidden = true;
}
function goStep(d) {
  const idx = curLec ? FLAT.findIndex(f => f.wi === curLec.wi && f.ii === curLec.ii) : -1;
  const t = FLAT[idx + d] || (idx < 0 && d > 0 ? FLAT[0] : null);
  if (t && d > 0 && curLec) { prog.done[POS[curLec.wi + '.' + curLec.ii].key] = 1; saveProg(); }   // moving on counts as watched
  if (t) selectLecture(t.wi, t.ii);
}
document.addEventListener('keydown', e => {
  if (!panelLecture.classList.contains('active') || document.body.classList.contains('nav-open')) return;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); goStep(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); goStep(-1); }
});
lecPrev.addEventListener('click', () => goStep(-1));
lecNext.addEventListener('click', () => goStep(1));
mNext.addEventListener('click', () => { if (curLec) goStep(1); else if (resumeF) selectLecture(resumeF.wi, resumeF.ii); });

function selectLecture(wi, ii){
  prog.last = POS[wi + '.' + ii].key; saveProg();
  setHash(slug(prog.last));
  curLec = { wi: wi, ii: ii }; updateStep();
  const item = WEEKS_DATA[wi].items[ii];
  clearExtras();
  navDashboard.classList.remove('active');
  navSyllabus.classList.remove('active');
  panelSyllabus.classList.remove('active');
  navSection.querySelectorAll('.lecture-item').forEach(el => {
    el.classList.toggle('active', +el.dataset.w === wi && +el.dataset.i === ii);
  });
  applyFilter();
  openWeek(wi);
  revealRow(wi, ii);
  panelDashboard.classList.remove('active');
  panelLecture.classList.add('active');
  window.scrollTo(0, 0);

  eyebrow.textContent = `${WEEKS_DATA[wi].w} · Lecture ${item.n}`;
  mHere.textContent = `${WEEKS_DATA[wi].w} · ${item.n}`;
  titleEl.textContent = item.t;
  if (item.v){
    frame.src = `https://www.youtube.com/embed/${item.v}`;
    frame.style.display = '';
    emptyOverlay.style.display = 'none';
  } else {
    frame.src = '';
    frame.style.display = 'none';
    emptyOverlay.style.display = '';
  }
  let html = '';
  if (item.s) html += `<a href="${item.s}" target="_blank" rel="noopener">Slides ↗</a>`;
  if (!item.v && !item.s) html = '<span class="tbd-note">Nothing linked yet for this one.</span>';
  actions.innerHTML = html;
}

const sidebarToggle = document.getElementById('sidebar-toggle');
function syncSidebarToggle(){
  const collapsed = document.body.classList.contains('sidebar-collapsed');
  sidebarToggle.innerHTML = collapsed ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/></svg>' : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>';
  sidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  const label = collapsed ? 'Show sidebar' : 'Hide sidebar';
  sidebarToggle.setAttribute('aria-label', label);
  sidebarToggle.title = label;
}
sidebarToggle.addEventListener('click', () => {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  try { localStorage.setItem('companion-sidebar', collapsed ? 'collapsed' : 'open'); } catch (e) {}
  syncSidebarToggle();
});
syncSidebarToggle();

// phone drawer
const mMenu = document.getElementById('m-menu'), mScrim = document.getElementById('m-scrim'), mHere = document.getElementById('m-here');
function setNav(open){
  document.body.classList.toggle('nav-open', open);
  mMenu.setAttribute('aria-expanded', open ? 'true' : 'false');
}
mMenu.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
mScrim.addEventListener('click', () => setNav(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });
document.getElementById('sidebar').addEventListener('click', e => {
  if (e.target.closest('.lcheck')) return;
  if (e.target.closest('.nav-item') || e.target.closest('.lecture-item')) setNav(false);
});
window.matchMedia('(min-width:821px)').addEventListener('change', () => setNav(false));

navDashboard.addEventListener('click', showDashboard);
navSyllabus.addEventListener('click', showSyllabus);
extraNavs.forEach(el => el.addEventListener('click', () => showExtra(el.dataset.extra)));
navSection.addEventListener('click', e => {
  // Week-title clicks are handled natively by Bootstrap's collapse (data-bs-toggle above);
  // this only needs to react to a lecture row, a tick, or a week's "mark watched" link.
  const wk = e.target.closest('.wk-act');
  if (wk) {
    const wi = +wk.closest('.week-group').dataset.w, items = FLAT.filter(f => f.wi === wi);
    const all = items.every(isDone);
    items.forEach(f => { if (all) delete prog.done[f.key]; else prog.done[f.key] = 1; });
    saveProg(); renderProgress();
    return;
  }
  const row = e.target.closest('.lecture-item'); if (!row) return;
  if (e.target.closest('.lcheck')) {   // the tick toggles watched / not watched without opening the lecture
    const f = POS[row.dataset.w + '.' + row.dataset.i];
    setDone(f, !isDone(f));
    return;
  }
  selectLecture(+row.dataset.w, +row.dataset.i);
});

// Open whatever the address says; otherwise land on the Dashboard (every week's accordion starts collapsed).
(function route(){
  let h = '';
  try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) {}
  if (h === 'syllabus') return showSyllabus();
  if (h.indexOf('tab-') === 0 && document.getElementById('nav-x-' + h.slice(4))) return showExtra(h.slice(4));
  const f = h && FLAT.filter(g => slug(g.key) === h)[0];
  if (f) return selectLecture(f.wi, f.ii);
  showDashboard();
  // on the Dashboard, still open the week you were last in so the list is ready
  const last = prog.last && FLAT.filter(g => g.key === prog.last)[0];
  if (last) { setWeek(last.wi, true); revealRow(last.wi, last.ii); }
})();

// ---- drag the sidebar edge to resize it (laptops); double-click resets ----
(function(){
  const grip = document.getElementById('sb-resize');
  const setW = px => document.documentElement.style.setProperty('--sb-w', Math.max(240, Math.min(520, Math.round(px))) + 'px');
  const move = e => setW(e.clientX);
  const stop = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop);
    document.body.classList.remove('sb-dragging');
    try { localStorage.setItem('companion-sb-w', parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sb-w'), 10) || 300); } catch (err) {}
  };
  grip.addEventListener('pointerdown', e => {
    e.preventDefault(); document.body.classList.add('sb-dragging');
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
  });
  grip.addEventListener('dblclick', () => { document.documentElement.style.removeProperty('--sb-w'); try { localStorage.removeItem('companion-sb-w'); } catch (err) {} });
})();
