#!/usr/bin/env python3
"""Locate the brightest pixels in a frame: values, colors, and bounding box."""
import sys

from PIL import Image


def bright(path, thresh=215):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    hits = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            m = max(r, g, b)
            if m >= thresh:
                hits.append((m, x, y, r, g, b))
    hits.sort(reverse=True)
    print("%s: %d sampled pixels >= %d" % (path.replace("\\", "/").split("/")[-1], len(hits), thresh))
    for m, x, y, r, g, b in hits[:12]:
        print("   max=%d at (%d,%d) rgb=(%d,%d,%d)" % (m, x, y, r, g, b))
    if hits:
        xs = [h_[1] for h_ in hits]
        ys = [h_[2] for h_ in hits]
        print("   bbox x[%d..%d] y[%d..%d] of %dx%d" % (min(xs), max(xs), min(ys), max(ys), w, h))


for p in sys.argv[1:]:
    bright(p)
