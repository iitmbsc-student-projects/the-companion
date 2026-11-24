"""Regenerates courses/<code>.html from data/courses/<code>.json, and keeps
courses.html's course listing in sync. This is the one place that knows how a
course's JSON turns into a page — the dashboard (dashboard/app.py) calls into
this module on every save; it's never edited by hand once shipped.

Layout this expects (site root = the folder holding index.html):
  index.html                   <- home page, generated from templates/home.html.tpl
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
import json
import urllib.parse, os, glob, re
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
SCAM_PAGE = os.path.join(SITE_ROOT, "scam-alert.html")
SCAM_PATH = os.path.join(SITE_ROOT, "data", "scam_alert.json")
SCAM_TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "scam_alert.html.tpl")
CALC_PAGE = os.path.join(SITE_ROOT, "calculator.html")
CALC_PATH = os.path.join(SITE_ROOT, "data", "grading.json")
CALC_TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "calculator.html.tpl")
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
    if auth == "public":
        return ""
    url = r.get("url", "") if isinstance(r, dict) else str(r or "")
    if "drive.google.com" in url:
        return "IITM login required"
    return "Discourse login required" if "discourse.onlinedegree.iitm.ac.in" in url else ""


env.filters.update(group_resources=_group_resources, host=_host, login_badge=_login_badge)

TPL = {"lecture": env.get_template("lecture.html.j2")}
PLACEHOLDER_LECTURE = "No lecture linked yet"

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
ASSET_RE = re.compile(r'(assets/(?:site\.css|site\.js|theme\.css|theme\.js|menu-data\.js|term-syllabus\.js|calculator\.js|course\.js|home\.js|nptel\.js))(?:\?v=[0-9a-f]+)?')


def _asset_ver(rel):
    try:
        return hashlib.md5(open(os.path.join(SITE_ROOT, rel), "rb").read()).hexdigest()[:8]
    except OSError:
        return "0"


def stamp_assets(html):
    return ASSET_RE.sub(lambda m: f"{m.group(1)}?v={_asset_ver(m.group(1))}", html)


def restamp_pages():
    """Refresh the ?v= stamps on the three top-level pages (index, courses, links)."""
    for name in ("index.html", "courses.html", "links.html", "contributors.html", "scam-alert.html", "calculator.html", "nptel.html", "updates.html", "404.html"):
        path = os.path.join(SITE_ROOT, name)
        if os.path.exists(path):
            old = open(path, encoding="utf-8").read()
            new = stamp_assets(old)
            if new != old:
                open(path, "w", encoding="utf-8").write(new)


def render_course(data):
    tpl = TPL["lecture"]   # projects use the same sidebar layout; their "weeks" are terms and their items are recorded sessions
    if data["kind"] == "project":
        # a project belongs to a main course (CS2003P -> CS2003): link back to it
        stem = re.sub(r"p$", "", data["stem"]) if data["stem"].endswith("p") else (data.get("prereq") or "").lower()
        data = dict(data, parent=None, is_project=True, item_word="session", syllabus=data.get("syllabus") or {},
                    weeks_data=data.get("weeks_data") or [], hide_lectures=not data.get("weeks_data"))
        if os.path.exists(data_path(stem)) and stem != data["stem"]:
            pd = load(stem)
            data["parent"] = {"stem": stem, "code": pd["code"], "title": pd["title"]}
    else:
        # a course whose lecture list is only "No lecture linked yet" rows shows no list until real lectures are added
        items = [it for w in data.get("weeks_data") or [] for it in w.get("items", [])]
        if items and all(it.get("t") == PLACEHOLDER_LECTURE and not (it.get("v") or it.get("dv") or it.get("s")) for it in items):
            data = dict(data, weeks_data=[], hide_lectures=True)
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
    """Important links: compact pills in task-based groups. On wide screens the jump chips become a sticky
    list in the left margin (see site.css / site.js)."""
    SRC = {"official": "Official", "student": "Student-made"}
    out = []
    out.append('      <div class="links-layout">')
    out.append('      <nav class="links-jump" aria-label="Jump to a group"><div class="lj-in">')
    for g in data["groups"]:
        short = g.get("short") or g["title"]   # chips use the short name; the wide-screen side list the full one
        out.append(f'        <a href="#links-{_esc(g["id"])}" title="{_esc(g["title"])}"><span class="lj-s">{_esc(short)}</span><span class="lj-f">{_esc(g["title"])}</span></a>')
    out.append('        <span class="lk-legend"><span class="lk-dot official"></span>Official <span class="lk-dot student"></span>Student-made</span>')
    out.append('      </div></nav>')
    out.append('      <div class="links-groups">')
    for g in data["groups"]:
        out.append(f'      <div class="link-group" id="links-{_esc(g["id"])}">')
        out.append(f'        <div class="group-head"><h2>{_esc(g["title"])}</h2>'
                   f'<span class="group-count">{len(g["items"])}</span></div>')
        out.append('        <ul class="links-grid compact">')
        for it in g["items"]:
            auth = _auth_of(it)
            badge = (f'<span class="lk-badge {auth}" title="{_esc(AUTH_BADGES[auth])}">{_esc(AUTH_BADGES[auth].replace(" required", "").replace("Login needed for full access", "Login"))}</span>'
                     if auth in AUTH_BADGES else "")
            src = (f'<span class="lk-dot {it["src"]}" title="{SRC[it["src"]]}"><span class="vh">{SRC[it["src"]]}: </span></span>'
                   if it.get("src") in SRC else "")
            tip = _esc(it["title"] + ": " + it["desc"])
            if len(it["links"]) == 1:
                url = _esc(it["links"][0]["url"])
                title = f'<a class="lk-main" href="{url}" target="_blank" rel="noopener">{_esc(it["title"])}</a>'
                more = ""
            else:
                title = _esc(it["title"])
                more = "".join(
                    f'<a class="lk-alt" href="{_esc(l["url"])}" target="_blank" rel="noopener">{_esc(l["label"])}</a>'
                    for l in it["links"])
            # one footer line: extra links (if any) and the login tag
            foot = f'<div class="lk-foot">{more}{badge}</div>' if (more or badge) else ""
            out.append(f'          <li class="lk-card" title="{tip}"><h3 class="lk-title">{src}{title}</h3>'
                       f'<p class="lk-desc">{_esc(it["desc"])}</p>{foot}</li>')
        out.append('        </ul>')
        out.append('      </div>')
    out.append('      </div>')
    out.append('      </div>')
    if data.get("intro"):   # "Broken or missing link?": a footnote, not something to read first
        out.append(f'      <p class="links-intro links-end">{_esc(data["intro"])}</p>')
    return "\n".join(out)


def render_quick(data):
    out = []
    pins = sorted((it for g in data["groups"] for it in g["items"] if it.get("pin")), key=lambda it: it["pin"].get("order", 99))
    for it in pins:
            pin = it["pin"]
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
             ("links.html", "Important links", "links"), ("scam-alert.html", "Scam alert", "scam"),
             ("calculator.html", "Grade calculator", "calculator"), ("contributors.html", "Contributors", "contributors"),
             ("nptel.html", "NPTEL", "nptel"),
             ("updates.html", "Updates", "updates"))
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
                cards.append('<li class="lk-card pp-card"><h3 class="lk-title"><a class="lk-main" href="%s" target="_blank" rel="noopener">%s</a></h3>'
                             '<p class="lk-desc">%s</p></li>' % (esc(pr["url"], quote=True), esc(pr["name"]), _platform(pr["url"])))
            else:
                cards.append('<li class="lk-card pp-card plain"><h3 class="lk-title">%s</h3></li>' % esc(pr["name"]))
        jump.append('<a href="#c-%s">%s</a>' % (g["id"], esc(g["title"])))
        groups_html.append(
            '      <div class="link-group" id="c-%s">\n        <div class="group-head"><h2>%s</h2><span class="group-count">%d</span></div>\n'
            '        <p class="group-intro">%s</p>\n        <ul class="links-grid people-grid">\n          %s\n        </ul>\n      </div>'
            % (g["id"], esc(g["title"]), len(g["people"]), esc(g.get("intro", "")), "\n          ".join(cards)))
    c = d.get("contribute")
    if c:
        cc = []
        for cd in c["cards"]:
            acts = '<a class="cta-btn" href="%s" target="_blank" rel="noopener">%s</a>' % (esc(cd["url"], quote=True), esc(cd["label"]))
            if cd.get("url2"):
                mail = cd["url2"].startswith("mailto:")
                acts += '<a class="cta-btn ghost" href="%s"%s>%s%s</a>' % (esc(cd["url2"], quote=True), "" if mail else ' target="_blank" rel="noopener"', esc(cd["label2"]), "" if mail else "")
            cc.append('<li class="lk-card cta-card"><h3 class="lk-title">%s</h3><p class="lk-desc">%s</p><div class="cta-row">%s</div></li>'
                      % (esc(cd["title"]), esc(cd["text"]), acts))
        jump.append('<a href="#%s">%s</a>' % (c["id"], esc(c["title"])))
        groups_html.append('      <div class="link-group" id="%s">\n        <div class="group-head"><h2>%s</h2></div>\n        <p class="group-intro">%s</p>\n'
                           '        <ul class="links-grid cta-grid">\n          %s\n        </ul>\n      </div>'
                           % (c["id"], esc(c["title"]), esc(c["intro"]), "\n          ".join(cc)))
        ct = c.get("contact")
        if ct:
            links = " or ".join('<a href="%s"%s>%s</a>' % (esc(x["url"], quote=True), "" if x["url"].startswith("mailto:") else ' target="_blank" rel="noopener"', esc(x["label"])) for x in ct["links"])
            groups_html[-1] = groups_html[-1].replace("\n      </div>", '\n        <p class="contact-line">%s %s.</p>\n      </div>' % (esc(ct["text"]), links))
    m = d.get("missing")
    miss = ""
    if m:
        btns = "".join('<a class="cta-btn%s" href="%s"%s>%s%s</a>' % (
            "" if i == 0 else " ghost", esc(x["url"], quote=True),
            "" if x["url"].startswith("mailto:") else ' target="_blank" rel="noopener"',
            esc(x["label"]), "" if x["url"].startswith("mailto:") else "") for i, x in enumerate(m["actions"]))
        miss = ('\n      <div class="missing-note"><div><strong>%s</strong><p>%s</p></div><div class="cta-row">%s</div></div>'
                % (esc(m["title"]), esc(m["text"]), btns))
    page = CONTRIB_TEMPLATE.replace("{{TITLE}}", esc(d["title"])).replace("{{SUB}}", esc(d["sub"])) \
        .replace("{{JUMP}}", "".join(jump)).replace("{{GROUPS}}", "\n".join(groups_html) + miss) \
        .replace("{{FOOTNAV}}", _footer_nav("contributors"))
    open(CONTRIB_PAGE, "w", encoding="utf-8").write(stamp_assets(page))
    write_menu()
    return CONTRIB_PAGE


def generate_calculator():
    """calculator.html is generated whole from data/grading.json; assets/calculator.js does the sums."""
    d = json.load(open(CALC_PATH, encoding="utf-8"))
    tpl = open(CALC_TEMPLATE_PATH, encoding="utf-8").read()
    esc = html_lib.escape
    src = d["source"]
    hb = d["handbook"]
    note = ('<strong>Disclaimer.</strong> This is an unofficial tool made by students. The formulas were copied by hand from the '
            '<a href="%s">%s</a> and the letter grades from the <a href="%s">%s</a> (section %s), so they may contain mistakes or go out of date if either changes. '
            'Treat the result as an estimate, not your actual score or grade. The grading document, the handbook and the marks on your portal are always final.'
            % (esc(src["url"]), esc(src["label"]), esc(hb["url"]), esc(hb["label"]), esc(hb["section"])))
    data = json.dumps(d, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    page = tpl.replace("{{TITLE}}", "Grade calculator") \
        .replace("{{NOTE}}", note).replace("{{DATA}}", data).replace("{{FOOTNAV}}", _footer_nav("calculator"))
    open(CALC_PAGE, "w", encoding="utf-8").write(stamp_assets(page))
    return CALC_PAGE


def generate_scam_alert():
    """scam-alert.html is generated whole from data/scam_alert.json."""
    d = json.load(open(SCAM_PATH, encoding="utf-8"))
    tpl = open(SCAM_TEMPLATE_PATH, encoding="utf-8").read()
    esc = html_lib.escape
    parts, jump = [], []
    intro = "".join("<p>%s</p>" % esc(t) for t in d["intro"])
    co = d["callout"]
    parts.append('      <div class="scam-intro">%s</div>\n      <div class="scam-callout"><strong>%s.</strong> %s</div>'
                 % (intro, esc(co["title"]), esc(co["text"])))
    for sec in d["sections"]:
        head = ('      <div class="link-group" id="%s">\n        <div class="group-head"><h2>%s</h2>%s</div>\n        <p class="group-intro">%s</p>\n'
                % (sec["id"], esc(sec["title"]),
                   ('<span class="group-count">%d</span>' % len(sec["items"])) if sec["type"] == "providers" else "", esc(sec["intro"])))
        if sec["type"] == "cards":
            body = '        <ul class="links-grid scam-grid">\n          %s\n        </ul>' % "\n          ".join(
                '<li class="lk-card warn-card"><h3 class="lk-title">%s</h3><p class="lk-desc">%s</p></li>' % (esc(c["title"]), esc(c["text"]))
                for c in sec["cards"])
        elif sec["type"] == "providers":
            cards = []
            for it in sec["items"]:
                hosts = ("Names as hosts: %s" % esc(it["hosts"])) if it["hosts"] else "No host companies listed."
                chips = "".join("<span>%s</span>" % esc(x) for x in it["platforms"])
                cards.append('<li class="lk-card prov-card"><h3 class="lk-title">%s</h3><p class="lk-desc">%s</p><div class="plat-row">%s</div></li>'
                             % (esc(it["name"]), hosts, chips))
            body = '        <ul class="links-grid scam-grid">\n          %s\n        </ul>' % "\n          ".join(cards)
        else:
            body = '        <ol class="scam-steps">%s</ol>' % "".join("<li>%s</li>" % x for x in sec["steps"])
            if sec.get("actions"):
                body += '\n        <div class="cta-row">%s</div>' % "".join(
                    '<a class="cta-btn%s" href="%s"%s>%s%s</a>' % (
                        "" if i == 0 else " ghost", esc(x["url"], quote=True),
                        "" if x["url"].startswith("mailto:") else ' target="_blank" rel="noopener"',
                        esc(x["label"]), "" if x["url"].startswith("mailto:") else "")
                    for i, x in enumerate(sec["actions"]))
        jump.append('<a href="#%s">%s</a>' % (sec["id"], esc(sec["title"])))
        parts.append(head + body + "\n      </div>")
    page = tpl.replace("{{TITLE}}", esc(d["title"])).replace("{{SUB}}", esc(d["sub"])) \
        .replace("{{JUMP}}", "".join(jump)).replace("{{GROUPS}}", "\n".join(parts)).replace("{{FOOTNAV}}", _footer_nav("scam"))
    open(SCAM_PAGE, "w", encoding="utf-8").write(stamp_assets(page))
    return SCAM_PAGE


# ---------------------------------------------------------------- NPTEL page
NPTEL_PATH = os.path.join(SITE_ROOT, "data", "nptel.json")
NPTEL_PAGE = os.path.join(SITE_ROOT, "nptel.html")
NPTEL_TEMPLATE_PATH = os.path.join(TEMPLATES_DIR, "nptel.html.tpl")


def _np_group(c):
    """Which credit group an NPTEL course sits in (by the credits the sheet lists)."""
    cr = (c.get("credits") or "").strip()
    return {"3": 0, "2": 1, "1": 2}.get(cr, 3)


NP_GROUPS = ("3 credits \u00b7 12 weeks", "2 credits \u00b7 8 weeks", "1 credit \u00b7 4 weeks", "Credits not listed in the handbook sheet")


def generate_nptel():
    """nptel.html is generated whole from data/nptel.json (the handbook's NPTEL tables 2 and 3), one tab per table."""
    d = json.load(open(NPTEL_PATH, encoding="utf-8"))
    tpl = open(NPTEL_TEMPLATE_PATH, encoding="utf-8").read()
    esc = html_lib.escape

    def li(c):
        by = ", ".join(x for x in (c["by"], c["inst"]) if x)
        cr = c["credits"]
        cr_txt = ("%s cr" % esc(cr)) if cr else ""
        wk = c["weeks"]
        info = []
        if wk:
            info.append("%s weeks" % esc(wk))
        if c.get("added"):
            info.append("added %s" % esc(c["added"].replace("January", "Jan")))
        if c["swayam"]:
            info.append('<a class="np-join" href="%s" target="_blank" rel="noopener">Join on SWAYAM</a>' % esc(c["swayam"], quote=True))
        else:
            info.append('<span class="np-closed">not open this term</span>')
        sub = '<span class="np-by">%s</span>' % esc(by) if by else ""
        meta = '<span class="np-info">%s</span>' % " \u00b7 ".join(info)
        limit = '<span class="np-limit">%s</span>' % esc(c["limit"]) if c.get("limit") else ""
        hay = " ".join((c["name"], c["by"], c["inst"], c["id"], c.get("limit", "")))
        return ('<li data-open="%d" data-q="%s"><span class="code"><a href="https://nptel.ac.in/courses/%s" target="_blank" rel="noopener">%s</a></span>'
                '<span class="name"><a href="https://nptel.ac.in/courses/%s" target="_blank" rel="noopener">%s</a>%s%s%s</span>'
                '<span class="credits">%s</span></li>'
                % (1 if c["swayam"] else 0, esc(hay.casefold(), quote=True), esc(c["id"]), esc(c["id"]),
                   esc(c["id"]), esc(c["name"]), sub, meta, limit, cr_txt))

    tabs, panels = [], []
    for n, sec in enumerate(d["sections"]):
        tid = "table-%s" % sec["table"].split()[-1]
        tabs.append('<button type="button" role="tab" class="np-tab" id="tab-%s" data-panel="%s" aria-controls="%s" aria-selected="%s" tabindex="%s">'
                    '<span class="np-tab-t">%s</span><span class="np-tab-n" data-total="%d">%d</span><span class="np-tab-s">%s</span></button>'
                    % (tid, tid, tid, "true" if n == 0 else "false", "0" if n == 0 else "-1", esc(sec["table"]), len(sec["courses"]), len(sec["courses"]), esc(sec["tab"])))
        groups = [[] for _ in NP_GROUPS]
        for c in sorted(sec["courses"], key=lambda x: x["name"].casefold()):
            groups[_np_group(c)].append(c)
        gh = []
        for label, items in zip(NP_GROUPS, groups):
            if not items:
                continue
            h = (len(items) + 1) // 2
            cols = [items[:h], items[h:]] if len(items) > 2 else [items]
            ols = "".join('    <ol class="courses">\n      %s\n    </ol>\n' % "\n      ".join(li(c) for c in col) for col in cols if col)
            gh.append('    <div class="level-group">\n    <div class="level-subhead">%s</div>\n    <div class="courses-cols">\n%s    </div>\n    </div>' % (esc(label), ols))
        panels.append('  <section class="level np-panel" id="%s" role="tabpanel" aria-labelledby="tab-%s"%s>\n    <div class="level-head"><h2>%s</h2></div>\n    <p class="np-intro">%s</p>\n%s\n  </section>'
                      % (tid, tid, "" if n == 0 else " hidden", esc(sec["tab"]), esc(sec["intro"]), "\n\n".join(gh)))
    rules = '  <div class="np-rules"><h2>Before you enrol</h2><ul>%s</ul><p><a href="%s" target="_blank" rel="noopener">Student Handbook</a>, section 9.1 and Tables 2 and 3.</p></div>' % (
        "".join("<li>%s</li>" % esc(r) for r in d["rules"]), esc(d["handbook"], quote=True))
    page = tpl.replace("{{TITLE}}", esc(d["title"])).replace("{{SUB}}", esc(d["sub"])).replace("{{TABS}}", "".join(tabs)) \
        .replace("{{RULES}}", rules).replace("{{TERM}}", esc(d["term"])).replace("{{SECTIONS}}", "\n".join(panels)) \
        .replace("{{FOOTNAV}}", _footer_nav("nptel"))
    open(NPTEL_PAGE, "w", encoding="utf-8").write(stamp_assets(page))
    return NPTEL_PAGE


# ---------------------------------------------------------------- Updates page
UPDATES_PATH = os.path.join(SITE_ROOT, "data", "updates.json")
UPDATES_PAGE = os.path.join(SITE_ROOT, "updates.html")
UPDATES_TEMPLATE_PATH = os.path.join(TEMPLATES_DIR, "updates.html.tpl")
INDEX_PAGE = os.path.join(SITE_ROOT, "index.html")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")


def _long_date(iso):
    y, m, d = iso.split("-")
    return "%d %s %s" % (int(d), MONTHS[int(m) - 1], y)


def collect_updates():
    """Every dated update, newest first. A resource with an "added" date (YYYY-MM-DD) lists itself; the same
    label added to many courses on one day becomes one entry. data/updates.json holds notes on site changes."""
    notes = json.load(open(UPDATES_PATH, encoding="utf-8")) if os.path.exists(UPDATES_PATH) else {"notes": []}
    overrides = notes.get("resource_notes", {})
    groups = {}
    for stem in all_stems():
        data = load(stem)
        for r in data.get("resources") or []:
            if not r.get("added") or not r.get("url"):
                continue
            key = (r["added"], r["label"], r.get("by", ""))
            g = groups.setdefault(key, {"kind": "res", "date": r["added"], "title": r["label"], "urls": [], "descs": [],
                                        "by": r.get("by", ""), "courses": [], "links": None})
            g["urls"].append(r["url"]); g["descs"].append(r.get("desc", ""))
            if stem not in [c[0] for c in g["courses"]]:
                g["courses"].append((stem, data["code"], data["title"]))
    for g in groups.values():
        urls, descs = g.pop("urls"), g.pop("descs")
        if len(set(urls)) == 1:
            g["url"] = urls[0]
        else:   # one link per course (e.g. filtered to its subject): point at the shared page instead
            parts = [urllib.parse.urlsplit(u) for u in urls]
            same_path = len({(x.scheme, x.netloc, x.path) for x in parts}) == 1
            g["url"] = "%s://%s%s" % (parts[0].scheme, parts[0].netloc, parts[0].path if same_path else "/")
        ov = overrides.get(g["title"] + (" | " + g["by"] if g["by"] else "")) or overrides.get(g["title"])
        g["desc"] = ov if ov else (descs[0] if len(set(descs)) == 1 else "")
    links = json.load(open(LINKS_PATH, encoding="utf-8")) if os.path.exists(LINKS_PATH) else {"groups": []}
    out = list(groups.values())
    for grp in links.get("groups", []):
        for it in grp.get("items", []):
            if it.get("added"):
                url = it["links"][0]["url"]
                def _norm(u):
                    x = urllib.parse.urlsplit(u)
                    return x.netloc.replace("www.", "") + x.path.rstrip("/")
                host = _norm(url)
                twin = next((e for e in out if e["kind"] == "res" and e["date"] == it["added"] and not e["links"]
                             and _norm(e["url"]) == host), None)
                if twin:   # the same site, also added to course pages that day: one entry
                    twin["links"] = (grp["id"], grp["title"])
                else:
                    out.append({"kind": "res", "date": it["added"], "title": it["title"], "url": url,
                                "desc": it.get("desc", ""), "by": "", "courses": [], "links": (grp["id"], grp["title"])})
    titles = {st: (load(st)["code"], load(st)["title"]) for st in {c for n in notes.get("notes", []) for c in n.get("courses", [])}}
    for i, n in enumerate(notes.get("notes", [])):
        # a note is a site change, or (kind "res") a batch of resources written up by hand, optionally naming its courses
        out.append({"kind": n.get("kind", "site"), "date": n["date"], "title": n["title"], "desc": n.get("text", ""), "order": i,
                    "url": n.get("url", ""), "by": "", "courses": [(c,) + titles[c] for c in n.get("courses", [])],
                    "links": ("", "Important links") if n.get("links") else None})
    # newest day first; within a day, resources reaching the most courses first, then site notes in file order
    out.sort(key=lambda e: (e["date"], 1 if e["kind"] == "res" else 0, len(e.get("courses") or []), -e.get("order", 0)), reverse=True)
    return out


def _update_html(e):
    esc = html_lib.escape
    if e["kind"] == "site":
        return ('          <li class="up-item" data-kind="site"><span class="up-tag site">Site</span>'
                '<h3 class="up-title">%s</h3><p class="up-desc">%s</p></li>' % (esc(e["title"]), esc(e["desc"])))
    head = (('<span class="up-tag">New resource</span><h3 class="up-title"><a href="%s" target="_blank" rel="noopener">%s</a></h3>'
             % (esc(e["url"], quote=True), esc(e["title"]))) if e.get("url") else
            '<span class="up-tag">New resources</span><h3 class="up-title">%s</h3>' % esc(e["title"]))
    desc = ('<p class="up-desc">%s%s</p>' % (esc(e["desc"]), (' <span class="up-by">By %s.</span>' % esc(e["by"])) if e["by"] and e["by"] not in e["desc"] else "")) if (e["desc"] or e["by"]) else ""
    where = ""
    cs = sorted(e["courses"], key=lambda c: c[1])
    chips = "".join('<a href="courses/%s.html" title="%s">%s</a>' % (st, esc(html_lib.unescape(t), quote=True), esc(code)) for st, code, t in cs)
    if e["links"]:
        chips += '<a href="links.html%s">Important links</a>' % (("#links-" + esc(e["links"][0], quote=True)) if e["links"][0] else "")
    places = (("%d courses" % len(cs)) if len(cs) > 1 else "1 course" if cs else "")
    if e["links"]:
        places = (places + " and Important links") if places else "Important links"
    if chips and len(cs) > 8:
        where = '<details class="up-where"><summary>Added to %s</summary><span class="up-chips">%s</span></details>' % (places, chips)
    elif chips:
        where = '<p class="up-where">Added to <span class="up-chips">%s</span></p>' % chips
    return '          <li class="up-item" data-kind="res">%s%s%s</li>' % (head, desc, where)


def _short_update(e):
    if e["kind"] == "site":
        return e["title"]
    if e["courses"]:
        n = len(e["courses"])
        return "%s in %s" % (e["title"], ("%d courses" % n) if n > 1 else e["courses"][0][1])
    return "%s on Important links" % e["title"]


def generate_updates():
    esc = html_lib.escape
    d = json.load(open(UPDATES_PATH, encoding="utf-8")) if os.path.exists(UPDATES_PATH) else {"title": "Updates", "sub": ""}
    items = collect_updates()
    days, body = [], []
    for e in items:
        if not days or days[-1][0] != e["date"]:
            days.append((e["date"], []))
        days[-1][1].append(e)
    for date, es in days:
        body.append('  <section class="up-day" id="u-%s">\n    <h2 class="up-date">%s</h2>\n    <ul class="up-list">\n%s\n    </ul>\n  </section>'
                    % (date, _long_date(date), "\n".join(_update_html(e) for e in es)))
    if not body:
        body.append('  <p class="tbd-note">Nothing here yet.</p>')
    tpl = open(UPDATES_TEMPLATE_PATH, encoding="utf-8").read()
    page = tpl.replace("{{TITLE}}", esc(d.get("title", "Updates"))).replace("{{SUB}}", esc(d.get("sub", ""))) \
        .replace("{{BODY}}", "\n".join(body)).replace("{{FOOTNAV}}", _footer_nav("updates"))
    open(UPDATES_PAGE, "w", encoding="utf-8").write(stamp_assets(page))
    # the newest three, on the front page
    if os.path.exists(INDEX_PAGE):
        html = open(INDEX_PAGE, encoding="utf-8").read()
        a, b = html.find("<!-- updates:start -->"), html.find("<!-- updates:end -->")
        if a != -1 and b != -1:
            news = "".join('<li><a href="updates.html#u-%s"><span class="hn-d">%s</span><span class="hn-t">%s</span></a></li>'
                           % (e["date"], _short_date(e["date"]), esc(_short_update(e))) for e in items[:3])
            block = ('<!-- updates:start -->\n    <nav class="hm-card hm-news" aria-labelledby="hm-news-h"><h2 class="hm-h" id="hm-news-h">What\'s new</h2>'
                     '<ul>%s</ul><a class="hm-more" href="updates.html">All updates</a></nav>\n    ' % news)
            html = html[:a] + block + html[b:]
            open(INDEX_PAGE, "w", encoding="utf-8").write(html)
    return UPDATES_PAGE


def _short_date(iso):
    import datetime as dt
    d = dt.date.fromisoformat(iso)
    return "%d %s" % (d.day, d.strftime("%b"))


HOME_TEMPLATE_PATH = os.path.join(TEMPLATES_DIR, "home.html.tpl")
DATES_PATH = os.path.join(os.path.dirname(DATA_DIR), "dates.json")


def _date_label(a, b):
    import datetime as dt
    d1 = dt.date.fromisoformat(a)
    d2 = dt.date.fromisoformat(b) if b else d1
    mon = lambda d: d.strftime("%b")
    if d2 == d1:
        return "%d %s" % (d1.day, mon(d1))
    if (d1.year, d1.month) == (d2.year, d2.month):
        return "%d to %d %s" % (d1.day, d2.day, mon(d1))
    return "%d %s to %d %s" % (d1.day, mon(d1), d2.day, mon(d2))


def _home_share():
    """Slim 'Share a resource' band for the home page, from the first card in data/contributors.json."""
    esc = html_lib.escape
    cd = json.load(open(CONTRIB_PATH, encoding="utf-8"))["contribute"]["cards"][0]
    acts = '<a class="cta-btn" href="%s" target="_blank" rel="noopener">%s</a>' % (esc(cd["url"], quote=True), esc(cd["label"]))
    if cd.get("url2"):
        mail = cd["url2"].startswith("mailto:")
        acts += '<a class="cta-btn ghost" href="%s"%s>%s%s</a>' % (esc(cd["url2"], quote=True), "" if mail else ' target="_blank" rel="noopener"', esc(cd["label2"]), "" if mail else "")
    return ('  <section class="hm-share" aria-labelledby="hm-share-h">\n    <div class="hs-text"><h2 class="hm-h" id="hm-share-h">%s</h2><p>%s</p></div>\n'
            '    <div class="cta-row">%s</div>\n  </section>' % (esc(cd["title"]), esc(cd["text"]), acts))


def generate_home():
    """index.html: search, upcoming dates, what's new and the course list by level.
    The course list is read from courses.html, the dates from data/dates.json."""
    esc = html_lib.escape
    catalog = open(os.path.join(SITE_ROOT, "courses.html"), encoding="utf-8").read()
    li_re = re.compile(r'<li( class="project")?><span class="code">([^<]+)</span><span class="name"><a href="([^"]+)">(.*?)</a></span>', re.S)
    cards, home, groups = [], {}, {}
    for m in re.finditer(r'<section id="([^"]+)" class="level">\s*<div class="level-head">\s*(?:<span class="roman">(.*?)</span>\s*)?<h2>(.*?)</h2>(.*?)</section>', catalog, re.S):
        sid, roman, title, body = m.groups()
        roman = roman or ""
        chips = []
        rows = li_re.findall(body)
        groups[sid] = {re.search(r"courses/(.*?)\.html", r[2]).group(1) for r in rows}
        for proj, code, href, name in rows:
            chips.append('        <li><a class="chip%s" href="%s">%s<span class="vh"> %s</span></a></li>'
                         % (" project" if proj else "", href, code, name))
            stem = re.search(r"courses/(.*?)\.html", href).group(1)
            if code not in home:
                n, item = 0, "lecture"
                if os.path.exists(data_path(stem)):
                    d = json.load(open(data_path(stem), encoding="utf-8"))
                    n = sum(1 for w in (d.get("weeks_data") or []) for it in w["items"] if it.get("v") or it.get("dv"))
                    item = "session" if d.get("kind") == "project" else "lecture"
                home[code] = {"t": html_lib.unescape(name), "u": href, "n": n, "i": item}
        cards.append('      <section class="hl-card" id="lv-%s" aria-labelledby="lv-%s-h">\n'
                     '        <div class="hl-head"><h3 id="lv-%s-h">%s</h3><span class="hl-n">%d</span></div>\n'
                     '        <ul class="chips">\n%s\n        </ul>\n      </section>'
                     % (sid, sid, sid, title, len(rows), "\n".join(chips)))
    tiles = []
    for label, kicker, desc, ids in (
            ("Foundation", "Part I", "Maths, statistics, computational thinking, Python and English", ("foundation",)),
            ("Diploma", "Part II", "Programming, databases, machine learning and business data, with the projects", ("diploma-p", "diploma-ds")),
            ("Degree", "Part III", "The core courses and electives across data, AI and business", ("bsc", "bs")),
            ("Postgraduate", "Parts IV and V", "The PG Diploma in AI and ML, and the MTech project", ("pgd", "mtech"))):
        stems = set().union(*(groups.get(i, set()) for i in ids))
        tiles.append('      <a class="hm-tile" href="courses.html#%s"><span class="ht-t">%s</span>'
                     '<span class="ht-d">%s</span><span class="ht-n">%d courses</span></a>'
                     % (ids[0], label, esc(desc), len(stems)))
    links = json.load(open(LINKS_PATH, encoding="utf-8"))
    quick = sorted((it for grp in links["groups"] for it in grp["items"] if it.get("home")), key=lambda it: it["home"].get("order", 99))
    quick_html = "\n".join('        <a class="quick-card" href="%s" target="_blank" rel="noopener"><span class="qc-title">%s</span><span class="qc-tag">%s</span></a>'
                           % (esc(it["links"][0]["url"]), esc(it["home"]["title"]), esc(it["home"]["tag"])) for it in quick)
    dates = json.load(open(DATES_PATH, encoding="utf-8"))
    drows = []
    for e in sorted(dates["items"], key=lambda e: (e["date"], e.get("end", ""))):
        drows.append('        <li data-start="%s" data-end="%s"><time class="hm-d" datetime="%s">%s</time><span class="hm-t">%s</span><span class="hm-when"></span></li>'
                     % (e["date"], e.get("end", ""), e["date"], _date_label(e["date"], e.get("end")), esc(e["title"])))
    topbar = re.search(r'<nav class="topbar".*?</nav>', open(UPDATES_TEMPLATE_PATH, encoding="utf-8").read(), re.S).group(0)
    topbar = topbar.replace('class="tb-link current"', 'class="tb-link"')
    tpl = open(HOME_TEMPLATE_PATH, encoding="utf-8").read()
    page = (tpl.replace("{{TOPBAR}}", topbar).replace("{{COURSE_COUNT}}", str(len(home)))
            .replace("{{TERM}}", esc(dates["term"])).replace("{{DATES}}", "\n".join(drows))
            .replace("{{DATES_SRC}}", esc(dates["source"])).replace("{{LEVELS}}", "\n".join(cards)).replace("{{TILES}}", "\n".join(tiles)).replace("{{QUICK}}", quick_html)
            .replace("{{SHARE}}", _home_share())
            .replace("{{FOOTNAV}}", _footer_nav("home"))
            .replace("{{HOME_DATA}}", json.dumps(home, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")))
    open(INDEX_PAGE, "w", encoding="utf-8").write(stamp_assets(page))
    generate_updates()   # fills the "What's new" card between the markers and rewrites updates.html
    return INDEX_PAGE


SITE_URL = "https://iitmbsc-student-projects.github.io/the-companion/"
NOTFOUND_PAGE = os.path.join(SITE_ROOT, "404.html")
NOTFOUND_TEMPLATE_PATH = os.path.join(TEMPLATES_DIR, "404.html.tpl")
SITEMAP_PATH = os.path.join(SITE_ROOT, "sitemap.xml")


def generate_404():
    """404.html: GitHub Pages serves it for any missing path, so its links resolve through a <base> tag."""
    page = open(NOTFOUND_TEMPLATE_PATH, encoding="utf-8").read().replace("{{FOOTNAV}}", _footer_nav(""))
    open(NOTFOUND_PAGE, "w", encoding="utf-8").write(stamp_assets(page))
    return NOTFOUND_PAGE


def generate_sitemap():
    """sitemap.xml: every public page, for search engines (submit it once in Google Search Console)."""
    pages = ["", "courses.html", "links.html", "updates.html", "contributors.html", "scam-alert.html", "calculator.html", "nptel.html"]
    pages += ["courses/%s.html" % s for s in all_stems()]
    urls = "".join("  <url><loc>%s%s</loc></url>\n" % (SITE_URL, p) for p in pages)
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls
    open(SITEMAP_PATH, "w", encoding="utf-8").write(xml)
    return SITEMAP_PATH


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        for stem in sys.argv[1:]:
            print(generate_links() if stem == "links" else generate_contributors() if stem == "contributors" else generate_scam_alert() if stem == "scam" else generate_nptel() if stem == "nptel" else generate_calculator() if stem == "calculator" else generate_updates() if stem == "updates" else generate_home() if stem == "home" else generate_404() if stem == "404" else generate_sitemap() if stem == "sitemap" else generate_course(stem))
    else:
        # the shared pages first: they rewrite assets/menu-data.js, whose ?v= stamp the course pages then pick up
        generate_links()
        generate_contributors()
        generate_scam_alert()
        generate_nptel()
        generate_calculator()
        generate_home()   # also rewrites updates.html
        generate_404()
        generate_sitemap()
        paths = generate_all()
        print(f"generated {len(paths)} pages into {COURSES_DIR}")
