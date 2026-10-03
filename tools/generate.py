"""Regenerates courses/<code>.html from data/courses/<code>.json, and keeps
index.html's course listing in sync. This is the one place that knows how a
course's JSON turns into a page — the dashboard (dashboard/app.py) calls into
this module on every save; it's never edited by hand once shipped.

Layout this expects (site root = the folder holding index.html):
  index.html
  assets/term-syllabus.js
  courses/<code>.html          <- generated, do not hand-edit
  data/courses/<code>.json     <- the actual source of truth
  tools/generate.py            <- this file
  tools/templates/*.j2
"""
import json, os, glob, re
import jinja2

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
# Override with the COMPANION_SITE_ROOT env var when testing against a scratch copy
# of the site instead of the real one (tools/ is normally a subfolder of site root).
SITE_ROOT = os.environ.get("COMPANION_SITE_ROOT") or os.path.dirname(TOOLS_DIR)
DATA_DIR = os.path.join(SITE_ROOT, "data", "courses")
TEMPLATES_DIR = os.path.join(TOOLS_DIR, "templates")
COURSES_DIR = os.path.join(SITE_ROOT, "courses")
INDEX_PATH = os.path.join(SITE_ROOT, "index.html")

env = jinja2.Environment(loader=jinja2.FileSystemLoader(TEMPLATES_DIR))
# Keep the original (insertion) key order in WEEKS_DATA's tojson output instead of
# Jinja's default alphabetical sort, and compact separators, so regenerated pages
# diff cleanly against what's already committed.
env.policies["json.dumps_kwargs"] = {"sort_keys": False, "ensure_ascii": True,
                                      "separators": (",", ":")}

TPL = {"lecture": env.get_template("lecture.html.j2"),
       "project": env.get_template("project.html.j2")}

SECTION_MAP = {
    "Foundation": "foundation",
    "Diploma / Programming": "diploma-p",
    "Diploma / Data Science": "diploma-ds",
    "BSc / BS": "bsc",
    "BS elective": "bs",
    "PG Diploma": "pgd",
    "MTech": "mtech",
}


def data_path(stem):
    return os.path.join(DATA_DIR, stem + ".json")


def load(stem):
    return json.load(open(data_path(stem), encoding="utf-8"))


def save(stem, data):
    os.makedirs(DATA_DIR, exist_ok=True)
    json.dump(data, open(data_path(stem), "w", encoding="utf-8"), indent=1, ensure_ascii=False)


def all_stems():
    return sorted(os.path.splitext(os.path.basename(f))[0]
                  for f in glob.glob(os.path.join(DATA_DIR, "*.json")))


def load_all():
    return [load(s) for s in all_stems()]


def render_course(data):
    tpl = TPL[data["kind"]]
    return tpl.render(**data) + "\n"


def generate_course(stem):
    data = load(stem)
    html = render_course(data)
    os.makedirs(COURSES_DIR, exist_ok=True)
    path = os.path.join(COURSES_DIR, stem + ".html")
    open(path, "w", encoding="utf-8").write(html)
    return path


def generate_all():
    return [generate_course(s) for s in all_stems()]


def delete_course_files(stem):
    path = os.path.join(COURSES_DIR, stem + ".html")
    if os.path.exists(path):
        os.remove(path)
    if os.path.exists(data_path(stem)):
        os.remove(data_path(stem))


# ---------------------------------------------------------------------------
# index.html: the course catalog listing. Every course's <li> lives inside a
# <section id="..."> for its program, in one of that section's two <ol> columns.

def _build_li(data):
    cls = ' class="project"' if data["kind"] == "project" else ""
    href = f'courses/{data["stem"]}.html'
    return (f'<li{cls}><span class="code">{data["code"]}</span>'
            f'<span class="name"><a href="{href}">{data["title"]}</a></span>'
            f'<span class="credits">{data["credits"]} cr</span></li>')


def add_course_to_index(html, data):
    """Insert a new course's <li> into its program's section, in whichever of
    that section's two <ol> columns currently has fewer entries."""
    section_id = SECTION_MAP.get(data["program"])
    if not section_id:
        raise ValueError(f"unknown program {data['program']!r} - not in SECTION_MAP")
    sec_m = re.search(rf'<section id="{re.escape(section_id)}" class="level">.*?</section>', html, re.S)
    if not sec_m:
        raise ValueError(f"section #{section_id} not found in index.html")
    sec_start, sec_end = sec_m.start(), sec_m.end()
    section_html = html[sec_start:sec_end]

    ols = list(re.finditer(r'<ol class="courses">(.*?)</ol>', section_html, re.S))
    if not ols:
        raise ValueError(f"no <ol class=\"courses\"> found in section #{section_id}")
    counts = [len(re.findall(r'<li', o.group(1))) for o in ols]
    target = ols[counts.index(min(counts))]

    # absolute offset of "</ol>" for the chosen column
    insert_at = sec_start + target.end(1)
    li_html = "      " + _build_li(data) + "\n    "
    return html[:insert_at] + li_html + html[insert_at:]


def remove_course_from_index(html, code):
    pattern = rf'[ \t]*<li[^>]*><span class="code">{re.escape(code)}</span>.*?</li>\n?'
    new_html, n = re.subn(pattern, "", html, count=1, flags=re.S)
    return new_html, n > 0


def read_index():
    return open(INDEX_PATH, encoding="utf-8").read()


def write_index(html):
    open(INDEX_PATH, "w", encoding="utf-8").write(html)


# ---------------------------------------------------------------------------
# Important links tab on index.html. Content lives in data/links.json; the HTML
# between the LINKS markers in index.html is rebuilt from it.

LINKS_PATH = os.path.join(os.path.dirname(DATA_DIR), "links.json")


def _esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def render_links(data):
    out = []
    if data.get("intro"):
        out.append(f'      <p class="links-intro">{_esc(data["intro"])}</p>')
    for g in data["groups"]:
        out.append(f'      <div class="link-group" id="links-{_esc(g["id"])}">')
        out.append(f'        <div class="level-subhead">{_esc(g["title"])}</div>')
        out.append('        <ul class="links-list">')
        for it in g["items"]:
            anchors = ", ".join(
                f'<a href="{_esc(l["url"])}" target="_blank" rel="noopener">{_esc(l["label"])}</a>'
                for l in it["links"])
            first = it["links"][0]
            if len(it["links"]) == 1:
                title = f'<a href="{_esc(first["url"])}" target="_blank" rel="noopener">{_esc(it["title"])}</a>'
                right = ""
            else:
                title = _esc(it["title"])
                right = f'<span class="lk-more">{anchors}</span>'
            out.append(f'          <li><span class="lk-title">{title}</span>'
                       f'<span class="lk-desc">{_esc(it["desc"])}</span>{right}</li>')
        out.append('        </ul>')
        out.append('      </div>')
    return "\n".join(out)


def generate_links():
    data = json.load(open(LINKS_PATH, encoding="utf-8"))
    html = read_index()
    pat = re.compile(r'<!-- LINKS:START -->.*?<!-- LINKS:END -->', re.S)
    if not pat.search(html):
        raise ValueError("LINKS markers not found in index.html")
    block = "<!-- LINKS:START -->\n" + render_links(data) + "\n      <!-- LINKS:END -->"
    html = pat.sub(lambda m: block, html, count=1)
    write_index(html)
    return INDEX_PATH


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        for stem in sys.argv[1:]:
            print(generate_links() if stem == "links" else generate_course(stem))
    else:
        paths = generate_all()
        print(f"generated {len(paths)} pages into {COURSES_DIR}")
        generate_links()
