"""The Companion — course dashboard.

A small local CRUD admin for the course site: add/edit/delete a course, edit
its syllabus/faculty/week-by-week, its PYQ table, and its lecture playlist
(paste an ordered list, or a YouTube playlist URL — no API key needed).
Every save writes data/courses/<code>.json, regenerates that course's HTML
page, and keeps courses.html's listing in sync.

Run it from the site's own tools/dashboard folder:
    pip install -r requirements.txt
    python app.py
then open http://localhost:5000 — leave your existing localhost:8000 static
preview running separately, they don't conflict.
"""
import os, sys, json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # tools/
import generate
import playlist_import as pi

from flask import Flask, request, redirect, url_for, render_template_string, flash

app = Flask(__name__)
app.secret_key = "companion-dashboard-local-only"

PROGRAMS = list(generate.SECTION_MAP.keys())

STYLE = """
<style>
  :root{ --paper:#f4efe6; --paper-2:#ebe4d5; --ink:#1c1a17; --ink-2:#4a453d;
         --rule:#c9c1b0; --accent:#7a1e28; --accent-2:#b8642a; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:15px/1.55 'Inter',system-ui,sans-serif;padding:0 0 60px}
  a{color:var(--accent)}
  .wrap{max-width:960px;margin:0 auto;padding:0 24px}
  header.top{border-bottom:3px double var(--ink);padding:16px 0;margin-bottom:24px}
  header.top h1{font-family:Georgia,serif;font-size:26px;margin:0}
  header.top .sub{font-family:monospace;font-size:12px;color:var(--ink-2);letter-spacing:.05em}
  .flash{background:#e7f3e8;border:1px solid #8cbf95;padding:10px 14px;margin-bottom:16px;border-radius:4px}
  .flash.error{background:#fbe7e7;border-color:var(--accent)}
  table.list{width:100%;border-collapse:collapse;font-size:14px}
  table.list th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;
    color:var(--ink-2);border-bottom:2px solid var(--ink);padding:8px}
  table.list td{padding:8px;border-bottom:1px dotted var(--rule);vertical-align:top}
  table.list tr:hover{background:var(--paper-2)}
  .code{font-family:monospace;color:var(--accent)}
  .kind-project{color:var(--ink-2);font-style:italic;font-size:12px}
  .btn{display:inline-block;padding:6px 14px;background:var(--accent);color:#fff;
    border:none;border-radius:4px;cursor:pointer;text-decoration:none;font-size:13px}
  .btn.secondary{background:var(--ink-2)}
  .btn.danger{background:#a33}
  form.inline{display:inline}
  .toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px}
  .toolbar input[type=search]{padding:8px 10px;border:1px solid var(--rule);border-radius:4px;min-width:260px}
  fieldset{border:1px solid var(--rule);border-radius:6px;margin-bottom:18px;padding:14px 18px}
  legend{font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;
    color:var(--ink-2);padding:0 6px}
  label{display:block;font-size:12px;color:var(--ink-2);margin:10px 0 3px;font-weight:600}
  input[type=text],input[type=number],input[type=url],select,textarea{
    width:100%;padding:8px 10px;border:1px solid var(--rule);border-radius:4px;
    font:14px/1.4 'Inter',sans-serif;background:#fff}
  textarea{font-family:'JetBrains Mono',monospace;font-size:12.5px}
  .hint{font-size:11.5px;color:var(--ink-2);margin-top:2px}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
  .actions{margin-top:20px;display:flex;gap:10px}
</style>
"""


def layout(title, body):
    return render_template_string("""<!doctype html><html><head><meta charset="utf-8">
<title>{{ title }} — Companion Dashboard</title>{{ style|safe }}</head><body>
<header class="top"><div class="wrap">
  <h1><a href="{{ url_for('index') }}" style="color:inherit;text-decoration:none">The Companion</a> — dashboard</h1>
  <div class="sub">local admin, not published — edits regenerate the real course pages</div>
</div></header>
<div class="wrap">
{% with messages = get_flashed_messages(with_categories=true) %}
  {% for cat, msg in messages %}<div class="flash {{ cat }}">{{ msg }}</div>{% endfor %}
{% endwith %}
{{ body|safe }}
</div>
</body></html>""", title=title, style=STYLE, body=body)


# --- line-based field encode/decode helpers -------------------------------

def resources_to_text(resources):
    lines = []
    for r in resources or []:
        if "url" in r:
            lines.append(f'{r.get("label","")} | {r["url"]}')
        else:
            lines.append(r.get("raw", ""))
    return "\n".join(lines)

def text_to_resources(text):
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        if "|" in line:
            label, url = line.split("|", 1)
            out.append({"label": label.strip(), "url": url.strip()})
        else:
            out.append({"raw": line})
    return out

