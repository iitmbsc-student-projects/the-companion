# The Companion

A student-run companion to the IIT Madras BS in Data Science & Applications programme.

Live site: https://iitmbsc-student-projects.github.io/the-companion/

## What it does

- Course pages: syllabus, week-by-week lectures, resources, past papers
- Grade calculator, a reverse calculator on [My Term](my-term.html), and a [degree planner](planner.html) (credits toward each exit, and CGPA)
- Home lecture search across every course, and a "Your term" card once you pick courses
- Optional Google sign-in (Supabase) to sync watched lectures and term picks across devices, plus a community suggestion queue — see `supabase/README.md`. Leave `assets/config.js` empty and the site stays fully static.

## Working on it

Each course is one file in `data/courses/`. The pages in `courses/` are generated from those files, so edit the data and not the HTML. See `tools/README.md` for the local dashboard and the generator.

## Copyright and content

No official IITM material is hosted in this repo. Every slide, video, and past-paper link points out to the student portal, YouTube, or a student-owned Drive folder. This project is not affiliated with or endorsed by IIT Madras. Course details here may be outdated or incorrect, so always check the official handbook and grading document on the IITM study portal for up-to-date, accurate information.

## Contributing

Found a mistake, or have a resource to add? Open an issue or a pull request. Corrections to a syllabus, a missing video link, or a broken resource are all welcome.
