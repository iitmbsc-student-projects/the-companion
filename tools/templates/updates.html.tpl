<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{TITLE}} | The Companion</title>
<meta name="description" content="What's new on The Companion: resources added to course pages and changes to the site, newest first.">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Companion">
<meta property="og:title" content="{{TITLE}}">
<meta property="og:description" content="What's new on The Companion: resources added to course pages and changes to the site, newest first.">
<meta property="og:url" content="https://iitmbsc-student-projects.github.io/the-companion/updates.html">
<meta property="og:image" content="https://iitmbsc-student-projects.github.io/the-companion/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css?v=e196bd30">
<link rel="stylesheet" href="assets/theme.css?v=225b80af">
<script>try{var t=localStorage.getItem('companion-theme');if(t==='light'||t==='dark'||t==='pink')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head>
<body data-page="updates">
<a class="skip-link" href="#main">Skip to content</a>

<nav class="topbar" aria-label="Main">
  <div class="wrap topbar-in">
    <a class="tb-brand" href="index.html" aria-label="The Companion, home">
      <img class="tb-logo" src="assets/logo.png" alt="">
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
      <div class="nav-item" data-tab="nptel">
        <a class="nav-main" href="nptel.html">NPTEL</a>
        <button class="nav-caret" type="button" aria-expanded="false" aria-controls="menu-nptel" aria-label="Show NPTEL lists">&#9662;</button>
        <div class="menu" id="menu-nptel"></div>
      </div>
    </div>
    <div class="tb-more">
      <a class="tb-link" href="my-term.html">My Term</a>
      <a class="tb-link" href="planner.html">Planner</a>
      <a class="tb-link" href="scam-alert.html">Scam alert</a>
      <a class="tb-link" href="calculator.html">Grade calculator</a>
      <a class="tb-link" href="contributors.html">Contributors</a>
      <a class="tb-link current" href="updates.html">Updates</a>
    </div>
    <span id="theme-slot" data-float-narrow></span>
  </div>
</nav>

<header class="page-head">
  <div class="wrap">
    <h1 class="ph-title">{{TITLE}}</h1>
    <p class="ph-sub">{{SUB}}</p>
    <div class="up-filter" role="group" aria-label="Show">
      <button type="button" data-f="all" aria-pressed="true">All</button><button type="button" data-f="res" aria-pressed="false">New resources</button><button type="button" data-f="site" aria-pressed="false">Site changes</button>
    </div>
  </div>
</header>

<main class="wrap" id="main" tabindex="-1">
{{BODY}}
</main>

<footer class="site-end wrap">
  <span class="se-brand"><span class="se-name">The Companion</span><span class="se-by">Built and kept by Vikash</span></span>
  <nav class="se-nav" aria-label="Site">{{FOOTNAV}}</nav>
  <div class="theme-foot" id="theme-foot"></div>
  <p class="se-note"><b>Disclaimer.</b> The Companion is an unofficial student project, not affiliated with or endorsed by IIT Madras. Course details may be outdated or incorrect; always check the official handbook and grading document on the IITM study portal.</p>
</footer>

<button id="back-to-top" aria-label="Back to top" title="Back to top">&#8593;</button>

<script src="assets/menu-data.js"></script>
<script src="assets/site.js"></script>
<script src="assets/theme.js"></script>
<script>
(function () {
  var btns = document.querySelectorAll('.up-filter button');
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.f;
      btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      document.querySelectorAll('.up-item').forEach(function (li) { li.hidden = f !== 'all' && li.dataset.kind !== f; });
      document.querySelectorAll('.up-day').forEach(function (d) { d.hidden = !d.querySelector('.up-item:not([hidden])'); });
    });
  });
})();
</script>
</body>
</html>
