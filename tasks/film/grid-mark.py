#!/usr/bin/env python3
"""Draw a 10% measurement grid over a frame (top region) for precise visual alignment."""
import sys

from PIL import Image, ImageDraw

src = sys.argv[1]
out = sys.argv[2]
top = int(sys.argv[3]) if len(sys.argv) > 3 else 420

im = Image.open(src).convert("RGB")
crop = im.crop((0, 0, im.size[0], top))
d = ImageDraw.Draw(crop)
w, h = crop.size
for i in range(1, 10):
    x = int(w * i / 10)
    color = (0, 255, 255) if i == 5 else (255, 0, 255)
    d.line([(x, 0), (x, h)], fill=color, width=1)
    d.line([(x, 0), (x, 6)], fill=color, width=3)
for j in range(1, 10):
    y = int(h * j / 10)
    color = (0, 255, 255) if j == 5 else (255, 0, 255)
    d.line([(0, y), (w, y)], fill=color, width=1)
    d.line([(0, y), (6, y)], fill=color, width=3)
crop.save(out)
print("saved", out, crop.size)
