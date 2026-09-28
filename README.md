# The Companion

A static course hub for the IIT Madras BS in Data Science & Applications. It has one page per course (syllabus, calendar, previous-year questions, week-by-week lecture links) and an index page that maps the whole programme, from Foundation through Diploma, BSc/BS, PG Diploma, and MTech.

Live site: https://iitmbsc-student-projects.github.io/the-companion/

## Repo layout

```
index.html               the catalog: programme structure table, every course grouped by level, a live search box
courses/<code>.html      one page per course, for example courses/cs2001.html
assets/term-syllabus.js  shared calendar data (quiz 1, quiz 2, end-term dates) for the current term
```

There is no separate stylesheet or script file. Each page is self-contained: its CSS and JS are written inline in the HTML. The only outside dependencies are Google Fonts (Fraunces, Inter, JetBrains Mono), Bootstrap 5.3.3 loaded from a CDN (used for the accordion-style weekly lecture list), and the local `assets/term-syllabus.js` file.

## How a course page works

Each `courses/<code>.html` page has two views, switched with JavaScript:

**Dashboard.** Shows the course title, links to the syllabus and past papers, and a calendar block for quiz 1, quiz 2, and the end-term. That calendar block is filled in automatically when the page loads, by reading `assets/term-syllabus.js` and looking up the course's own code.

**Lecture view.** A sidebar lists every week as a collapsible section. Opening a week shows its lectures. Clicking a lecture loads its video in the main panel (either a YouTube embed, or a plain link out to Drive for the few lectures that are only Drive-hosted) along with its slide link. If a lecture has nothing linked yet, the page just says so instead of showing a broken link.

All of this lives in two places inside each course's HTML: a `WEEKS_DATA` array holding the weeks and lectures, and a `COURSE_CODE` constant used to look up that course's calendar entry.

## What's done and what's still a placeholder

Every course in the programme has a page already (73 in total), but they are not all filled in yet.

Fully built, meaning real links and every week's lectures transcribed: `CS2001` (Database Management Systems), `CS2002` (Programming, Data Structures & Algorithms using Python), `CS2003` (Modern Application Development I), `CS2004` (Machine Learning Foundations), `CS2005` (Programming Concepts using Java), `CS2006` (Modern Application Development II), `CS2007` (Machine Learning Techniques), `CS2008` (Machine Learning Practice), `SE2001` (System Commands), `SE2002` (Tools in Data Science), `MS2001` (Business Data Management), `DA2001` (Introduction to Deep Learning and Generative AI). That's every course in the Diploma in Programming and the Diploma in Data Science except `MS2002` (Business Analytics), which is still a placeholder.

The five project courses (`CS2003P`, `CS2006P`, `CS2008P`, `MS2001P`, `DA2001P`) don't have weekly lectures at all — they run as live project-support sessions each term instead. Their pages list those sessions as a term-by-term table rather than a lecture accordion. Only `CS2003P` and `CS2006P` have session playlists catalogued so far; the other three courses' spreadsheets don't have any session links filled in yet, so their tables are honestly empty rather than guessed at.

Everything else is a placeholder: the page exists, the title and calendar wiring are correct, but the weekly lecture list (or session table) still needs to be filled in from the course's actual spreadsheet.

`index.html` and the shared calendar data are complete for every course already.

## Filling in a placeholder course

1. Open `courses/<code>.html` and find its `WEEKS_DATA` array near the bottom of the file.
2. Add one object per week, like `{ w: 'Week 1', items: [...] }`. Each item in `items` needs a lecture number, a title, a YouTube video ID, and a slide URL: `{ n, t, v, s }`. If a lecture only has a Drive video and no YouTube link, use `dv` instead of `v`.
3. Update the syllabus and past-paper links near the top of the file if they are still placeholders.
4. Open the page in a browser and click through a couple of weeks to check the links work before committing.

## Publishing to GitHub Pages

1. Push this folder to a GitHub repo (already done for this one: `iitmbsc-student-projects/the-companion`).
2. In the repo, go to Settings, then Pages, and set Source to the `main` branch, `/ (root)`. Save.
3. The site goes live at `https://<your-username>.github.io/<repo-name>/`.

Don't push the scratch files that live alongside this project locally, things like spreadsheets, sorting notes, or screenshots used while building the site. The `.gitignore` in this repo already excludes the ones that existed when it was set up; add new ones there if more show up.

## A note on content and access

No official IITM material is hosted in this repo. Every slide, video, and past-paper link points out to the student portal, YouTube, or a student-owned Drive folder. That keeps the repo itself free of copyrighted material.

GitHub Pages is public, and there is no real way to restrict a plain Pages site to IITM students only. A password check written in JavaScript is not real security, since anyone can read the page source. If access control ever becomes necessary, it needs a different kind of host, for example Cloudflare Pages with Access, or a small backend server.

## Performance

There is nothing to install and no build step. Any file here can be opened directly in a browser or served as-is. Bootstrap's CSS/JS and the Google Fonts are the only things loaded from a CDN; everything else is inline. YouTube videos are only loaded when a lecture is actually clicked, not when the page first loads.
