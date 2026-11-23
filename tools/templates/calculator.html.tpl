<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{TITLE}} | The Companion</title>
<meta name="description" content="Work out your final course score T for any IITM BS course from your quiz, assignment and exam marks.">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Companion">
<meta property="og:title" content="{{TITLE}}">
<meta property="og:description" content="Work out your final course score T for any IITM BS course from your quiz, assignment and exam marks.">
<meta property="og:url" content="https://iitmbsc-student-projects.github.io/the-companion/calculator.html">
<meta property="og:image" content="https://iitmbsc-student-projects.github.io/the-companion/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css?v=e196bd30">
<link rel="stylesheet" href="assets/theme.css?v=225b80af">
<script>try{var t=localStorage.getItem('companion-theme');if(t==='light'||t==='dark'||t==='pink')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head>
<body data-page="calculator">
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
      <a class="tb-link" href="scam-alert.html">Scam alert</a>
      <a class="tb-link current" href="calculator.html">Grade calculator</a>
      <a class="tb-link" href="contributors.html">Contributors</a>
      <a class="tb-link" href="updates.html">Updates</a>
    </div>
    <span id="theme-slot" data-float-narrow></span>
  </div>
</nav>

<header class="page-head">
  <div class="wrap">
    <h1 class="ph-title">{{TITLE}}</h1>
  </div>
</header>

<main class="wrap" id="main" tabindex="-1">
  <section class="calc-wrap" id="calc">
    <div class="scam-callout calc-note" role="note">{{NOTE}}</div>
    <div class="calc-pick">
      <div class="cp-group">
        <span class="cp-label" id="calc-level-label">Level</span>
        <div class="calc-levels" id="calc-levels" role="group" aria-labelledby="calc-level-label"></div>
      </div>
      <div class="cp-group cp-course">
        <label for="calc-course">Course</label>
        <select id="calc-course"></select>
      </div>
    </div>
    <div id="calc-body" class="calc-body"></div>
  </section>
  <script type="application/json" id="grading-data">{{DATA}}</script>
</main>

<footer class="site-end wrap">
  <span class="se-brand"><span class="se-name">The Companion</span><span class="se-by">Built and kept by Vikash</span></span>
  <nav class="se-nav" aria-label="Site">{{FOOTNAV}}</nav>
  <div class="theme-foot" id="theme-foot"></div>
</footer>

<button id="back-to-top" aria-label="Back to top" title="Back to top">&#8593;</button>

<script src="assets/menu-data.js"></script>
<script src="assets/site.js"></script>
<script src="assets/theme.js"></script>
<script src="assets/calculator.js?v=0"></script>
</body>
</html>
