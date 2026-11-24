"""Fill optional `d` (duration in seconds) on every lecture that has a YouTube
video id. Uses yt-dlp — the same tool the playlist importer already depends
on — so no API key is needed.

  python tools/fetch_durations.py            # every course
  python tools/fetch_durations.py cs1001     # one course
  python tools/fetch_durations.py --force    # re-fetch even when `d` is set

After a successful run, regenerate the pages that consume durations:

  python tools/generate.py myterm
  python tools/generate.py <stem>            # for the course pages you updated
"""
from __future__ import annotations

import argparse
import os
import sys
import time

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS_DIR)
import generate  # noqa: E402
from dashboard.playlist_import import extract_youtube_id  # noqa: E402


def _yt_dlp():
    try:
        import yt_dlp
    except ImportError as e:
        raise SystemExit(
            "yt-dlp is required. Install it with: pip install yt-dlp"
        ) from e
    return yt_dlp


def fetch_one(ydl, video_id: str):
    """Return duration in seconds, or None if yt-dlp cannot resolve it."""
    try:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}", download=False
        )
    except Exception:
        return None
    d = info.get("duration") if isinstance(info, dict) else None
    try:
        return int(d) if d else None
    except (TypeError, ValueError):
        return None


def collect_ids(data, force: bool):
    """Video ids that still need a duration, in first-appearance order."""
    seen, need = set(), []
    for week in data.get("weeks_data") or []:
        for item in week.get("items") or []:
            vid = extract_youtube_id(item.get("v") or "")
            if not vid or vid in seen:
                continue
            seen.add(vid)
            if force or not item.get("d"):
                need.append(vid)
    return need


def apply_durations(data, durations: dict):
    """Write `d` onto every item whose video id is in `durations`. Returns
    how many items were updated."""
    n = 0
    for week in data.get("weeks_data") or []:
        for item in week.get("items") or []:
            vid = extract_youtube_id(item.get("v") or "")
            if vid and vid in durations:
                if item.get("d") != durations[vid]:
                    item["d"] = durations[vid]
                    n += 1
    return n


def run_course(stem: str, ydl, force: bool, cache: dict) -> int:
    data = generate.load(stem)
    need = [vid for vid in collect_ids(data, force) if vid not in cache]
    for i, vid in enumerate(need, 1):
        print(f"  [{i}/{len(need)}] {vid}", flush=True)
        d = fetch_one(ydl, vid)
        if d is None:
            print(f"    skipped (no duration)")
            continue
        cache[vid] = d
        # be polite to YouTube when walking a whole programme
        time.sleep(0.35)
    # also reuse anything already fetched for another course this run
    for week in data.get("weeks_data") or []:
        for item in week.get("items") or []:
            vid = extract_youtube_id(item.get("v") or "")
            if vid and item.get("d") and vid not in cache:
                cache[vid] = item["d"]
    updated = apply_durations(data, cache)
    if updated:
        generate.save(stem, data)
        print(f"  wrote {updated} duration(s) into {stem}")
    else:
        print(f"  nothing new for {stem}")
    return updated


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("stems", nargs="*", help="course stems (default: every course)")
    p.add_argument("--force", action="store_true", help="re-fetch even when d is already set")
    args = p.parse_args(argv)

    yt_dlp = _yt_dlp()
    stems = args.stems or generate.all_stems()
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "nocheckcertificate": True,
    }
    cache = {}
    total = 0
    with yt_dlp.YoutubeDL(opts) as ydl:
        for stem in stems:
            print(stem)
            total += run_course(stem, ydl, args.force, cache)
    print(f"done: {total} lecture(s) updated across {len(stems)} course(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
