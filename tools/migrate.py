# One-off script that produced the original data/courses/*.json files from the
# hand-built HTML pages that predated this data-driven system (the two page
# templates in tools/templates/ were extracted from cs2001.html and cs2003p.html
# at that same moment). Not part of the normal add/edit workflow — use the
# dashboard, or hand-edit a JSON file, and run generate.py. Kept for reference
# and in case a future bulk re-scrape from the HTML is ever needed again; the
# SITE/OUT paths below were this session's scratch paths and won't exist as-is.
import re, json, os, glob

SITE = "/tmp/site"
OUT = "/tmp/companion_tools/data/courses"
os.makedirs(OUT, exist_ok=True)

def get(pat, text, flags=re.S, default=None, group=1):
    m = re.search(pat, text, flags)
    return m.group(group).strip() if m else default

def parse_li_links(ul_html):
    """Parse <li>...</li> entries inside a <ul>. Each becomes {url,label} if it's a
    clean single-anchor line, else {raw: innerHTML} to avoid losing anything unusual."""
    if ul_html is None:
        return []
    out = []
    for li in re.findall(r'<li>(.*?)</li>', ul_html, re.S):
        li = li.strip()
        m = re.match(r'^<a href="([^"]+)"[^>]*>([^<]*)</a>$', li)
        if m:
            out.append({"url": m.group(1), "label": m.group(2).strip()})
        else:
            out.append({"raw": li})
    return out

def parse_cell_link(cell_html):
    """A table cell is either a single '<a href="URL">Label</a>' or plain text.
    Returns (url_or_None, label_text)."""
    cell_html = cell_html.strip()
    m = re.match(r'^<a href="([^"]+)"[^>]*>([^<]*)</a>$', cell_html)
    if m:
        return m.group(1), m.group(2).strip()
    # strip any other stray tags, keep the text
    return None, re.sub(r'<[^>]+>', '', cell_html).strip()

def parse_pyq(tbody_html):
    rows = re.findall(r'<tr>(.*?)</tr>', tbody_html, re.S)
    out = []
    for row in rows:
        tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)
        if len(tds) <= 1:
            continue  # the "No papers uploaded yet." empty-state row
        while len(tds) < 4:
            tds.append("")
        paper_url, paper_label = parse_cell_link(tds[1])
        sol_url, sol_label = parse_cell_link(tds[2])
        out.append({"term": tds[0].strip(),
                     "paper_url": paper_url, "paper_label": paper_label or "Paper",
                     "solutions_url": sol_url, "solutions_label": sol_label or "Solutions",
                     "notes": re.sub(r'<[^>]+>', '', tds[3]).strip()})
    return out

def parse_sessions(tbody_html):
    rows = re.findall(r'<tr>(.*?)</tr>', tbody_html, re.S)
    out = []
    for row in rows:
        tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)
        if len(tds) <= 1:
            continue
        url, label = parse_cell_link(tds[1])
        out.append({"term": tds[0].strip(), "url": url, "label": label})
    return out

def _sanitize_json(s):
    """A handful of pages have stray backslashes in a lecture title (e.g. a pasted regex
    like '^\\d+\\.\\d+\\s+') that are invalid JSON escapes. Escape any backslash that
    isn't already starting a valid JSON escape sequence, so json.loads doesn't choke."""
    return re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', s)

def kicker_parts(brand_sub):
    # "Diploma / Programming · 4 credits"  ->  ("Diploma / Programming", 4)
    parts = [p.strip() for p in brand_sub.split('·')]
    program = parts[0] if parts else ""
    credits = 0
    if len(parts) > 1:
        m = re.search(r'(\d+)', parts[1])
        if m: credits = int(m.group(1))
    return program, credits


