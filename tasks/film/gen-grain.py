#!/usr/bin/env python3
"""Print the base64 data-URI for the film-grain SVG tile (warm gold noise)."""
import base64

SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">'
    '<filter id="n" x="0" y="0" width="180" height="180" filterUnits="userSpaceOnUse">'
    '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>'
    '<feColorMatrix type="matrix" values="0 0 0 0 0.86  0 0 0 0 0.72  0 0 0 0 0.50  1 0 0 0 0"/>'
    '</filter>'
    '<rect width="180" height="180" filter="url(#n)"/>'
    '</svg>'
)
b64 = base64.b64encode(SVG.encode("utf-8")).decode("ascii")
print("url(\"data:image/svg+xml;base64,%s\")" % b64)
