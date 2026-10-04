"""Regenerates courses/<code>.html from data/courses/<code>.json, and keeps
courses.html's course listing in sync. This is the one place that knows how a
course's JSON turns into a page — the dashboard (dashboard/app.py) calls into
this module on every save; it's never edited by hand once shipped.

Layout this expects (site root = the folder holding index.html):
  index.html                   <- landing page (hand-written)
  courses.html                 <- course listing, rows kept in sync here
  links.html                   <- Important links page, generated from data/links.json
  assets/site.css, site.js     <- shared styles and behaviour
  assets/menu-data.js          <- generated: feeds the top-bar dropdowns
  assets/term-syllabus.js
  courses/<code>.html          <- generated, do not hand-edit
  data/courses/<code>.json     <- the actual source of truth
  tools/generate.py            <- this file
  tools/templates/*.j2
"""
import json, os, glob, re
from urllib.parse import urlparse
import html as html_lib
import hashlib
import jinja2

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
# Override with the COMPANION_SITE_ROOT env var when testing against a scratch copy
# of the site instead of the real one (tools/ is normally a subfolder of site root).
SITE_ROOT = os.environ.get("COMPANION_SITE_ROOT") or os.path.dirname(TOOLS_DIR)
DATA_DIR = os.path.join(SITE_ROOT, "data", "courses")
TEMPLATES_DIR = os.path.join(TOOLS_DIR, "templates")
COURSES_DIR = os.path.join(SITE_ROOT, "courses")
COURSES_PAGE = os.path.join(SITE_ROOT, "courses.html")
LINKS_PAGE = os.path.join(SITE_ROOT, "links.html")
CONTRIB_PAGE = os.path.join(SITE_ROOT, "contributors.html")
CONTRIB_PATH = os.path.join(SITE_ROOT, "data", "contributors.json")
CONTRIB_TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "contributors.html.tpl")
MENU_JS = os.path.join(SITE_ROOT, "assets", "menu-data.js")
INDEX_PATH = COURSES_PAGE  # the course listing (kept under its old name for callers)
MENU_EXCLUDE = {"mtech"}   # sections left out of the Courses dropdown

env = jinja2.Environment(loader=jinja2.FileSystemLoader(TEMPLATES_DIR))
# Keep the original (insertion) key order in WEEKS_DATA's tojson output instead of
# Jinja's default alphabetical sort, and compact separators, so regenerated pages
# diff cleanly against what's already committed.
env.policies["json.dumps_kwargs"] = {"sort_keys": False, "ensure_ascii": True,
                                      "separators": (",", ":")}

def _group_resources(items):
    """Group resource dicts by their optional "group", keeping first-appearance order.
    Items with no group come out as one unnamed group (rendered without a heading)."""
    groups, index = [], {}
    for r in items or []:
        name = r.get("group", "") if isinstance(r, dict) else ""
        if name not in index:
            index[name] = {"name": name, "rows": []}
            groups.append(index[name])
        index[name]["rows"].append(r)
    return groups


def _host(url):
    m = re.match(r"https?://(?:www\.)?([^/?#]+)", url or "")
    return m.group(1) if m else ""


def _login_badge(r):
    """Badge text for a resource dict: explicit "auth" ("iitm" / "site") wins, else Discourse links."""
    auth = r.get("auth") if isinstance(r, dict) else ""
    if auth == "iitm":
        return "IITM login required"
    if auth == "site":
        return "Login needed for full access"
    url = r.get("url", "") if isinstance(r, dict) else str(r or "")
    return "Discourse login required" if "discourse.onlinedegree.iitm.ac.in" in url else ""


env.filters.update(group_resources=_group_resources, host=_host, login_badge=_login_badge)

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


# Asset links carry ?v=<hash of the file>, so a browser never pairs a new page with a stale cached
# stylesheet or script (that mismatch is how a dark theme ends up with a light top bar).
ASSET_RE = re.compile(r'(assets/(?:site\.css|site\.js|theme\.css|theme\.js|menu-data\.js|term-syllabus\.js))(?:\?v=[0-9a-f]+)?')


def _asset_ver(rel):
    try:
        return hashlib.md5(open(os.path.join(SITE_ROOT, rel), "rb").read()).hexdigest()[:8]
    except OSError:
        return "0"


def stamp_assets(html):
    return ASSET_RE.sub(lambda m: f"{m.group(1)}?v={_asset_ver(m.group(1))}", html)


def restamp_pages():
    """Refresh the ?v= stamps on the three top-level pages (index, courses, links)."""
    for name in ("index.html", "courses.html", "links.html", "contributors.html"):
        path = os.path.join(SITE_ROOT, name)
        if os.path.exists(path):
            old = open(path, encoding="utf-8").read()
            new = stamp_assets(old)
            if new != old:
                open(path, "w", encoding="utf-8").write(new)


def render_course(data):
    tpl = TPL[data["kind"]]
    return stamp_assets(tpl.render(**data) + "\n")


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
        raise ValueError(f"section #{section_id} not found in courses.html")
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
    open(COURSES_PAGE, "w", encoding="utf-8").write(html)
    write_menu(html)
    restamp_pages()


