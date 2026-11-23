<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Companion</title>
<meta name="description" content="A student-kept companion for the IIT Madras BS in Data Science and Applications: syllabus, lectures, resources and important links.">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Companion">
<meta property="og:title" content="The Companion">
<meta property="og:description" content="A student-kept companion for the IIT Madras BS in Data Science and Applications: syllabus, lectures, resources and important links.">
<meta property="og:url" content="https://iitmbsc-student-projects.github.io/the-companion/">
<meta property="og:image" content="https://iitmbsc-student-projects.github.io/the-companion/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
<link rel="stylesheet" href="assets/theme.css">
<script>try{var t=localStorage.getItem('companion-theme');if(t==='light'||t==='dark'||t==='pink')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head>
<body class="home" data-page="home">
<a class="skip-link" href="#main">Skip to content</a>

{{TOPBAR}}

<main class="wrap" id="main" tabindex="-1">
  <header class="hm-hero">
    <p class="hm-kicker">By students, for students</p>
    <h1 class="hm-title">The Companion</h1>
    <p class="hm-sub">A study companion for the IIT Madras BS in Data Science &amp; Applications.</p>
    <div class="search hm-search">
      <input type="search" id="search-box" placeholder="Search a course, try “maths”, “MLT”, “databases”, “NLP”…" aria-label="Search courses" autocomplete="off">
    </div>
    <p class="hm-hint">{{COURSE_COUNT}} courses and projects. Press <kbd>/</kbd> to search, <kbd>Enter</kbd> to open the first match.</p>
  </header>

  <p class="no-results" id="no-results" role="status" hidden>No course matches that. Try a code such as CS1001, or a word such as “maths”.</p>

  <section class="hm-resume" id="hm-resume" aria-labelledby="hm-resume-h" hidden>
    <div class="hm-head">
      <h2 class="hm-h" id="hm-resume-h">Continue where you left off</h2>
      <button type="button" class="hm-quiet" id="hm-forget" title="Kept only in this browser">Forget recent</button>
    </div>
    <div class="hm-rc-grid" id="hm-resume-list"></div>
  </section>

  <div class="hm-two">
    <section class="hm-card hm-dates" aria-labelledby="hm-dates-h">
      <h2 class="hm-h" id="hm-dates-h">Coming up</h2>
      <p class="hm-note">{{TERM}} term, from the official academic calendar.</p>
      <ol id="hm-dates">
{{DATES}}
      </ol>
      <p class="hm-empty" id="hm-dates-empty" hidden>Nothing else is listed for this term. The official calendar has the next one.</p>
      <a class="hm-more" href="{{DATES_SRC}}" target="_blank" rel="noopener">Full academic calendar</a>
    </section>
    <!-- updates:start -->
    <nav class="hm-card hm-news" aria-labelledby="hm-news-h"><h2 class="hm-h" id="hm-news-h">What's new</h2><ul></ul><a class="hm-more" href="updates.html">All updates</a></nav>
    <!-- updates:end -->
  </div>

  <section class="hm-levels" aria-labelledby="hm-levels-h">
    <div class="hm-head">
      <h2 class="hm-h" id="hm-levels-h">Courses by level</h2>
      <a class="hm-quiet" href="courses.html">Open the full list</a>
    </div>
    <div class="hm-level-grid">
{{LEVELS}}
    </div>
  </section>

  <section class="hm-tools" aria-label="More">
    <a class="tool-card" href="links.html"><span class="lc-title">Important links</span><span class="lc-sub">Handbook, calendar, score checker</span></a>
    <a class="tool-card" href="calculator.html"><span class="lc-title">Grade calculator</span><span class="lc-sub">Work out your final course score</span></a>
    <a class="tool-card" href="scam-alert.html"><span class="lc-title">Scam alert</span><span class="lc-sub">Fake internship offers to watch out for</span></a>
    <a class="tool-card" href="contributors.html"><span class="lc-title">Contributors</span><span class="lc-sub">The people behind the notes and resources</span></a>
  </section>
</main>

<footer class="site-end wrap">
  <span class="se-name">The Companion</span>
  <nav class="se-nav" aria-label="Site">{{FOOTNAV}}</nav>
  <div class="theme-foot" id="theme-foot"></div>
</footer>

<button id="back-to-top" aria-label="Back to top" title="Back to top">&#8593;</button>

<script>window.HOME_COURSES = {{HOME_DATA}};</script>
<script src="assets/menu-data.js"></script>
<script src="assets/site.js"></script>
<script src="assets/theme.js"></script>
<script src="assets/home.js"></script>
</body>
</html>
