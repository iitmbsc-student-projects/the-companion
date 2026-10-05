# The Companion

## What we're building

A student-run companion to the IIT Madras BS in Data Science & Applications programme. One page per course with its syllabus, calendar, previous-year questions, resources and week-by-week lectures, plus pages for the courses list, important links and the people who helped.

Live site: https://iitmbsc-student-projects.github.io/the-companion/

## What's built

- **Courses:** every course in the programme has a page with its syllabus, faculty and week-by-week breakdown, taken from the official course booklet. Foundation and Diploma courses have their lecture videos linked. The other levels are still being filled in.
- **Resources:** each course page lists notes, previous-year questions, TA sessions, books and practice material shared by students, TAs and instructors, with a badge when a login is needed.
- **Important links:** the handbook, grading document, academic calendar, score checker and other pages students use most.
- **Contributors:** a page thanking everyone whose notes and time went into the site.
- **Extras:** search that forgives typos, and Current, Light and Dark themes.

## How it's made

Each course is one file in `data/courses/`. The pages in `courses/` are generated from those files, so edit the data and not the HTML. See `tools/README.md` for the local dashboard and the generator.

## Copyright and content

No official IITM material is hosted in this repo. Every slide, video, and past-paper link points out to the student portal, YouTube, or a student-owned Drive folder. This project is not affiliated with or endorsed by IIT Madras. Course details here may be outdated or incorrect, so always check the official handbook and grading document on the IITM study portal for up-to-date, accurate information.

## Contributing

Found a mistake, or have a resource to add? Open an issue or a pull request, or use the Contributors page on the site to find the other ways to reach us. Corrections to a syllabus, a missing video link, or a broken resource are all welcome.