def lines_to_list(text):
    return [l.strip() for l in text.splitlines() if l.strip()]

def list_to_lines(items):
    return "\n".join(items or [])

def weeks_text_to_text(weeks_text):
    return "\n".join(f'{w["label"]}: {w["text"]}' for w in weeks_text or [])

def text_to_weeks_text(text):
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        if ":" in line:
            label, body = line.split(":", 1)
            out.append({"label": label.strip(), "text": body.strip()})
        else:
            out.append({"label": f"Week {len(out)+1}", "text": line})
    return out

def pyq_to_text(pyq):
    lines = []
    for r in pyq or []:
        lines.append(f'{r.get("term","")} | {r.get("paper_url") or ""} | '
                      f'{r.get("solutions_url") or ""} | {r.get("notes") or ""}')
    return "\n".join(lines)

def text_to_pyq(text):
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        parts = [p.strip() for p in line.split("|")]
        while len(parts) < 4: parts.append("")
        term, paper_url, sol_url, notes = parts[:4]
        out.append({"term": term, "paper_url": paper_url or None, "paper_label": "Paper",
                     "solutions_url": sol_url or None, "solutions_label": "Solutions",
                     "notes": notes})
    return out

def sessions_to_text(sessions):
    lines = []
    for r in sessions or []:
        lines.append(f'{r.get("term","")} | {r.get("label","")} | {r.get("url") or ""}')
    return "\n".join(lines)

def text_to_sessions(text):
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        parts = [p.strip() for p in line.split("|")]
        while len(parts) < 3: parts.append("")
        term, label, url = parts[:3]
        out.append({"term": term, "label": label, "url": url or None})
    return out


# --- routes ----------------------------------------------------------------

@app.route("/")
def index():
    q = request.args.get("q", "").strip().lower()
    courses = generate.load_all()
    if q:
        courses = [c for c in courses if q in c["code"].lower() or q in c["title"].lower()
                   or q in c.get("program", "").lower()]
    courses.sort(key=lambda c: (c.get("program", ""), c["code"]))
    rows = "".join(f"""<tr>
      <td class="code">{c['code']}</td>
      <td>{c['title']}{' <span class="kind-project">(project)</span>' if c['kind']=='project' else ''}</td>
      <td>{c.get('program','')}</td>
      <td>{c.get('credits','')} cr</td>
      <td>
        <a class="btn" href="{url_for('edit', stem=c['stem'])}">Edit</a>
        <form class="inline" method="post" action="{url_for('delete', stem=c['stem'])}"
              onsubmit="return confirm('Delete {c['code']} — {c['title']}? This removes its page and listing.');">
          <button class="btn danger" type="submit">Delete</button>
        </form>
      </td>
    </tr>""" for c in courses)
    body = f"""
    <div class="toolbar">
      <form method="get"><input type="search" name="q" value="{q}" placeholder="Search code, title, program…"></form>
      <a class="btn" href="{url_for('new')}">+ New course</a>
    </div>
    <table class="list">
      <thead><tr><th>Code</th><th>Title</th><th>Program</th><th>Credits</th><th></th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <p class="hint">{len(courses)} course(s) shown.</p>
    """
    return layout("Courses", body)


