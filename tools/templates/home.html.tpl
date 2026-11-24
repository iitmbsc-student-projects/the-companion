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
    <p class="hm-lec-head" id="hm-lec-head" hidden>Matching lectures</p>
    <ul class="hm-lec-results" id="hm-lec-results" hidden></ul>
  </header>

  <section class="quick hm-quick hm-tools" aria-labelledby="hm-tools-h">
    <span class="quick-label" id="hm-tools-h">Your tools</span>
    <div class="quick-grid">
      <a class="quick-card qc-in" href="my-term.html"><span class="qc-title">My Term</span><span class="qc-tag">Progress, exam dates, end-term marks</span></a>
      <a class="quick-card qc-in" href="planner.html"><span class="qc-title">Degree planner</span><span class="qc-tag">Credits and CGPA, level by level</span></a>
      <a class="quick-card qc-in" href="calculator.html"><span class="qc-title">Grade calculator</span><span class="qc-tag">What your marks add up to</span></a>
      <a class="quick-card qc-in" href="nptel.html"><span class="qc-title">NPTEL</span><span class="qc-tag">Course lists and lectures</span></a>
      <a class="quick-card qc-in" href="scam-alert.html"><span class="qc-title">Scam alert</span><span class="qc-tag">Spot fake offers and fees</span></a>
    </div>
  </section>

  <section class="quick hm-quick" aria-labelledby="hm-quick-h">
    <span class="quick-label" id="hm-quick-h">Useful resources</span>
    <div class="quick-grid">
{{QUICK}}
    </div>
  </section>

{{SHARE}}

  <p class="no-results" id="no-results" role="status" hidden>No course matches that. Try a code such as CS1001, or a word such as “maths”.</p>


  <section class="hm-resume" id="hm-resume" aria-labelledby="hm-resume-h" hidden>
    <div class="hm-head">
      <h2 class="hm-h" id="hm-resume-h">Continue where you left off</h2>
      <button type="button" class="hm-quiet" id="hm-forget" title="Hides these here. Your watched ticks stay on the course pages.">Clear list</button>
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

  <section class="hm-tiles" aria-labelledby="hm-levels-h">
    <div class="hm-head">
      <h2 class="hm-h" id="hm-levels-h">Browse by level</h2>
      <a class="hm-quiet" href="courses.html">All courses</a>
    </div>
    <div class="hm-tile-grid">
{{TILES}}
    </div>
  </section>


  <section class="hm-levels" aria-label="Search results">
    <div class="hm-level-grid">
{{LEVELS}}
      <section class="hl-card" id="lv-nptel" aria-labelledby="lv-nptel-h" hidden>
        <div class="hl-head"><h3 id="lv-nptel-h">NPTEL</h3><span class="hl-n" id="lv-nptel-n"></span></div>
        <ul class="np-res" id="lv-nptel-list"></ul>
        <a class="hm-more" id="lv-nptel-all" href="nptel.html" hidden></a>
      </section>
    </div>
  </section>
</main>

<footer class="site-end wrap">
  <span class="se-brand"><span class="se-name">The Companion</span><span class="se-by">Built and kept by Vikash</span></span>
  <nav class="se-nav" aria-label="Site">{{FOOTNAV}}</nav>
  <div class="theme-foot" id="theme-foot"></div>
  <p class="se-note"><b>Disclaimer.</b> The Companion is an unofficial student project, not affiliated with or endorsed by IIT Madras. Course details may be outdated or incorrect; always check the official handbook and grading document on the IITM study portal.</p>
</footer>

<button id="back-to-top" aria-label="Back to top" title="Back to top">&#8593;</button>

<script>window.HOME_COURSES = {{HOME_DATA}};</script>
<script src="assets/menu-data.js"></script>
<script src="assets/site.js"></script>
<script src="assets/theme.js"></script>
<script src="assets/config.js"></script>
<script src="assets/account.js"></script>
<script src="assets/sync.js"></script>
<script src="assets/nptel-index.js"></script>
<script src="assets/home.js"></script>
<script src="assets/search.js"></script>
</body>
</html>
