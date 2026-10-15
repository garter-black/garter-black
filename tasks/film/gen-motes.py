#!/usr/bin/env python3
"""Deterministic mote-table generator for band-film.html.

Emits <span class="mote"> elements with seeded values baked into data
attributes (no runtime randomness in the composition). Run once, paste.
"""
import random

random.seed(0xC0FFEE)

IDX = 0
LINES = []
for layer, count, tw_hi in (("back", 10, 4.6), ("front", 16, 5.2)):
    for i in range(count):
        IDX += 1
        left = round(random.uniform(2.5, 97.5), 2)          # %
        top = round(random.uniform(7.0, 93.0), 2)           # %
        size = round(random.uniform(1.4, 3.6), 2)           # px
        alpha = round(random.uniform(0.07, 0.20 if layer == "back" else 0.30), 3)
        dx = round(random.uniform(-70, 70), 1)              # px over life
        dy = round(random.uniform(-95, -25), 1)
        tw = round(random.uniform(0.4, tw_hi), 2)           # start time
        length = round(random.uniform(3.4, 4.6), 2)         # life length
        if tw + length > 9.6:
            tw = round(9.6 - length, 2)
        if IDX > 14:
            continue
        size = min(5.5, round(size * 1.9, 2))
        alpha = min(0.55, round(alpha * 2.2, 3))
        LINES.append(
            '<span class="mote" id="m{idx}" data-dx="{dx}" data-dy="{dy}" '
            'data-tw="{tw}" data-len="{length}" data-a="{alpha}" '
            'style="left:{left}%;top:{top}%;width:{size}px;height:{size}px"></span>'.format(
                idx=IDX, dx=dx, dy=dy, tw=tw, length=length, alpha=alpha,
                left=left, top=top, size=size,
            )
        )

print()
for ln in LINES:
    print("          " + ln)
print()