def parse_lecture_page(html, stem):
    code = get(r'<div class="brand-code">([^<]+)</div>', html)
    brand_sub = get(r'<div class="brand-sub">([^<]+)</div>', html, default="")
    program, credits = kicker_parts(brand_sub)
    title = get(r'<div class="course-head">.*?<h1>(.*?)</h1>', html)
    standfirst = get(r'<p class="standfirst">(.*?)</p>', html)
    instructor = get(r'<span><b>Instructor</b>\s*(.*?)</span>', html, default="")
    term = get(r'<span><b>Term</b>\s*(.*?)</span>', html, default="")
    prereq = get(r'<span><b>Prereq</b>\s*(.*?)</span>', html, default="")

    # Resources section
    res_block = get(r'<section class="chapter" id="resources">(.*?)</section>', html, default="")
    res_ul = get(r'<ul class="link-list">(.*?)</ul>', res_block, default=None)
    resources = parse_li_links(res_ul)
    # Only a real ul of resources can carry an accompanying note; when there's no ul at
    # all, the sole <p class="tbd-note"> in the block IS the "no resources yet" fallback
    # text itself, not an extra note to preserve on top of the template's own fallback.
    resources_note = get(r'<p class="tbd-note"[^>]*>(.*?)</p>', res_block, default="") if res_ul is not None else ""

    # PYQ (dashboard panel's own copy, tabbed template only has it once)
    pyq_block = get(r'<section class="chapter" id="pyq">(.*?)</section>', html, default="")
    pyq_tbody = get(r'<tbody>(.*?)</tbody>', pyq_block, default="")
    pyq = parse_pyq(pyq_tbody)

    # Syllabus panel
    desc_block = get(r'<section class="chapter" id="syllabus-description">.*?<div class="syllabus-body">(.*?)</div>\s*</section>', html, default="")
    description_paragraphs = [p.strip() for p in re.findall(r'<p>(.*?)</p>', desc_block, re.S) if p.strip()]

    fac_block = get(r'<section class="chapter" id="syllabus-faculty">(.*?)</section>', html, default="")
    fac_ul = get(r'<ul class="link-list">(.*?)</ul>', fac_block, default=None)
    faculty = [li.strip() for li in re.findall(r'<li>(.*?)</li>', fac_ul, re.S)] if fac_ul else []
    faculty_note = get(r'<p class="tbd-note"[^>]*>(.*?)</p>', fac_block, default="")

    weeks_block = get(r'<section class="chapter" id="syllabus-weeks">.*?<div class="syllabus-body">(.*?)</div>\s*</section>', html, default="")
    weeks_text = []
    for wp in re.findall(r'<p><b>(Week \d+):</b>\s*(.*?)</p>', weeks_block, re.S):
        weeks_text.append({"label": wp[0].strip(), "text": wp[1].strip()})
    weeks_note = ""
    if not weeks_text:
        weeks_note = get(r'<p class="tbd-note"[^>]*>(.*?)</p>', weeks_block, default="")

    # WEEKS_DATA JS array (lecture playlist)
    wd_raw = get(r'const WEEKS_DATA = (\[.*?\]);', html, default="[]")
    weeks_data = json.loads(_sanitize_json(wd_raw))

    return {
        "stem": stem, "code": code, "kind": "lecture",
        "title": title, "program": program, "credits": credits,
        "standfirst": standfirst, "instructor": instructor, "term": term, "prereq": prereq,
        "resources": resources, "resources_note": resources_note,
        "pyq": pyq,
        "syllabus": {
            "description_paragraphs": description_paragraphs,
            "faculty": faculty, "faculty_note": faculty_note,
            "weeks_text": weeks_text, "weeks_note": weeks_note,
        },
        "weeks_data": weeks_data,
    }


def parse_project_page(html, stem):
    kicker = get(r'<div class="kicker">([^<]+)</div>', html, default="")
    kparts = [p.strip() for p in kicker.split('·')]
    code = kparts[0] if kparts else stem.upper()
    program = kparts[1] if len(kparts) > 1 else ""
    credits = 0
    if len(kparts) > 2:
        m = re.search(r'(\d+)', kparts[2])
        if m: credits = int(m.group(1))
    title = get(r'<h1>(.*?)</h1>', html)
    standfirst = get(r'<p class="standfirst">(.*?)</p>', html)
    instructor = get(r'<span><b>Instructor</b>\s*(.*?)</span>', html, default="")
    term = get(r'<span><b>Term</b>\s*(.*?)</span>', html, default="")
    prereq = get(r'<span><b>Prereq</b>\s*(.*?)</span>', html, default="")

    syl_block = get(r'<section class="chapter" id="syllabus">.*?<div class="syllabus-body">(.*?)</div>\s*</section>', html, default="")

    mile_block = get(r'<section class="chapter" id="milestones">(.*?)</section>', html, default="")
    milestones_html = get(r'<div class="syllabus-body">(.*?)</div>', mile_block, default=None)
    if milestones_html is None:
        milestones_html = get(r'<h2>.*?</h2>\s*(.*)', mile_block, default="").strip()

    pyq_block = get(r'<section class="chapter" id="pyq">(.*?)</section>', html, default="")
    pyq_tbody = get(r'<tbody>(.*?)</tbody>', pyq_block, default="")
    pyq = parse_pyq(pyq_tbody)

    sessions = []
    sess_block = get(r'<section class="chapter" id="sessions">(.*?)</section>', html, default=None)
    if sess_block:
        sess_tbody = get(r'<tbody>(.*?)</tbody>', sess_block, default="")
        sessions = parse_sessions(sess_tbody)

    return {
        "stem": stem, "code": code, "kind": "project",
        "title": title, "program": program, "credits": credits,
        "standfirst": standfirst, "instructor": instructor, "term": term, "prereq": prereq,
        "syllabus_body_html": syl_block.strip(),
        "milestones_html": milestones_html.strip() if milestones_html else "",
        "pyq": pyq,
        "sessions": sessions,
    }


