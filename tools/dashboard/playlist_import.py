"""Turns a pasted ordered list of lectures, or a YouTube playlist URL, into a
course's WEEKS_DATA. Two ways in:

  - paste an ordered list of lines, one lecture per line:
        <youtube url or bare id> | <title>
    (title is optional; missing titles become "Lecture N")
  - paste a YouTube playlist URL: pulled in original playlist order via
    yt-dlp, no API key needed.

Either way you end up with a flat ordered list of (video_id, title) pairs,
which then gets spread across the course's existing week structure (same
week count it already has, or 12 fresh weeks if it had none) via
distribute_into_weeks — evenly, in order, first week first.

WEEKS_DATA itself is also editable directly as plain text in the dashboard,
using the same little format weeks_data_to_text/text_to_weeks_data read and
write:

    Week 1
    1.1 | Course Overview | OMHbGm9SQuE | https://drive.google.com/...
    1.2 | Why DBMS? | |
    Week 2
    2.1 | Introduction | dQw4w9WgXcQ |

A line with no "|" starts a new week (its text is the week's label). A line
with "|" is one lecture: number | title | video (id or full URL, blank ok) |
slide URL (blank ok).
"""
import re


YOUTUBE_ID_RE = re.compile(r'^[\w-]{11}$')


def extract_youtube_id(s):
    """Accepts a bare 11-char id, or a youtube.com/watch?v=, youtu.be/, or
    /embed/ URL, and returns just the id. Returns None if nothing recognized."""
    s = (s or "").strip()
    if not s:
        return None
    if YOUTUBE_ID_RE.match(s):
        return s
    m = re.search(r'[?&]v=([\w-]{11})', s)
    if m:
        return m.group(1)
    m = re.search(r'youtu\.be/([\w-]{11})', s)
    if m:
        return m.group(1)
    m = re.search(r'/embed/([\w-]{11})', s)
    if m:
        return m.group(1)
    return None


def weeks_data_to_text(weeks_data):
    lines = []
    for week in weeks_data:
        lines.append(week["w"])
        for item in week.get("items", []):
            lines.append(f'{item.get("n","")} | {item.get("t","")} | '
                          f'{item.get("v") or ""} | {item.get("s") or ""}')
    return "\n".join(lines)


def text_to_weeks_data(text):
    weeks = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if "|" not in line:
            weeks.append({"w": line, "items": []})
            continue
        if not weeks:
            # an item line before any week header - open an implicit Week 1
            weeks.append({"w": "Week 1", "items": []})
        parts = [p.strip() for p in line.split("|")]
        while len(parts) < 4:
            parts.append("")
        n, t, v_raw, s_raw = parts[0], parts[1], parts[2], parts[3]
        v = extract_youtube_id(v_raw) or (v_raw or None)
        s = s_raw or None
        weeks[-1]["items"].append({"n": n, "t": t or "No lecture linked yet",
                                    "v": v, "s": s})
    return weeks


def parse_pasted_list(text):
    """One lecture per line: '<url-or-id> | <title>' (title optional).
    Returns [(video_id, title), ...], skipping lines with no recognizable id."""
    out = []
    for i, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        if "|" in line:
            first, rest = line.split("|", 1)
            vid = extract_youtube_id(first)
            title = rest.strip() or f"Lecture {i}"
        else:
            vid = extract_youtube_id(line)
            title = f"Lecture {i}"
        if vid:
            out.append((vid, title))
    return out


def fetch_youtube_playlist(url):
    """Ordered [(video_id, title), ...] from a YouTube playlist URL via yt-dlp
    (no API key, no download - just the playlist index)."""
    import yt_dlp
    opts = {"extract_flat": "in_playlist", "quiet": True, "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    entries = info.get("entries") or []
    out = []
    for e in entries:
        vid = e.get("id")
        title = e.get("title") or "Untitled"
        if vid:
            out.append((vid, title))
    return out


def distribute_into_weeks(items, weeks_data, default_week_count=12):
    """Spread a flat ordered (video_id, title) list evenly across the course's
    existing week structure (same number of weeks it already has), first week
    first. If the course has no weeks at all yet, creates default_week_count
    fresh ones."""
    n_weeks = len(weeks_data) if weeks_data else default_week_count
    labels = [w["w"] for w in weeks_data] if weeks_data else [f"Week {i+1}" for i in range(n_weeks)]
    if not items:
        return [{"w": label, "items": []} for label in labels]

    n_weeks = max(n_weeks, 1)
    per_week = [len(items) // n_weeks + (1 if i < len(items) % n_weeks else 0)
                for i in range(n_weeks)]
    out = []
    cursor = 0
    for wi, count in enumerate(per_week):
        week_items = []
        for ii in range(count):
            vid, title = items[cursor]
            cursor += 1
            week_items.append({"n": f"{wi+1}.{ii+1}", "t": title, "v": vid, "s": None})
        out.append({"w": labels[wi] if wi < len(labels) else f"Week {wi+1}", "items": week_items})
    return out
