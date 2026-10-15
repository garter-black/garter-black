#!/usr/bin/env python3
"""Pixel stats for film frames: white/bright levels, channel maxima, mean luma."""
import glob
import sys

from PIL import Image


def stats(path):
    im = Image.open(path).convert("RGB")
    L = im.convert("L")
    h = L.histogram()
    total = sum(h)
    near_white = sum(h[240:])
    white = sum(h[250:])
    bright = sum(h[200:])
    ext = im.getextrema()
    rmax = max(e[1] for e in ext)
    mean = sum(i * v for i, v in enumerate(h)) / total
    luma_max = max(i for i, v in enumerate(h) if v > 0)
    print(
        "%s: %dx%d maxchan=%d lumaMax=%d nearWhite240=%d white250=%d bright200=%d (%.4f%%) meanL=%.1f"
        % (path.split("/")[-1], im.size[0], im.size[1], rmax, luma_max,
           near_white, white, bright, 100.0 * bright / total, mean)
    )


for pat in sys.argv[1:]:
    for p in sorted(glob.glob(pat)):
        stats(p)
