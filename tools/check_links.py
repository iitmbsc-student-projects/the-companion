"""Weekly link health check for The Companion.

Walks every course's resources and lecture video ids, probes them, and
writes (or updates) a single GitHub issue titled "Link health" when
GITHUB_TOKEN + GITHUB_REPO are set. Without those env vars it just prints
a report to stdout — useful for a local dry run.

  python tools/check_links.py
  python tools/check_links.py --timeout 12

Rules of thumb matching the site's own badges:
  - resources marked auth=iitm / auth=site, or Drive / Discourse URLs, are
    only checked for "does the host answer", never for a 200 body;
  - YouTube videos are checked via the public oEmbed endpoint (no key);
  - anything else is a HEAD (falling back to GET) with a short timeout.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.parse import urlparse

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS_DIR)
import generate  # noqa: E402
from dashboard.playlist_import import extract_youtube_id  # noqa: E402

ISSUE_TITLE = "Link health"
USER_AGENT = "the-companion-link-check/1.0 (+https://github.com/iitmbsc-student-projects/the-companion)"
LOGIN_HOSTS = (
    "drive.google.com",
    "docs.google.com",
    "discourse.onlinedegree.iitm.ac.in",
    "study.iitm.ac.in",
)


def _is_loginish(resource: dict) -> bool:
    auth = (resource.get("auth") or "").lower()
    if auth in ("iitm", "site"):
        return True
    host = (urlparse(resource.get("url") or "").hostname or "").lower().removeprefix("www.")
    return any(host == h or host.endswith("." + h) for h in LOGIN_HOSTS)


def _request(url: str, method: str, timeout: float):
    req = urllib.request.Request(
        url,
        method=method,
        headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, str(e.reason)
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def check_url(url: str, timeout: float, soft: bool):
    """Return (ok, detail). soft=True means a reachable host (even 401/403)
    is fine — used for login-gated pages."""
    if not url or not url.startswith(("http://", "https://")):
        return False, "not an http(s) url"
    status, err = _request(url, "HEAD", timeout)
    if status is None or status in (405, 501):
        status, err = _request(url, "GET", timeout)
    if status is None:
        return False, err or "unreachable"
    if soft:
        return status < 500, f"HTTP {status}"
    if status >= 400:
        return False, f"HTTP {status}"
    return True, f"HTTP {status}"


def check_youtube(video_id: str, timeout: float):
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    status, err = _request(url, "GET", timeout)
    if status == 200:
        return True, "oEmbed ok"
    if status == 404:
        return False, "video missing (oEmbed 404)"
    if status is None:
        return False, err or "oEmbed unreachable"
    return False, f"oEmbed HTTP {status}"


def gather_targets():
    resources, videos = [], []
    for stem in generate.all_stems():
        data = generate.load(stem)
        code = data.get("code") or stem.upper()
        for r in data.get("resources") or []:
            if not isinstance(r, dict) or not r.get("url"):
                continue
            resources.append({
                "course": code, "stem": stem,
                "label": r.get("label") or r["url"],
                "url": r["url"], "soft": _is_loginish(r),
            })
        for week in data.get("weeks_data") or []:
            for item in week.get("items") or []:
                vid = extract_youtube_id(item.get("v") or "")
                if vid:
                    videos.append({
                        "course": code, "stem": stem,
                        "label": f"{week.get('w')} · {item.get('n')} {item.get('t') or ''}".strip(),
                        "video_id": vid,
                    })
    return resources, videos


def run_checks(timeout: float, workers: int):
    resources, videos = gather_targets()
    failures = []

    def check_resource(r):
        ok, detail = check_url(r["url"], timeout, soft=r["soft"])
        return r, ok, detail

    def check_video(v):
        ok, detail = check_youtube(v["video_id"], timeout)
        return v, ok, detail

    print(f"checking {len(resources)} resources and {len(videos)} videos…")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(check_resource, r) for r in resources]
        futs += [pool.submit(check_video, v) for v in videos]
        done = 0
        for fut in as_completed(futs):
            target, ok, detail = fut.result()
            done += 1
            if done % 25 == 0 or done == len(futs):
                print(f"  {done}/{len(futs)}")
            if not ok:
                failures.append((target, detail))
    return failures, len(resources), len(videos)


def format_report(failures, n_res, n_vid):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"Automated link check · {now}",
        f"Checked {n_res} resources and {n_vid} YouTube videos.",
        "",
    ]
    if not failures:
        lines.append("All clear — nothing looked broken.")
        return "\n".join(lines)

    lines.append(f"**{len(failures)} problem(s):**")
    lines.append("")
    by_course = {}
    for target, detail in failures:
        by_course.setdefault(target["course"], []).append((target, detail))
    for course in sorted(by_course):
        lines.append(f"### {course}")
        for target, detail in by_course[course]:
            if "url" in target:
                lines.append(f"- resource [{target['label']}]({target['url']}) — {detail}")
            else:
                lines.append(
                    f"- video `{target['video_id']}` ({target['label']}) — {detail}"
                )
        lines.append("")
    lines.append("_Login-gated Drive / Discourse / IITM links are only checked for reachability._")
    return "\n".join(lines)


def upsert_issue(body: str):
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    repo = os.environ.get("GITHUB_REPO")
    if not token or not repo:
        print("GITHUB_TOKEN / GITHUB_REPO not set — skipping issue update.")
        return None

    api = "https://api.github.com"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
    }

    def call(method, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(api + path, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)

    # find an open issue with the exact title, otherwise create one
    q = urllib.request.quote(f'repo:{repo} is:issue is:open in:title "{ISSUE_TITLE}"')
    search = call("GET", f"/search/issues?q={q}&per_page=5")
    existing = None
    for item in search.get("items") or []:
        if item.get("title") == ISSUE_TITLE:
            existing = item
            break

    if existing:
        number = existing["number"]
        call("PATCH", f"/repos/{repo}/issues/{number}", {"body": body, "state": "open"})
        print(f"updated issue #{number}")
        return existing.get("html_url")
    created = call("POST", f"/repos/{repo}/issues", {
        "title": ISSUE_TITLE,
        "body": body,
        "labels": ["link-health"],
    })
    print(f"opened issue #{created.get('number')}")
    return created.get("html_url")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--timeout", type=float, default=10.0)
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--no-issue", action="store_true", help="never write a GitHub issue")
    args = p.parse_args(argv)

    failures, n_res, n_vid = run_checks(args.timeout, args.workers)
    body = format_report(failures, n_res, n_vid)
    print()
    print(body)
    if not args.no_issue:
        upsert_issue(body)
    # non-zero exit when something is broken so CI can surface it
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
