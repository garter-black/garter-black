# Back Entrance page — tightening REPORT (private, not published)
# Worker: worker-policy-oct3-native-back-write-oct3
# Date: 3 October 2026
# Scope: src/backentrance.html, dist/backentrance.html, dist/backentrance/index.html,
#        src/partials/footer.html (ONE house link only, per coordinator expansion)

## RESULT
DONE. Actual source edit + narrow build + flat->index copy, verified by hash and grep.

## ARTIFACTS (absolute paths)
- C:/Hecate-Umbra/sites/garter-black-v3/src/backentrance.html
    sha256 a2b766f45c2fb4dda1fc06039aa1586532e82339ee69070e570fb84acb874542  (3786 bytes, 54 lines)
- C:/Hecate-Umbra/sites/garter-black-v3/dist/backentrance.html
- C:/Hecate-Umbra/sites/garter-black-v3/dist/backentrance/index.html
    both sha256 8d3b82a113617f7625f0288c3e7fb3eb09d250665ab1b1f764f0772338f5f8d8  (12047 bytes, identical)
- C:/Hecate-Umbra/sites/garter-black-v3/src/partials/footer.html  (+1 anchor, 2057 bytes, 40 lines)

## WHAT CHANGED IN THE PAGE
Source reduced from 101 lines / 7195 bytes to 54 lines / 3786 bytes.
Removed entirely:
  - Section "arrive" (02 On Arrival) — repeated arrival copy, "one call then you are in".
  - Div "band" filler strip.
  - Section "building" (04) — claimed "Two old front views" / front-2019 photos that do
    not exist as assets on the page; "Recognise the house" front-photo paragraph.
  - Section "tonight" (05) — "Ready when you are", "reception is the door that never moves".
  - Fictional lane location text "off The Seven Ways" (step one).
  - Door-opening promises: "and they bring you in" (route step three) and
    "so the door is opened for you" (arrive step three).
  - Address-section "By Car / off the Princes Highway" and speculative reception-guide copy.
Changed:
  - Kick numbering: route stays "01 · The Way In"; address renumbered "02 · The Address".
  - All route steps now say "very narrow grassy back lane" (matches human-confirmed route),
    drop the invented behind-building/off-Seven-Ways location.
  - Address lede drops "Off the Princes Highway"; section now: on-foot from station,
    call-if-unsure, venue address + Google Maps pin.
Kept:
  - Hero (id="hero") unchanged in structure/style: kick, Back Entrance h1, h-line,
    "very narrow grassy back lane to the dead end, then call or WhatsApp reception",
    strip, three CTAs (Call / WhatsApp / The way in -> #route). The #route anchor is
    still valid (section id="route" retained).
  - 18+ age gate (id="agegate") — confirmed present exactly once in dist.
  - Nav + footer chrome, gate, corridor background, scripts.

## FRONT-MATTER / OG
og set to "/assets/black-room.jpg" (neutral existing black room), NOT a front photo.
Confirmed in built dist: og:image content="https://garter.black/assets/black-room.jpg".
The previously-built dist still carried front-entrance-historical-aug2019.jpg (stale,
from before the previous worker's meta edit); the narrow rebuild replaced it.
No front-photo asset reference remains anywhere in the back pages (grep clean).

## FOOTER (coordinator expansion)
src/partials/footer.html "The house" nav now begins:
  <a href="/backentrance">Back entrance</a>
  <a href="/rose">Work with us</a>
  ... (all other links unchanged)
This is ONE useful house link alongside the house-arrival links. Everything else in
footer preserved byte-for-byte. It flowed into the narrow rebuild of backentrance.html
(confirmed by grep in dist). NO global build was run.

## BUILD
Command: C:/Hecate-Umbra/runtime/memory-venv/Scripts/python.exe build.py backentrance.html
Output:  "built backentrance.html" / "1 pages, asset version 2298bd7dec"
Only backentrance.html was built — no other page written by build.py.
Then: cp -p dist/backentrance.html dist/backentrance/index.html
Hashes of flat output and directory index match (8d3b82a1...). 

## VERIFICATION PERFORMED (actual outputs)
- src section ids: hero, route, address (only three sections).
- Forbidden-fiction grep in src: NONE FOUND.
- Forbidden-fiction grep in built dist (off The Seven Ways / door is opened / they bring
  you in / bring you in / front views / Front 2019 / street front / recognise the house /
  Ready when you are / never moves / On Arrival): NONE FOUND.
- Front-photo asset grep in back pages: NONE FOUND.
- tel: count in dist = 6 (hero CTA, route step 3, address step 2, nav call, mnav call,
  footer). wa.me count = 2 (hero CTA, mnav).
- agegate present = 1.
- Flat dist and directory index sha256 identical.

## BLOCKER (kept private — NOT published to the page)
ACTUAL REAR-DOOR PHOTO IS ABSENT. The user wants a real photograph of the rear door,
but no verified rear-door/back-lane photo exists in the build. Per instruction, no front
photo was faked in as a substitute, and no photo section was fabricated. The route is
therefore text-only. When a real rear-door photo is supplied, add it as the hero/route
visual and set og:image to it — do NOT reuse any front-entrance asset.

## NOT DONE / OUT OF SCOPE
- No network, no deploy, no browser, no other page touched.
- No global build (root will delegate the final full-source build after the Hera worker
  finishes editing the base; the builder reads whatever current base exists then).

## MEMORY RECEIPT
Live MCP memory_status verified this session: postgres cortex, agent_id 2, connected,
namespace_read true, writable true, latest_node_id 500374349.