def _course_fields_form(data, is_new=False):
    program_options = "".join(
        f'<option value="{p}" {"selected" if data.get("program")==p else ""}>{p}</option>'
        for p in PROGRAMS)
    kind_options = "".join(
        f'<option value="{k}" {"selected" if data.get("kind")==k else ""}>{k}</option>'
        for k in ["lecture", "project"])

    stem_field = (f'<input type="text" name="stem" value="{data.get("stem","")}" required '
                  f'pattern="[a-z0-9]+" placeholder="e.g. cs2009">' if is_new else
                  f'<input type="text" value="{data["stem"]}" disabled>'
                  f'<input type="hidden" name="stem" value="{data["stem"]}">')

    common = f"""
    <fieldset><legend>Basics</legend>
      <div class="row3">
        <div><label>Stem (filename, permanent)</label>{stem_field}</div>
        <div><label>Code</label><input type="text" name="code" value="{data.get('code','')}" required></div>
        <div><label>Kind</label><select name="kind">{kind_options}</select></div>
      </div>
      <label>Title</label><input type="text" name="title" value="{data.get('title','')}" required>
      <div class="row3">
        <div><label>Program (section on courses.html)</label><select name="program">{program_options}</select></div>
        <div><label>Credits</label><input type="number" name="credits" value="{data.get('credits',4)}"></div>
        <div><label>Term</label><input type="text" name="term" value="{data.get('term','')}"></div>
      </div>
      <label>Standfirst (one-line summary)</label>
      <input type="text" name="standfirst" value="{data.get('standfirst','')}">
      <div class="row2">
        <div><label>Instructor</label><input type="text" name="instructor" value="{data.get('instructor','')}"></div>
        <div><label>Prereq</label><input type="text" name="prereq" value="{data.get('prereq','')}"></div>
      </div>
    </fieldset>
    """

    pyq_block = f"""
    <fieldset><legend>Previous year questions — one per line: Term | Paper URL | Solutions URL | Notes</legend>
      <textarea name="pyq_text" rows="4">{pyq_to_text(data.get('pyq'))}</textarea>
    </fieldset>
    """

    if data.get("kind") == "project":
        syllabus = data.get("syllabus_body_html", "")
        milestones = data.get("milestones_html", "")
        sessions = data.get("sessions", [])
        kind_block = f"""
        <fieldset><legend>Syllabus (raw HTML — paragraphs, lists, links)</legend>
          <textarea name="syllabus_body_html" rows="8">{syllabus}</textarea>
        </fieldset>
        <fieldset><legend>Milestones (raw HTML)</legend>
          <textarea name="milestones_html" rows="3">{milestones}</textarea>
        </fieldset>
        <fieldset><legend>Project sessions — one per line: Term | Label | URL</legend>
          <textarea name="sessions_text" rows="4">{sessions_to_text(sessions)}</textarea>
          <p class="hint">Leave URL blank for a term with no session recorded yet.</p>
        </fieldset>
        """
    else:
        res = data.get("resources", [])
        syl = data.get("syllabus", {})
        weeks_data = data.get("weeks_data", [])
        kind_block = f"""
        <fieldset><legend>Resources — one per line: Label | URL</legend>
          <textarea name="resources_text" rows="3">{resources_to_text(res)}</textarea>
          <label>Resources note (optional, e.g. access restrictions)</label>
          <input type="text" name="resources_note" value="{data.get('resources_note','')}">
        </fieldset>
        <fieldset><legend>Syllabus — description</legend>
          <label>Description paragraphs — one per line (basic HTML like &lt;b&gt; is fine)</label>
          <textarea name="description_text" rows="4">{list_to_lines(syl.get('description_paragraphs'))}</textarea>
        </fieldset>
        <fieldset><legend>Syllabus — faculty</legend>
          <label>Faculty — one per line</label>
          <textarea name="faculty_text" rows="3">{list_to_lines(syl.get('faculty'))}</textarea>
          <label>Faculty note (shown instead, if faculty list above is left empty)</label>
          <input type="text" name="faculty_note" value="{syl.get('faculty_note','')}">
        </fieldset>
        <fieldset><legend>Syllabus — week-by-week</legend>
          <label>One per line: Week N: description</label>
          <textarea name="weeks_text_text" rows="6">{weeks_text_to_text(syl.get('weeks_text'))}</textarea>
          <label>Note (shown instead, if left empty — e.g. "not yet introduced")</label>
          <input type="text" name="weeks_note" value="{syl.get('weeks_note','')}">
        </fieldset>
        <fieldset><legend>Lecture playlist (WEEKS_DATA)</legend>
          <label>One week header per line, then "number | title | video id or URL | slide URL" per lecture</label>
          <textarea name="weeks_data_text" rows="12">{pi.weeks_data_to_text(weeks_data)}</textarea>
          <div class="actions">
            <button class="btn secondary" type="submit" name="action" value="save">Save playlist text above</button>
          </div>
        </fieldset>
        """

    return common + pyq_block + kind_block


@app.route("/new", methods=["GET", "POST"])
def new():
    if request.method == "GET":
        blank = {"kind": "lecture", "credits": 4, "program": PROGRAMS[0]}
        body = f"""<h2>New course</h2>
        <form method="post">{_course_fields_form(blank, is_new=True)}
        <div class="actions"><button class="btn" type="submit">Create</button></div>
        </form>"""
        return layout("New course", body)

    stem = request.form["stem"].strip().lower()
    if generate.all_stems() and stem in generate.all_stems():
        flash(f"A course with stem '{stem}' already exists.", "error")
        return redirect(url_for("new"))

    data = _collect_from_form(request.form, stem)
    generate.save(stem, data)
    generate.generate_course(stem)
    html = generate.read_index()
    html = generate.add_course_to_index(html, data)
    generate.write_index(html)
    flash(f"Created {data['code']} — {data['title']}.", "ok")
    return redirect(url_for("edit", stem=stem))


