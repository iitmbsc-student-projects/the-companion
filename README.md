# The Companion

A static, no-build course hub for the IIT Madras BS in Data Science & Applications. One page per course — syllabus, calendar, previous-year questions, and week-by-week lecture links — plus an index that maps the whole programme (Foundation → Diploma → BSc/BS → PG Diploma → MTech). Built to publish straight to GitHub Pages.

## What's in the repo

```
index.html              catalog — programme structure table + every course, grouped by level, with a live search box
courses/<code>.html     one page per course (e.g. courses/cs2001.html)
assets/term-syllabus.js shared quiz/endterm calendar data for the current term, read by every course page
```

There's no separate stylesheet or script file — each page is self-contained (inline CSS/JS) apart from three CDN includes shared by every course page: Google Fonts (Fraunces / Inter / JetBrains Mono), Bootstrap 5.3.3 (for the accordion-style weekly lecture list), and the local `assets/term-syllabus.js`.

## How a course page works

Each `courses/<code>.html` page has two views toggled by JS:

- **Dashboard** — course title, syllabus link, PYQ/resources links, and a calendar block (quiz 1 / quiz 2 / end-term dates and mode) that's filled in automatically at page-load from `assets/term-syllabus.js`, keyed by course code.
- **Lecture view** — a fixed sidebar lists every week as a Bootstrap accordion item; expanding a week shows its lectures; clicking a lecture swaps the main panel to show its embedded YouTube video (or a Drive link, for the handful of lectures that are only Drive-hosted) plus its slide link. Anything not yet linked shows a plain "nothing here yet" note instead of a broken link.

All of that data lives in a `WEEKS_DATA` array near the bottom of each course's HTML, and the course's own code in a `COURSE_CODE` constant (used to look up its calendar entry).

## Current build status

Every course in the programme already has a page (73 in total), but they're not all at the same level of completion:

- **Fully built** — real syllabus links, PYQ, and every week's lectures transcribed with working video/slide links: `CS2001` (Database Management Systems), `CS2002` (Programming, Data Structures & Algorithms using Python), `CS2003` (Modern Application Development I), `CS2005` (Programming Concepts using Java).
- **Placeholder** — the rest of the catalog has the page shell (title, breadcrumb, calendar wiring) in place, with the weekly lecture list still to be filled in from the actual course spreadsheets.

`index.html` and the shared calendar data are otherwise complete for every course listed.

## Filling in a placeholder course

1. Open `courses/<code>.html` and find its `WEEKS_DATA` array.
2. Add one object per week (`{ w: 'Week 1', items: [...] }`), and one item per lecture (`{ n, t, v, s }` — number, title, YouTube video ID, slide URL; use `dv` instead of `v` for a Drive-hosted-only video).
3. Update the syllabus/PYQ links in the dashboard section if they're still placeholders.
4. Open the page locally and click through a couple of weeks to check the links resolve before committing.

## Publishing to GitHub Pages

1. Create a repo (e.g. `the-companion` or `iitm-bs-hub`).
2. Push everything in this folder to `main` — **except** any scratch/working files that live alongside it locally (spreadsheets, sorting notes, screenshots) that aren't part of the site itself.
3. Repo → Settings → Pages → Source: `main` branch, `/ (root)` → Save.
4. Site goes live at `https://<user>.github.io/<repo>/`.

## Notes on content & access

- **No official IITM material is hosted in this repo.** Every slide, video, and PYQ link points out to the student portal, YouTube, or a student-owned Drive folder — this keeps the repo itself free of copyrighted course material.
- **GitHub Pages is public.** There's no real access control available on a plain Pages site. If restricting access to IITM students ever matters, a client-side password gate is a weak filter — real auth needs a different host (e.g. Cloudflare Pages + Access, or a small backend).

## Performance

- No frameworks to install, no build step — open any HTML file directly or serve the folder as-is.
- Only Bootstrap's JS/CSS and Google Fonts are loaded from a CDN; everything else is inline.
- YouTube embeds only load when a lecture is actually selected, not on page load.
