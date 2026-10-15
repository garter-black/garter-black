#!/usr/bin/env python3
"""Poster + contact sheet from a rendered film: 5 frames at 0/25/50/75/99% hstacked.

Usage: make-sheets.py <video> <duration_sec> <poster_out.jpg> <contact_out.jpg>
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

video, duration, poster_out, contact_out = (
    sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4],
)
tmp = tempfile.mkdtemp(prefix="sheet-")
times = [0.0, duration * 0.25, duration * 0.5, duration * 0.75, duration * 0.99]
frames = []
for i, t in enumerate(times):
    out = os.path.join(tmp, f"f{i}.png")
    subprocess.run(
        ["ffmpeg", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", out],
        check=True, capture_output=True,
    )
    frames.append(Image.open(out).convert("RGB"))

def _ensure(p):
    d = os.path.dirname(p)
    if d:
        os.makedirs(d, exist_ok=True)

_ensure(poster_out)
_ensure(contact_out)
frames[0].save(poster_out, quality=82)

w, h = frames[0].size
sheet = Image.new("RGB", (w * 5, h))
for i, fr in enumerate(frames):
    sheet.paste(fr, (i * w, 0))
sheet.save(contact_out, quality=88)
print("poster:", poster_out)
print("contact:", contact_out)