@app.route("/edit/<stem>", methods=["GET", "POST"])
def edit(stem):
    data = generate.load(stem)
    if request.method == "GET":
        body = f"""<h2>Edit {data['code']} — {data['title']}</h2>
        <form method="post">{_course_fields_form(data)}
        <div class="actions">
          <button class="btn" type="submit">Save</button>
          <a class="btn secondary" href="/../courses/{stem}.html" target="_blank">Preview page</a>
        </div>
        </form>
        <h3 style="margin-top:36px">Import a lecture playlist</h3>
        <form method="post" action="{url_for('import_playlist', stem=stem)}">
          <label>Paste an ordered list (one per line: URL or video id, optional "| Title"), OR a YouTube playlist URL</label>
          <textarea name="pasted" rows="6" placeholder="https://youtube.com/playlist?list=... &#10;— or —&#10;dQw4w9WgXcQ | Lecture 1 title"></textarea>
          <p class="hint">Spreads the videos evenly across the course's existing weeks (or 12 fresh ones), in order. Review the Lecture playlist box above afterwards.</p>
          <div class="actions"><button class="btn secondary" type="submit">Import into playlist</button></div>
        </form>
        """
        return layout(f"Edit {data['code']}", body)

    old_code = data["code"]
    new_data = _collect_from_form(request.form, stem, existing=data)
    generate.save(stem, new_data)
    generate.generate_course(stem)
    html = generate.read_index()
    html, _ = generate.remove_course_from_index(html, old_code)
    html = generate.add_course_to_index(html, new_data)
    generate.write_index(html)
    flash(f"Saved {new_data['code']}.", "ok")
    return redirect(url_for("edit", stem=stem))


@app.route("/edit/<stem>/playlist", methods=["POST"])
def import_playlist(stem):
    data = generate.load(stem)
    pasted = request.form.get("pasted", "").strip()
    if not pasted:
        flash("Paste a playlist URL or an ordered list first.", "error")
        return redirect(url_for("edit", stem=stem))

    if pasted.startswith("http") and ("list=" in pasted or "/playlist" in pasted):
        try:
            items = pi.fetch_youtube_playlist(pasted)
        except Exception as e:
            flash(f"Couldn't fetch that playlist: {e}", "error")
            return redirect(url_for("edit", stem=stem))
    else:
        items = pi.parse_pasted_list(pasted)

    if not items:
        flash("Didn't recognize any videos in that input.", "error")
        return redirect(url_for("edit", stem=stem))

    data["weeks_data"] = pi.distribute_into_weeks(items, data.get("weeks_data") or [])
    generate.save(stem, data)
    generate.generate_course(stem)
    flash(f"Imported {len(items)} lecture(s) into the playlist across {len(data['weeks_data'])} weeks.", "ok")
    return redirect(url_for("edit", stem=stem))


@app.route("/delete/<stem>", methods=["POST"])
def delete(stem):
    data = generate.load(stem)
    html = generate.read_index()
    html, _ = generate.remove_course_from_index(html, data["code"])
    generate.write_index(html)
    generate.delete_course_files(stem)
    flash(f"Deleted {data['code']} — {data['title']}.", "ok")
    return redirect(url_for("index"))


def _collect_from_form(form, stem, existing=None):
    kind = form.get("kind", "lecture")
    data = {
        "stem": stem, "kind": kind,
        "code": form.get("code", "").strip(),
        "title": form.get("title", "").strip(),
        "program": form.get("program", PROGRAMS[0]),
        "credits": int(form.get("credits") or 4),
        "standfirst": form.get("standfirst", "").strip(),
        "instructor": form.get("instructor", "").strip(),
        "term": form.get("term", "").strip(),
        "prereq": form.get("prereq", "").strip(),
        "pyq": text_to_pyq(form.get("pyq_text", "")),
    }
    if kind == "project":
        data["syllabus_body_html"] = form.get("syllabus_body_html", "").strip()
        data["milestones_html"] = form.get("milestones_html", "").strip()
        data["sessions"] = text_to_sessions(form.get("sessions_text", ""))
    else:
        data["resources"] = text_to_resources(form.get("resources_text", ""))
        data["resources_note"] = form.get("resources_note", "").strip()
        data["syllabus"] = {
            "description_paragraphs": lines_to_list(form.get("description_text", "")),
            "faculty": lines_to_list(form.get("faculty_text", "")),
            "faculty_note": form.get("faculty_note", "").strip(),
            "weeks_text": text_to_weeks_text(form.get("weeks_text_text", "")),
            "weeks_note": form.get("weeks_note", "").strip(),
        }
        data["weeks_data"] = pi.text_to_weeks_data(form.get("weeks_data_text", ""))
    return data


if __name__ == "__main__":
    print(f"Site root: {generate.SITE_ROOT}")
    print(f"Data dir : {generate.DATA_DIR}")
    app.run(debug=True, port=5000)
