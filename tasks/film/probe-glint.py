#!/usr/bin/env python3
"""Find the most red-dominant pixel (the glint) near the expected position."""
import sys

from PIL import Image

im = Image.open(sys.argv[1]).convert("RGB")
px = im.load()
cx, cy = 626, 634  # 58%, 47% of 1080x1350
best = -999
bx = by = 0
for y in range(max(0, cy - 120), min(im.size[1], cy + 121)):
    for x in range(max(0, cx - 120), min(im.size[0], cx + 121)):
        r, g, b = px[x, y]
        dom = r - (g + b) / 2
        if dom > best:
            best, bx, by = dom, x, y
r, g, b = px[bx, by]
print(f"max red dominance={best:.1f} at ({bx},{by}) rgb=({r},{g},{b})")
