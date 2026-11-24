<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Term | The Companion</title>
<meta name="description" content="Pick your courses for the term and see your progress, what each exam covers, the lectures left before it, and the end-term marks each grade needs.">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Companion">
<meta property="og:title" content="My Term">
<meta property="og:description" content="Your term at a glance: progress, exam coverage, pace, and the end-term marks each grade needs.">
<meta property="og:url" content="https://iitmbsc-student-projects.github.io/the-companion/my-term.html">
<meta property="og:image" content="https://iitmbsc-student-projects.github.io/the-companion/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
<link rel="stylesheet" href="assets/theme.css">
<script>try{var t=localStorage.getItem('companion-theme');if(t==='light'||t==='dark'||t==='pink')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head>
<body data-page="my-term">
<a class="skip-link" href="#main">Skip to content</a>

<nav class="topbar" aria-label="Main">
  <div class="wrap topbar-in">
    <a class="tb-brand" href="index.html" aria-label="The Companion, home">
      <span class="tb-mark" aria-hidden="true">C</span><span class="tb-name">The Companion</span>
    </a>
    <div class="tb-nav">
      <div class="nav-item" data-tab="courses">
        <a class="nav-main" href="courses.html">Courses</a>
        <button class="nav-caret" type="button" aria-expanded="false" aria-controls="menu-courses" aria-label="Show course levels">&#9662;</button>
        <div class="menu" id="menu-courses"></div>
      </div>
      <div class="nav-item" data-tab="links">
        <a class="nav-main" href="links.html">Important links</a>
        <button class="nav-caret" type="button" aria-expanded="false" aria-controls="menu-links" aria-label="Show link groups">&#9662;</button>
        <div class="menu" id="menu-links"></div>
      </div>
    </div>
    <div class="tb-more">
      <a class="tb-link current" href="my-term.html">My Term</a>
      <a class="tb-link" href="planner.html">Planner</a>
      <a class="tb-link" href="scam-alert.html">Scam alert</a>
      <a class="tb-link" href="calculator.html">Grade calculator</a>
      <a class="tb-link" href="contributors.html">Contributors</a>
      <a class="tb-link" href="updates.html">Updates</a>
    </div>
    <span id="theme-slot" data-float-narrow></span>
  </div>
</nav>

<header class="page-head">
  <div class="wrap">
    <h1 class="ph-title">My Term</h1>
  </div>
</header>

<main class="wrap" id="main" tabindex="-1">
  <section class="mt-wrap">
    <p class="mt-intro">Courses for the <b>{{TERM}}</b> term: progress, the next exam, and the end-term mark each grade needs. <a href="account.html">Sign in</a> to keep this on another device.</p>

    <details class="mt-pick" id="mt-pick">
      <summary id="mt-pick-sum">Choose your courses</summary>
      <div class="mt-pick-grid" id="mt-pick-grid"></div>
    </details>

    <p class="mt-empty" id="mt-empty">No courses picked yet. Open “Choose your courses” and tick the ones you are taking.</p>
    <div class="mt-grid" id="mt-grid"></div>

    <section class="mt-rev" id="mt-rev" hidden>
      <h2 class="hm-h">What does the end term need?</h2>
      <p class="mt-intro">Marks you already have, worked backwards to the end-term score for each grade. The <a href="calculator.html">grade calculator</a> has the full sum.</p>
      <div class="calc-pick">
        <div class="cp-group cp-course">
          <label for="mt-rev-course">Course</label>
          <select id="mt-rev-course"></select>
        </div>
      </div>
      <div class="calc-grid" id="mt-rev-inputs" style="margin:12px 0"></div>
      <table class="mt-rev-table" id="mt-rev-table" hidden>
        <thead><tr><th>Grade</th><th>End term needed</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
      <p class="acct-note" id="mt-rev-note"></p>
    </section>
  </section>
</main>

<footer class="site-end wrap">
  <span class="se-brand"><span class="se-name">The Companion</span><span class="se-by">Built and kept by Vikash</span></span>
  <nav class="se-nav" aria-label="Site">{{FOOTNAV}}</nav>
  <div class="theme-foot" id="theme-foot"></div>
</footer>

<button id="back-to-top" aria-label="Back to top" title="Back to top">&#8593;</button>

<script type="application/json" id="myterm-data">{{MYTERM_DATA}}</script>
<script type="application/json" id="grading-data">{{GRADING}}</script>
<script type="application/json" id="dates-data">{{DATES}}</script>
<script src="assets/menu-data.js"></script>
<script src="assets/site.js"></script>
<script src="assets/theme.js"></script>
<script src="assets/term-syllabus.js"></script>
<script src="assets/config.js"></script>
<script src="assets/account.js"></script>
<script src="assets/sync.js"></script>
<script src="assets/grading-engine.js"></script>
<script src="assets/my-term.js"></script>
</body>
</html>
