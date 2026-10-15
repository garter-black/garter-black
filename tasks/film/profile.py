#!/usr/bin/env python3
"""Column brightness profiles of an image: print luma at sampled points."""
import sys

from PIL import Image

path = sys.argv[1]
xs = [int(v) for v in sys.argv[2].split(",")]
y0, y1, step = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])

im = Image.open(path).convert("L")
w, h = im.size
px = im.load()
print("image %dx%d" % (w, h))
header = "y\\x    " + "".join("%6d" % x for x in xs)
print(header)
for y in range(y0, y1 + 1, step):
    row = "%5d  " % y
    for x in xs:
        if 0 <= x < w and 0 <= y < h:
            row += "%6d" % px[x, y]
        else:
            row += "     -"
    print(row)