def write_menu(courses_html=None):
    """assets/menu-data.js feeds the dropdowns on every page: levels come from
    courses.html, link groups from data/links.json."""
    if courses_html is None:
        courses_html = open(COURSES_PAGE, encoding="utf-8").read()
    levels = []
    for m in re.finditer(r'<section id="([^"]+)" class="level">(.*?)</section>', courses_html, re.S):
        sid, body = m.group(1), m.group(2)
        if sid in MENU_EXCLUDE:
            continue
        roman = re.search(r'<span class="roman">(.*?)</span>', body, re.S)
        title = re.search(r'<h2>(.*?)</h2>', body, re.S)
        levels.append({"id": sid,
                       "roman": (roman.group(1) if roman else "").replace("Part ", "").strip(),
                       "title": html_lib.unescape(re.sub(r"<[^>]+>", "", title.group(1))).strip() if title else sid,
                       "count": len(re.findall(r'<li\b', body))})
    links = json.load(open(LINKS_PATH, encoding="utf-8"))
    groups = [{"id": g["id"], "title": g["title"], "count": len(g["items"])} for g in links["groups"]]
    menu = {"courses": {"total": sum(l["count"] for l in levels), "items": levels},
            "links": {"total": sum(g["count"] for g in groups), "items": groups}}
    os.makedirs(os.path.dirname(MENU_JS), exist_ok=True)
    open(MENU_JS, "w", encoding="utf-8").write(
        "/* generated by tools/generate.py, do not edit */\nwindow.COMPANION_MENU = "
        + json.dumps(menu, ensure_ascii=False) + ";\n")


# ---------------------------------------------------------------------------
# Important links page (links.html). Content lives in data/links.json; the HTML
# between the LINKS markers in links.html is rebuilt from it.

LINKS_PATH = os.path.join(os.path.dirname(DATA_DIR), "links.json")


def _esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


AUTH_BADGES = {
    "discourse": "Discourse login required",
    "iitm": "IITM login required",
    "site": "Login needed for full access",
}


def _auth_of(item):
    """Explicit item["auth"] wins; otherwise any Discourse link implies a Discourse login."""
    if item.get("auth"):
        return item["auth"]
    if any("discourse.onlinedegree.iitm.ac.in" in l["url"] for l in item["links"]):
        return "discourse"
    return ""


def render_links(data):
    out = []
    if data.get("intro"):
        out.append(f'      <p class="links-intro">{_esc(data["intro"])}</p>')
    out.append('      <nav class="links-jump" aria-label="Jump to a group">')
    for g in data["groups"]:
        out.append(f'        <a href="#links-{_esc(g["id"])}">{_esc(g["title"])}</a>')
    out.append('      </nav>')
    for g in data["groups"]:
        out.append(f'      <div class="link-group" id="links-{_esc(g["id"])}">')
        out.append(f'        <div class="group-head"><h3>{_esc(g["title"])}</h3>'
                   f'<span class="group-count">{len(g["items"])}</span></div>')
        out.append('        <ul class="links-grid">')
        for it in g["items"]:
            auth = _auth_of(it)
            badge = (f'<span class="lk-badge {auth}">{_esc(AUTH_BADGES[auth])}</span>'
                     if auth in AUTH_BADGES else "")
            if len(it["links"]) == 1:
                url = _esc(it["links"][0]["url"])
                title = f'<a class="lk-main" href="{url}" target="_blank" rel="noopener">{_esc(it["title"])}</a>'
                more = ""
            else:
                title = _esc(it["title"])
                anchors = "".join(
                    f'<a href="{_esc(l["url"])}" target="_blank" rel="noopener">{_esc(l["label"])}</a>'
                    for l in it["links"])
                more = f'<div class="lk-more">{anchors}</div>'
            foot = f'<div class="lk-foot">{badge}</div>' if badge else ""
            out.append(f'          <li class="lk-card"><h4 class="lk-title">{title}</h4>'
                       f'<p class="lk-desc">{_esc(it["desc"])}</p>{more}{foot}</li>')
        out.append('        </ul>')
        out.append('      </div>')
    return "\n".join(out)


def render_quick(data):
    out = []
    for g in data["groups"]:
        for it in g["items"]:
            pin = it.get("pin")
            if not pin:
                continue
            url = _esc(it["links"][0]["url"])
            out.append(f'        <a class="quick-card" href="{url}" target="_blank" rel="noopener">'
                       f'<span class="qc-title">{_esc(pin["title"])}</span>'
                       f'<span class="qc-tag">{_esc(pin["tag"])}</span></a>')
    return "\n".join(out)


