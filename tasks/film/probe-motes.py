#!/usr/bin/env python3
"""Check that motes actually render: sample luma around expected mote centres."""
import sys

from PIL import Image

im = Image.open(sys.argv[1]).convert("RGB")
px = im.load()
# (label, x, y) expected mote centres in the frame at snapshot time
spots = [
    ("m12", 486, 134), ("m3", 679, 135), ("m8", 848, 414),
    ("m4", 1054, 356), ("m2", 1388, 501),
]
for label, cx, cy in spots:
    best = 0
    bx = by = 0
    for y in range(max(0, cy - 45), min(im.size[1], cy + 46)):
        for x in range(max(0, cx - 45), min(im.size[0], cx + 46)):
            r, g, b = px[x, y]
            v = (r + g + b) // 3
            if v > best:
                best, bx, by = v, x, y
    # background estimate: mean of a ring 30-40px away
    tot = n = 0
    for y in range(max(0, cy - 85), min(im.size[1], cy + 86)):
        for x in range(max(0, cx - 85), min(im.size[0], cx + 86)):
            if abs(x - cx) > 55 or abs(y - cy) > 55:
                r, g, b = px[x, y]
                tot += (r + g + b) // 3
                n += 1
    bg = tot // max(1, n)
    print(f"{label}: peak={best} at ({bx},{by})  bg_mean={bg}  delta={best - bg}")
