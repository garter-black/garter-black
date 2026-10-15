#!/usr/bin/env python3
"""Mean absolute pixel difference between two images (loop-closure check)."""
import sys

from PIL import Image, ImageChops

a = Image.open(sys.argv[1]).convert("RGB")
b = Image.open(sys.argv[2]).convert("RGB")
if a.size != b.size:
    print(f"SIZE MISMATCH {a.size} vs {b.size}")
    sys.exit(1)
d = ImageChops.difference(a, b)
px = d.load()
w, h = d.size
tot = 0
mx = 0
for y in range(0, h, 2):
    for x in range(0, w, 2):
        r, g, bl = px[x, y]
        v = (r + g + bl) / 3
        tot += v
        if v > mx:
            mx = v
n = (w // 2 + w % 2) * (h // 2 + h % 2)
print(f"mean_abs_diff={tot / n:.3f}  max_abs_diff={mx:.0f}")