def main():
    files = sorted(glob.glob(os.path.join(SITE, "courses", "*.html")))
    lecture_stems_old_bespoke = {"ee5001"}  # old <details>-week bespoke template, not app-shell
    project_stems = {"cs2003p", "cs2006p", "cs2008p", "da2001p", "ms2001p", "da6006", "da6901"}
    report = []
    for f in files:
        stem = os.path.splitext(os.path.basename(f))[0]
        html = open(f, encoding="utf-8").read()
        try:
            if stem in project_stems:
                data = parse_project_page(html, stem)
            elif "app-shell" in html:
                data = parse_lecture_page(html, stem)
            elif stem in lecture_stems_old_bespoke:
                # bespoke old template (ee5001): pull what we can, rest scaffolded fresh
                data = parse_bespoke_lecture(html, stem)
            else:
                report.append((stem, "UNRECOGNIZED TEMPLATE"))
                continue
            json.dump(data, open(os.path.join(OUT, stem + ".json"), "w", encoding="utf-8"),
                       indent=1, ensure_ascii=False)
        except Exception as e:
            report.append((stem, f"ERROR: {e}"))
    for stem, msg in report:
        print(stem, "->", msg)
    print("done,", len(files) - len(report), "of", len(files), "migrated cleanly")


def parse_bespoke_lecture(html, stem):
    kicker = get(r'<div class="kicker">([^<]+)</div>', html, default="")
    kparts = [p.strip() for p in kicker.split('·')]
    code = kparts[0] if kparts else stem.upper()
    program = kparts[1] if len(kparts) > 1 else ""
    credits = 0
    if len(kparts) > 2:
        m = re.search(r'(\d+)', kparts[2])
        if m: credits = int(m.group(1))
    title = get(r'<h1>(.*?)</h1>', html)
    standfirst = get(r'<p class="standfirst">(.*?)</p>', html)
    instructor = get(r'<span><b>Instructor</b>\s*(.*?)</span>', html, default="")
    term = get(r'<span><b>Term</b>\s*(.*?)</span>', html, default="")
    prereq = get(r'<span><b>Prereq</b>\s*(.*?)</span>', html, default="")

    syl_block = get(r'<section class="chapter" id="syllabus">(.*?)</section>', html, default="")
    official_link = get(r'<a href="([^"]+)"[^>]*>Official syllabus', syl_block, default="")

    # the full-course YouTube playlist embed -> preserved as a Resources entry
    playlist_list_id = get(r'youtube\.com/embed/videoseries\?list=([\w-]+)', html, default=None)
    resources = []
    if playlist_list_id:
        resources.append({"url": f"https://www.youtube.com/playlist?list={playlist_list_id}",
                           "label": "Full lecture playlist (YouTube)"})

    description_paragraphs = ["Syllabus not yet transcribed. Contributions welcome."]
    if official_link:
        description_paragraphs.append(
            f'<a href="{official_link}" target="_blank" rel="noopener">Official syllabus on the IITM study portal →</a>')

    pyq_block = get(r'<section class="chapter" id="pyq">(.*?)</section>', html, default="")
    pyq_tbody = get(r'<tbody>(.*?)</tbody>', pyq_block, default="")
    pyq = parse_pyq(pyq_tbody)

    n_weeks = len(re.findall(r'Week \d+', get(r'const WEEKS = Array.from\(\{length:(\d+)', html, default="12") and "")) or None
    m = re.search(r'const WEEKS = Array\.from\(\{length:(\d+)', html)
    n_weeks = int(m.group(1)) if m else 12
    weeks_data = [{"w": f"Week {i+1}", "items": [{"n": f"{i+1}.1", "t": "No lecture linked yet", "v": None, "s": None}]}
                  for i in range(n_weeks)]

    return {
        "stem": stem, "code": code, "kind": "lecture",
        "title": title, "program": program, "credits": credits,
        "standfirst": standfirst, "instructor": instructor, "term": term, "prereq": prereq,
        "resources": resources, "resources_note": "",
        "pyq": pyq,
        "syllabus": {
            "description_paragraphs": description_paragraphs,
            "faculty": [], "faculty_note": "",
            "weeks_text": [], "weeks_note": "",
        },
        "weeks_data": weeks_data,
    }

if __name__ == "__main__":
    main()
