# tools/ — the dashboard and page generator

This folder is how course pages get built and edited from here on. `courses/*.html`
and `courses.html`'s listing are **generated** — don't hand-edit them, edits get
overwritten the next time a course is regenerated. The real content lives in
`data/courses/<code>.json`, one file per course.

## Running the dashboard

```
cd tools/dashboard
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5000`. This is separate from whatever you use to
preview the site itself (e.g. `python -m http.server 8000` from the site root) —
run both at once, they don't conflict. The dashboard writes straight into
`data/courses/`, `courses/`, and `courses.html` in this repo; refresh your
localhost:8000 tab to see a change.

From the dashboard you can:

- **Add a course** — fills in the basics, drops it into the right section of
  `courses.html` automatically (by the Program field), and scaffolds an empty
  syllabus/playlist ready to fill in.
- **Edit a course** — syllabus (description, faculty, week-by-week), previous
  year questions, resources, and its lecture playlist, all as plain-text
  fields (see the format notes below).
- **Delete a course** — removes its page, its data file, and its `courses.html`
  row.
- **Import a lecture playlist** — paste an ordered list of videos (one per
  line, `<url or id> | <title>`), or paste a YouTube playlist URL directly
  (pulled via `yt-dlp`, no API key needed) — either way it spreads them evenly
  across the course's existing weeks, in order.

## Editing a course's JSON by hand instead

If you'd rather skip the dashboard for a small fix, `data/courses/<code>.json`
is plain JSON and safe to hand-edit — then regenerate from inside `tools/`:

```
python generate.py            # regenerate every page
python generate.py cs2001     # regenerate just one
```

Hand-editing `courses.html`'s listing directly still works too, but won't
survive the next time that course is added or edited through the dashboard
(which resyncs its own row, not the rest of the file).

## The little text formats

A few fields use a one-line-per-entry format instead of a form-per-field, so
they're fast to paste into and edit:

```
Resources / Project sessions:   Label | URL
PYQ:                             Term | Paper URL | Solutions URL | Notes
Faculty:                         one name per line
Week-by-week syllabus:           Week 1: description text
```

The lecture playlist (WEEKS_DATA) is its own small block: a line with no `|`
starts a new week (its text is the week's label); a line with `|` is one
lecture — `number | title | video id or URL | slide URL` (leave either blank
if there's nothing to link yet).

## Extra sidebar tabs (OPPE, NPPE, Project, course website)

A course can have extra tabs under Syllabus in the sidebar. They live in the
course JSON as an optional `extra_tabs` list, one object per tab:

```
"extra_tabs": [
  {
    "id": "oppe",                      # short, unique per course
    "label": "OPPE",                   # text shown in the sidebar
    "standfirst": "One line about the tab.",
    "links_heading": "Practice and solutions",
    "links": [{"url": "...", "label": "...", "by": "Author", "by_url": "..."}],
    "embed": {"title": "...", "url": "..."}   # optional: shows a site inside the tab
  }
]
```

Set `"hide_lectures": true` on a course to hide the Weekly Lectures list from the sidebar (used for MLOps, whose own website has the lectures). `links`, `by`, `by_url` and `embed` are all optional. Embedded sites only load
when the tab is first opened. Regenerate with `python generate.py <code>`.

## What each file is

```
tools/generate.py            Turns data/courses/<code>.json into courses/<code>.html,
                              and keeps courses.html's listing in sync (add/remove a row).
                              Run directly to regenerate every page: python generate.py
tools/migrate.py              The one-off script that produced the original data/courses/
                              JSON files from the hand-built HTML pages that came before
                              this system. Kept for reference — not part of the normal
                              add/edit workflow.
tools/templates/*.j2          The two page templates (lecture course, project course)
                              that generate.py fills in. Change the template here once
                              and every page picks it up on the next regenerate — this is
                              the whole point of the data-driven system: no more editing
                              65 files by hand for one shared change.
tools/dashboard/app.py         The CRUD dashboard described above.
tools/dashboard/playlist_import.py   Playlist parsing/import + the WEEKS_DATA text format.
```

`assets/term-syllabus.js` (the shared quiz/end-term calendar data) is separate
from all of this — it's still hand-edited directly, once per term, exactly as
before.