def generate_links():
    data = json.load(open(LINKS_PATH, encoding="utf-8"))
    html = open(LINKS_PAGE, encoding="utf-8").read()
    pat = re.compile(r'<!-- LINKS:START -->.*?<!-- LINKS:END -->', re.S)
    if not pat.search(html):
        raise ValueError("LINKS markers not found in links.html")
    block = "<!-- LINKS:START -->\n" + render_links(data) + "\n      <!-- LINKS:END -->"
    html = pat.sub(lambda m: block, html, count=1)
    qpat = re.compile(r'<!-- QUICK:START -->.*?<!-- QUICK:END -->', re.S)
    if qpat.search(html):
        qblock = "<!-- QUICK:START -->\n" + render_quick(data) + "\n        <!-- QUICK:END -->"
        html = qpat.sub(lambda m: qblock, html, count=1)
    open(LINKS_PAGE, "w", encoding="utf-8").write(html)
    write_menu()
    restamp_pages()
    return LINKS_PAGE


def _platform(url):
    h = urlparse(url).netloc.lower().replace("www.", "")
    for key, label in (("linkedin.com", "LinkedIn"), ("instagram.com", "Instagram"), ("ig.me", "Instagram"),
                       ("linktr.ee", "Linktree"), ("github.com", "GitHub"), ("medium.com", "Medium")):
        if h.endswith(key):
            return label
    return "Website" if h and h != "bit.ly" else "Link"


def _footer_nav(current):
    items = (("index.html", "Home", "home"), ("courses.html", "Courses", "courses"),
             ("links.html", "Important links", "links"), ("contributors.html", "Contributors", "contributors"))
    return "".join('<a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if k == current else "", t) for h, t, k in items)


def generate_contributors():
    """contributors.html is generated whole from data/contributors.json."""
    d = json.load(open(CONTRIB_PATH, encoding="utf-8"))
    CONTRIB_TEMPLATE = open(CONTRIB_TEMPLATE_PATH, encoding="utf-8").read()
    esc = html_lib.escape
    groups_html, jump = [], []
    for g in d["groups"]:
        cards = []
        for pr in g["people"]:
            if pr.get("url"):
                cards.append('<li class="lk-card pp-card"><h4 class="lk-title"><a class="lk-main" href="%s" target="_blank" rel="noopener">%s</a></h4>'
                             '<p class="lk-desc">%s</p></li>' % (esc(pr["url"], quote=True), esc(pr["name"]), _platform(pr["url"])))
            else:
                cards.append('<li class="lk-card pp-card plain"><h4 class="lk-title">%s</h4></li>' % esc(pr["name"]))
        jump.append('<a href="#c-%s">%s</a>' % (g["id"], esc(g["title"])))
        groups_html.append(
            '      <div class="link-group" id="c-%s">\n        <div class="group-head"><h3>%s</h3><span class="group-count">%d</span></div>\n'
            '        <p class="group-intro">%s</p>\n        <ul class="links-grid people-grid">\n          %s\n        </ul>\n      </div>'
            % (g["id"], esc(g["title"]), len(g["people"]), esc(g.get("intro", "")), "\n          ".join(cards)))
    c = d.get("contribute")
    if c:
        cc = []
        for cd in c["cards"]:
            acts = '<a class="cta-btn" href="%s" target="_blank" rel="noopener">%s &#8599;</a>' % (esc(cd["url"], quote=True), esc(cd["label"]))
            if cd.get("url2"):
                acts += '<a class="cta-btn ghost" href="%s" target="_blank" rel="noopener">%s &#8599;</a>' % (esc(cd["url2"], quote=True), esc(cd["label2"]))
            cc.append('<li class="lk-card cta-card"><h4 class="lk-title">%s</h4><p class="lk-desc">%s</p><div class="cta-row">%s</div></li>'
                      % (esc(cd["title"]), esc(cd["text"]), acts))
        jump.append('<a href="#%s">%s</a>' % (c["id"], esc(c["title"])))
        groups_html.append('      <div class="link-group" id="%s">\n        <div class="group-head"><h3>%s</h3></div>\n        <p class="group-intro">%s</p>\n'
                           '        <ul class="links-grid cta-grid">\n          %s\n        </ul>\n      </div>'
                           % (c["id"], esc(c["title"]), esc(c["intro"]), "\n          ".join(cc)))
    m = d.get("missing")
    miss = ('\n      <div class="missing-note"><div><strong>%s</strong><p>%s</p></div>'
            '<a class="cta-btn ghost" href="%s" target="_blank" rel="noopener">%s &#8599;</a></div>'
            % (esc(m["title"]), esc(m["text"]), esc(m["url"], quote=True), esc(m["label"]))) if m else ""
    page = CONTRIB_TEMPLATE.replace("{{TITLE}}", esc(d["title"])).replace("{{SUB}}", esc(d["sub"])) \
        .replace("{{JUMP}}", "".join(jump)).replace("{{GROUPS}}", "\n".join(groups_html) + miss) \
        .replace("{{FOOTNAV}}", _footer_nav("contributors"))
    open(CONTRIB_PAGE, "w", encoding="utf-8").write(stamp_assets(page))
    write_menu()
    return CONTRIB_PAGE


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        for stem in sys.argv[1:]:
            print(generate_links() if stem == "links" else generate_contributors() if stem == "contributors" else generate_course(stem))
    else:
        paths = generate_all()
        print(f"generated {len(paths)} pages into {COURSES_DIR}")
        generate_links()
        generate_contributors()
