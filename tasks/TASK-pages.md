# TASK · pages · bring the existing sites under garter.black (nested routes)

Read `tasks/CONVENTIONS.md` first. Port 8792. Root `C:\Hecate-Umbra\sites\garter-black-v3`.

Rio: "almost all of those pages we actually already have, can alias straight up. 69.delivery is the escort page, take from there and copy paste to us." So most routes are **raw aliases**: the existing site copied into `dist/<route>/`, working perfectly at the new path. Two routes are new house pages built with the page system.

## Routes you own
| Route | Source | Kind |
|---|---|---|
| `/escorts` | `C:\Hecate-Umbra\WEBSITES\69.delivery` (live: https://69.delivery) | raw alias |
| `/streamersbyhour` | `C:\Hecate-Umbra\WEBSITES\stream.garter.black` (live: https://stream.garter.black) | raw alias |
| `/rose` | `C:\Hecate-Umbra\WEBSITES\rose.garter.black` (live: https://rose.garter.black) | raw alias |
| `/rose/recruitment` | `C:\Hecate-Umbra\sites\garter-black-v2\rose\` (the current garter.black/rose page) | raw alias, linked from /rose |
| `/consulting` | the live page at https://old.garter.shop ("garter.shop · Adult Industry Advisory"). Find its source under `C:\Hecate-Umbra\WEBSITES` (search for "Adult Industry Advisory"); if none matches the live page, mirror the live HTML and assets | raw alias |
| `/records` | live https://album.black.gallery (the album page "DARKEST NIGHTS. BRIGHTEST STARS"). Find source under `C:\Hecate-Umbra\WEBSITES\black.gallery` or mirror live | raw alias |
| `/hotelbyhour` | `C:\Hecate-Umbra\sites\garter-black-v2\index.html` (today's garter.black home: the hotel by the hour site) | raw alias with edits below |
| `/streamersmanagement` | content from garter-black-v2 index (#sanctuary "Management" + creators copy) and the OF management part of `C:\Hecate-Umbra\WEBSITES\69.business` | **new house page** `src/streamersmanagement/index.html` |
| `/brothel` | content from 69.business (brothel lounge), garter-black-v2 (#house, #standard, #night, #licensed) | **new house page** `src/brothel/index.html` |

## Raw alias rules
- Copy the whole site folder into `dist/<route>/` (index.html plus every asset it uses: images, video, audio, pdf, css, js, fonts, samples). Do not copy `.wrangler`, `node_modules`, backups.
- Rewrite every root-absolute path so it works under the route: `/assets/x` becomes `/<route>/assets/x`, `/samples/x` becomes `/<route>/samples/x`, etc. Internal links to the site's own sections stay as `#anchors`. Links to the old domain itself (e.g. `https://69.delivery/...`, `https://stream.garter.black`, `https://rose.garter.black`, `https://fireflies.garter.black`) become the nested route (`/escorts`, `/streamersbyhour`, `/rose`, `/escorts`).
- Links to other old subdomains of the same family: `stream.garter.black` to `/streamersbyhour`, `rose.garter.black` to `/rose`, `fireflies.garter.black` and `69.delivery` to `/escorts`, `album.black.gallery` and `music.black.gallery` to `/records`.
- Canonical `<link rel="canonical">` and `og:url` must be `https://garter.black/<route>`.
- Remove anything that loads data from theblackgarter.com.au. Remove links to theblackgarter.com.au.
- If mirrored from the live site, strip what the edge proxy injected: the duplicated footer `<div style="margin-top:56px;...">` / `<div style="margin-top:40px;...">` blocks with "SEVEN SKIES CONSULTING" at the end of body, and the `elevenlabs-convai` element and script ONLY if they are the generic edge injection (keep a page's own deliberate agent, e.g. 69.delivery's "Speak to Thalia").
- Add one way back to the house on every raw page: a link with the text "The Black Garter" to `/`, placed in that page's own nav (match its nav link style), plus the same link in its footer.
- Keep each page's own 18+ gate. Pages must work with JavaScript and without console errors.

## /hotelbyhour extra edits
- Title `Hotel by the Hour · The Black Garter, Rockdale`, canonical `/hotelbyhour`.
- Delete the `#roster` section and the inline script that fetches `/api/roster` (it proxied the previous managers). Change every `#roster` link to `/#roster`. Change `/rose/` links to `/rose`. Change `https://stream.garter.black` links to `/streamersbyhour`. "The full roster" button goes to `/ladies`.
- Asset paths: this page uses `/assets/...`, which already exist in `dist/assets/` (same files). Keep them as `/assets/...`.
- Remove the `/_pbi/player.js` and convai script tags only if they are duplicated; one copy is fine.

## New house pages (`src/brothel/index.html`, `src/streamersmanagement/index.html`)
Built with the page system and the design system in CONVENTIONS. Terse: a hero plus 3 to 5 sections, no section longer than two short lines of lede plus a grid. Every frame should feel like a luxury editorial spread.
- `/brothel` (title "The Brothel · The Black Garter, Rockdale"): hero (kick "Licensed brothel · Rockdale, Sydney", h1 "The Brothel", h-line in serif italic, CTAs: "Tonight's roster" to `/#roster`, "The ladies" to `/ladies`, "Call the house" to `tel:{{tel}}`), image `/assets/black-room.jpg` in `.h-img`. Sections: The house (3 items), How the evening runs (4 steps, from #night), The standard (stats 32 / 0. / 18+ from #standard), Walk the house (link `https://black.garter.app`, the 3D building), Licensed premises (from #licensed), and a closing CTA band. Facts only from the sources.
- `/streamersmanagement` (title "Streamer Management · OnlyFans · The Black Garter"): hero (kick "OnlyFans and stream management · Sydney", h1 "Streamer Management"), what management covers (from the sources), rooms and the wiring (link `/streamersbyhour`), the sample guides (PDF links that already exist under `/rose/samples/`; check the files exist after /rose/recruitment is copied, else under `/rose/recruitment/samples/`), apply CTA to `/rose` and the house phone. Image `/assets/room-lines.jpg`.

## Redirect prep (do NOT deploy)
Create `tasks/redirects/` with one folder per retired host, each containing `_redirects` and a tiny `index.html` (meta refresh + link) that sends every path to the new route with a 301:
- `69-delivery/` to `https://garter.black/escorts`
- `fireflies-garter-black/` to `https://garter.black/escorts`
- `stream-garter-black/` to `https://garter.black/streamersbyhour`
- `rose-garter-black/` to `https://garter.black/rose`
Pages `_redirects` line format: `/* https://garter.black/escorts 301`.
Also find out which Cloudflare Pages project or Worker currently serves each of those four hosts (read only: `npx wrangler pages project list` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID=86cf181f919e67fc61e33a0d578903b0` loaded from `C:\Hecate-Umbra\.env` into the process env, never echoed), and record the mapping in `tasks/REDIRECTS.md`.

## Done means
- `python build.py` runs clean, `npx wrangler pages dev --port 8792` serves every route above with HTTP 200, no 404s for any asset (check the browser network list or crawl every src/href in each page and request it), no console errors.
- Desktop 1440x900 and mobile 390x844 look right (screenshots in `tasks/shots/pages/` if Playwright works).
- `tasks/REPORT-pages.md` written, cortex summary stored.
