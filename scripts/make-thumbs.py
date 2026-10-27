#!/usr/bin/env python3
"""Make web-sized WebP copies of the site's images in images/thumbs/ (needs ffmpeg).

Headshots referenced in _data/{faculty,students,past_students}.yaml become 480px wide;
every other image becomes at most 1600px wide. The site uses a thumbnail automatically
when one exists, and falls back to the original image when it doesn't, so running this
is optional. Run from the repository root:  python3 scripts/make-thumbs.py
"""
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "images" / "thumbs"
out.mkdir(exist_ok=True)

people = set()
for name in ("faculty.yaml", "students.yaml", "past_students.yaml"):
    for m in re.finditer(r"^\s*#?\s*image:\s*(\S+)", (root / "_data" / name).read_text(), re.M):
        people.add(pathlib.Path(m.group(1)).name)

sources = [p for d in ("images", "post_images") for p in (root / d).iterdir()
           if p.suffix.lower() in (".jpg", ".jpeg", ".png") and p.is_file()]
for src in sorted(sources):
    dest = out / f"{src.stem}.webp"
    if dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime:
        continue
    width = 480 if src.name in people else 1600
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src),
           "-vf", f"scale='min({width},iw)':-2", "-c:v", "libwebp", "-quality", "80", str(dest)]
    subprocess.run(cmd, check=True)
    print(f"{src.relative_to(root)} -> {dest.relative_to(root)}")
