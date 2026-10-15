# REPORT · pages worker · garter.black v3 nested routes

Task: `tasks/TASK-pages.md` (read in full, twice). Conventions: `tasks/CONVENTIONS.md`. Status: **complete — nothing deployed** (per brief; no `wrangler pages deploy` was run, no secrets printed). Port 8792, local dev only.

## What was built

| Route | Kind | Source used | dist file |
|---|---|---|---|
| `/escorts` + `/escorts/females` `/escorts/males` `/escorts/privacy` `/escorts/refunds` `/escorts/terms` | raw alias | `WEBSITES/69.delivery/` | `dist/escorts/...` (6 HTML files) |
| `/streamersbyhour` | raw alias | `WEBSITES/stream.garter.black/` | `dist/streamersbyhour/index.html` |
| `/rose` | raw alias | `WEBSITES/rose.garter.black/` | `dist/rose/index.html` |
| `/rose/recruitment` | raw alias | `sites/garter-black-v2/rose/` | `dist/rose/recruitment/index.html` |
| `/consulting` | raw alias | `WEBSITES/garter.shop/index.html` (newer folder revision; see decisions) | `dist/consulting/index.html` |
| `/records` | raw alias (mirror of live) | live `https://album.black.gallery` (saved copy == `sites/_pbi_indexes/album_black_gallery.html` revision; HTML mirrored from the live fetch) + live assets | `dist/records/index.html` + `art/` + `audio/` |
| `/hotelbyhour` | raw alias + edits | `sites/garter-black-v2/index.html` | `dist/hotelbyhour/index.html` |
| `/brothel` | **new house page** | brief facts (69.business + v2 #house/#standard/#night/#licensed) | `src/brothel/index.html` → built |
| `/streamersmanagement` | **new house page** | brief facts (v2 #sanctuary + 69.business OF copy) | `src/streamersmanagement/index.html` → built |

Build commands (all run from the repo root):

1. `C:/Hecate-Umbra/runtime/memory-venv/Scripts/python.exe build.py` — src→dist (my two pages + peers' src pages), exit 0, "7 pages, asset version a7cc79c75e".
2. Raw aliases are built by standalone scripts kept in the worker scratch dir (not in-repo, by design — they transform sources in `WEBSITES/` into `dist/`, they are not part of `build.py`'s src tree):
   - `build_aliases.py` → `/escorts` (+subpages), `/streamersbyhour`, `/rose`, `/rose/recruitment`, `/consulting`; copies rose assets/samples.
   - `build_records.py` → `/records` (HTML transform; assets downloaded separately).
   - `build_hotelbyhour.py` → `/hotelbyhour`.
   All three re-run idempotently and fail loudly if any anchor string is missing; each ends with a `verify()` pass (forbidden strings absent, required strings present).

## Raw alias transforms applied (per the brief's rules)

- Root-absolute asset paths rewritten to `/<route>/assets/...`, `/<route>/samples/...`; internal `#anchors` kept.
- Old-domain links → nested routes: `69.delivery` / `fireflies.garter.black` → `/escorts`; `stream.garter.black` → `/streamersbyhour`; `rose.garter.black` → `/rose`; `album.black.gallery` / `music.black.gallery` → `/records`.
- Canonicals + `og:url` set to `https://garter.black/<route>` (added where the source had none, e.g. escorts privacy/refunds/terms).
- Everything loading from or linking to `theblackgarter.com.au` removed; `hello@theblackgarter.com.au` mailto rewritten to `0@black.industries`.
- Edge-injected blocks stripped where present (SEVEN SKIES footer blocks, duplicated convai/player copies). One deliberate agent per page kept: `/escorts` "Speak to Thalia", `/rose` "Aphrodite peer-support concierge", `/records` its own single widget ("one copy is fine" per line 34).
- House link added to every raw page: "The Black Garter" → `/` in each page's own nav style + footer.
- Each page keeps its own 18+ gate.

### /hotelbyhour edits (all from the brief)

Title `Hotel by the Hour · The Black Garter, Rockdale`; canonical `/hotelbyhour`; `#roster` section and the `/api/roster` fetch script deleted; every `#roster` link → `/#roster` (3); `/rose/` → `/rose` (5); `https://stream.garter.black` deep links → `/streamersbyhour` ("The Streamers Sanctuary"); `music.black.gallery` → `/records` ("The Record"); "The full roster" → `/ladies` (added beside the surviving "Today's roster" CTA); house links in nav + footer; `/assets/...` kept as-is (exist in `dist/assets/`).

## Decisions made (brief said: choose, record, continue)

1. **`/consulting` source**: two candidates — live `old.garter.shop` and `WEBSITES/garter.shop/index.html`. Diffed: the **folder revision is newer** (live is an older copy), so the folder revision was used, minus its draft JSON-LD block. Recorded here for review.
2. **`/records` numbered art (`art/01.jpg`…`art/16.jpg`)**: not deployed on the live site — live serves a 156,033-byte HTML fallback (md5 `cc0abbbe9619c3da40485363bf1e6d9d`) for every numbered art request. To make the new route behave **byte-identically to the old one**, that same fallback was mirrored into those 16 filenames. Real art (`cover.jpg`, `witch.jpg`, `witch.mp4`, `witch.webm`) was mirrored byte-exact from live; all 32 audio tracks downloaded.
3. **Relabels**: the retiring host `rose.garter.black` no longer appears as link text anywhere in dist — shown as "BLACK ROSE" (cisfoot rows on all alias pages + album works list + hotelbyhour deep link). The album's `theblackgarter.com.au` works-list entry was removed (line 25/26 rules). `garter.black` text kept where it appears as the house's live domain (links point to `/`).
4. **Album JSON-LD** (contains the artist's legal-name variants) left untouched — it is the page's own structured data, present on live; flagged here in case the names policy should be applied to it later (it would apply site-wide, not just to this mirror).
5. **Escorts title** ("69.DELIVERY - Fireflies Escort Network") kept as the page's own original title — the brief did not list a title change for raw aliases.
6. **Fixed during testing**: a surviving `https://rose.garter.black` deep link on `/hotelbyhour` ("What you get" card) — now `Black Rose` → `/rose` (found by browser DOM check, not by the static verify; both updated).

## Redirect prep (not deployed)

`tasks/redirects/` — four folders, each with `_redirects` (`/* https://garter.black/<route> 301`) + tiny `index.html` (meta refresh + canonical + link):
`69-delivery/` → `/escorts` · `fireflies-garter-black/` → `/escorts` · `stream-garter-black/` → `/streamersbyhour` · `rose-garter-black/` → `/rose`.

Host → serving project mapping (read-only recon; full detail in `tasks/REDIRECTS.md`):

| Host | Served today by | Deploy later (not run) |
|---|---|---|
| `69.delivery` | **Worker `sixty-nine`** (zone routes `69.delivery/*`, `*.69.delivery/*`) — not a Pages project | worker update or new Pages project + DNS |
| `fireflies.garter.black` | Pages project `fireflies` (custom domain confirmed via API) | `npx wrangler pages deploy tasks/redirects/fireflies-garter-black --project-name fireflies` |
| `stream.garter.black` | Pages project `stream-garter-black` | `npx wrangler pages deploy tasks/redirects/stream-garter-black --project-name stream-garter-black` |
| `rose.garter.black` | Pages project `rose-garter-black` **plus** worker route `rose.garter.black/*` → `pbi-edge` | `npx wrangler pages deploy tasks/redirects/rose-garter-black --project-name rose-garter-black` (+ decide on the pbi-edge route) |

Also noted: `garter.black` itself = Pages project `garter-black` (this repo's `wrangler.toml` name) with worker route `garter.black/*` → `pbi-edge`; `album.garter.black` → `darkest-nights.pages.dev`.

## Test results (all local, port 8792)

- `python build.py` — clean, exit 0.
- `npx wrangler pages dev dist --port 8792` — serves every owned route with HTTP 200 (directory routes canonicalise `route` → `route/` with 308, standard Pages behaviour).
- **MOVED redirects** (the worker's 301 table) — all 11 verified 301 → correct target: `/hotel`→`/hotelbyhour`, `/streamers`+`/stream`→`/streamersbyhour`, `/onlyfans`+`/management`→`/streamersmanagement`, `/music`+`/album`→`/records`, `/fireflies`→`/escorts`, `/recruitment`→`/rose`, `/directory`→`/forum/brothels`, `/admin`→`/roster`.
- **Asset crawl**: every local `src`/`href`/`srcset` ref across all 17 HTML pages fetched — 58 unique refs, **0 failures**. Spot assets all 200: records cover/witch art, 32 audio files, rose sample PDFs (5), house assets (`black-room.jpg`, `room-lines.jpg`, `cob-gold.mp4`, css/js).
- **Browser pass** (local Chromium): every page rendered with content, nav, footer, gates working; all scroll-reveal sections confirmed revealing; stats `32 / 0. / 18+` present; band video loads; album builds its 32-row track list. Console: **no real errors on any page.** Two benign local-dev artifacts documented: a 405 on `/cdn-cgi/rum` (Cloudflare RUM beacon — no endpoint in local dev; valid in production) and one aborted `rose-vid.mp4` fetch after `readyState 4` (video fully usable). `/roster` shows a 401 — that is the password gate working as designed. (`/ladies` shows two GSAP "target not found" warnings with the empty dev database — cards animate when data exists.)
- **Screenshots**: `tasks/shots/pages/` — 17 routes × 2 viewports (1440×900 desktop, 390×844 mobile) = 34 full-page PNGs, taken after a scroll-through so reveal animations are visible. Machine-readable console/status evidence: `tasks/shots/pages-console-report.json`.
- Console-capture method was validated with a deliberate synthetic error probe before trusting "no errors" readings.

## Notes for Claude / follow-ups

- `dist/records/art/01.jpg`…`16.jpg` are intentionally the live fallback bytes (see decision 2) — the old site has the same behaviour; if real art is ever deployed, update both places.
- The v3 nav/footer partials (peers' files) show the label "RECRUITMENT SECTION HERE" for the `/rose` link — looks like a placeholder label; left untouched (not this worker's surface).
- Peers' routes (`/`, `/ladies`, `/roster`, `/forum`, `/brothels` etc.) were route-tested incidentally; `/ladies` and `/roster` were also exercised in the browser and behaved correctly.
- Nothing was deployed; the four redirect folders are ready for the cutover step.
