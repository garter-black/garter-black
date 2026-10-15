# REPORT · forum · garter.black/forum

Task: `tasks/TASK-forum.md` (Umbra worker, 2 Oct 2026). Everything below was proven against local dev on port 8791. **Nothing was deployed.** No secrets appear in this file.

## What was built

A full review/feedback forum (syd99/aus99 functionality in a Reddit-style interface) served from the existing garter.black Pages worker: server-rendered pages for SEO plus a small client script for interaction, backed by `f_`-prefixed D1 tables, a JSON API under `/api/forum/*`, and a brothel directory with venue info pages.

### Files (owned by this task)

| Path | Size | Role |
|---|---|---|
| `dist/_worker.js/forum.js` | 71,016 B | SCHEMA (idempotent, seeds 10 boards), `/api/forum/*`, `/forum/*` page routing, feed/comment queries, moderation, import |
| `dist/_worker.js/forum-render.js` | 50,290 B | all SSR page HTML + partials (feed rows, comment nodes, venue cards, mod queue) |
| `dist/_worker.js/forum-shared.js` | 6,741 B | pure helpers (markdown, escape-first text, hot/wilson formulas, cursors, risk scanners) |
| `dist/assets/forum.css` | 19,842 B | forum skin on the house design tokens (black + dark metallic gold, Cormorant Garamond + Inter) |
| `dist/assets/forum.js` | 28,463 B | client: votes, comments, collapse, edit, report, subscribe, load more, login modal, DM, mod buttons |
| `src/forum/_shell.html` | 577 B | page shell with front matter (`gate: true`), built by `build.py` to `dist/forum/_shell.html` |
| `data/seed-boards.json` | 1,363 B | mirror of the board seed rows in SCHEMA, ordered by `pos` |
| `tasks/import-brothels.ps1` | 2,493 B | directory importer (`-BaseUrl`, `-Token`/`$env:GARTER_AI_TOKEN`, `-Path`) |
| `tasks/test-forum-api.sh` | 20,326 B | the 161-check API suite (kept as evidence/repeatable) |

`build.py` does not touch `dist/_worker.js/` or `dist/assets/` (it only reads the latter for cache-version hashing), so a future build cannot clobber these files.

## Routes (all tested)

| Route | Behaviour on 8791 |
|---|---|
| `/forum` | front page: Hot feed from all boards, sort tabs Hot · New · Top · Rising, sidebar (about, member card, boards, venue search, top venues this month, rules) |
| `/forum/all` | Top feed with time tabs Today · Week · Month · Year · All time (default Week) + sort tabs |
| `/forum/all.rss` | RSS 2.0 for the ranked feed |
| `/forum/b/<board>` | board page with header, description, flairs, same sorts |
| `/forum/p/<id>-<slug>` | post page: body, vote rail, flair, linked venue card, review ratings + sub-rating bars, threaded comments (Best · Top · New · Old), single reply form with reply/quote/cancel, collapse, permalink, edit/delete own, report, subscribe; slug is optional (`/forum/p/<id>` works) |
| `/forum/submit` | create post: board, flair, Text · Link · Review; Review requires venue (typeahead from the directory), overall + Rooms/Service/Value ratings, optional working name, optional visit month |
| `/forum/brothels` | directory: search, suburb filter, sort Rating · Reviews · Name · Newest, cards with stars, review count, latest review age |
| `/forum/brothels/<slug>` | venue page: name, suburb, address, phone (tel link), website (nofollow), hours, notes, average + sub-rating bars, reviews, threads mentioning it, Write a review, Suggest an edit, status badge |
| `/forum/u/<username>` | member: karma, cake day, rank title, posts + comments tabs |
| `/forum/messages` | DM inbox + conversation view, block/unblock (members only) |
| `/forum/notifications` | replies, mentions, subscriptions, DMs; mark read |
| `/forum/search?q=` | posts (FTS5) + brothels |
| `/forum/rules` | the house rules |
| `/forum/mod` | moderation queue: reports, held posts, held comments, suggestions, members (ban/unban, make mod, demote); staff session or member role mod/admin |
| `/forum/login` | sign in / join page (also a modal on every page) |
| `/forum/settings` | change password, set email, delete account |

## API endpoints (all under `/api/forum/`)

- Session: `GET /me` · `POST /join` · `POST /login` · `POST /logout` · `POST /google` · `POST /google/complete`
- Feed: `GET /posts?sort=&t=&board=&cursor=` (25/page, cursor)
- Posts: `POST /posts` · `POST /posts/<id>/edit|delete|subscribe|unsubscribe|report`
- Comments: `GET /comments?post=&cs=&after=` · `POST /comments` · `POST /comments/<id>/edit|delete|report`
- Votes: `POST /vote {t,id,val}` (toggle; score + hot update)
- Brothels: `GET /brothels?q=&list=1` · `POST /brothels/<id>/suggest`
- Messages: `GET /messages?with=&before=` · `POST /messages` · `POST /messages/block`
- Notifications: `POST /notifications/read`
- Settings: `POST /settings/password|email|delete`
- Moderation: `POST /mod/action {act,kind,id,reason}` (approve, remove, restore, lock, unlock, pin, unpin, ban, unban, makemod, demote, dismiss, accept, decline) — every action lands in `lib.audit`
- Import: `POST /admin/import` (staff session or AI bearer; array of venues, upsert by slug, `confidence: low` → unverified)

Auth levels: anonymous (read), member (write), mod/admin or staff (queue). Sessions: `gb_user` cookie via `signToken`, 30 days. Rate limits wired as specified (join 5/h/ip, login 10/10min/ip, post 10/h, comment 60/h, vote 600/h, message 30/h, report 20/h) — the 6th join in the window returns 429 (tested).

## Feature parity checklist

syd99/aus99 + Reddit list from the brief:

| Item | Status |
|---|---|
| Directory of every venue with info page | ✅ built; population comes from `POST /admin/import` (see known issues) |
| Reviews/field reports per venue with ratings + working name tags | ✅ review posts carry ratings, working name, visit month; venue page averages + bars |
| Who's working threads | ✅ `b/whos-working` board (customer-posted) |
| Member registration & profiles | ✅ join/login/logout, profiles with karma, cake day, rank, posts/comments |
| Private messages | ✅ inbox, conversation, block |
| Notifications + thread subscriptions | ✅ replies, mentions, subscriptions, DMs; read marking |
| Search | ✅ FTS5 virtual table + triggers (confirmed active locally), automatic LIKE fallback if fts5 is ever unavailable |
| Sticky (pinned) and locked threads | ✅ mod pin/lock, badges, enforced commenting on locked |
| Edit/delete own with "edited" marker | ✅ posts + comments, marker shown |
| Quote reply | ✅ client quote button prefills quoted reply |
| Report + auto hide | ✅ 3 distinct open reports hide pending review |
| Member ranks by karma | ✅ Newcomer · Regular · Trusted · Veteran · Legend |
| Up/down votes, score | ✅ posts + comments, optimistic client, gold/dark-red states |
| Hot ranking Reddit formula | ✅ `sign*log10(max(abs(ups-downs),1)) + (epoch-1134028003)/45000`, re-computed on every vote; order change tested |
| Top with time windows | ✅ Today/Week/Month/Year/All |
| Best comment sort (Wilson lower bound) | ✅ Best · Top · New · Old |
| Collapse comment trees | ✅ toggles, aria-expanded |
| Load more | ✅ feed cursor + comment chunks (client path built; see known issues for local data volume) |
| Deep links | ✅ per-comment anchors with target highlight |
| RSS | ✅ `/forum/all.rss` |
| Rules page + join-time agreement | ✅ rules page + checkbox at join |

### What aus99/syd99 additionally have (public pages only, read only; nothing copied)

Observed on aus99forum.com (vBulletin): geographic masters beyond Sydney (MELB99, other states, Outside Australia), commercial "shop roster" threads that shops bump themselves, per-forum thread/post counters and last-post previews, calendar, What's New / New Posts / Mark Forums Read, site leaders, polls, member albums/attachments, reputation points. Deliberately out of v1 scope: vendor bumping and ad-style posts (house copy bans advertising), geographic expansion, uploads (v1 is text only by safety spec), polls and calendar (easy follow-ups if wanted; our New/Hot/Rising feeds cover the "what's new" urge).

## Safety & moderation implementation

- Text only. Everything renders escape-first, then a tiny markdown (`**bold**`, `*italic*`, `> quote`, line breaks, autolinked URLs with `rel="nofollow ugc noopener"`). No HTML trust anywhere.
- Auto-hold (`pending`): phone numbers/emails, minors keyword list, and link posts from accounts younger than 24h. Held items are visible to their author (marked) and to the mod queue.
- Three reports auto-hide; banned members cannot post/vote/message but can read; blocks cut messaging both ways.
- Found during testing: post `meta description` serialization left raw `<` characters in an attribute (inert per HTML spec, but flagged by review). Fixed by sanitizing all user text that flows into desc/structured data (`plain()`); JSON-LD was already `<`-escaped by `lib.injectMeta`.

## Testing evidence

- **API suite** `bash tasks/test-forum-api.sh` → **161 checks, ALL PASS** (3rd run log `tasks/logs/test/api-run3.log`; earlier runs preserved as run1/run2). Covers joins + validation + the 6th-join 429, login/logout, post kinds, link-post hold, phone/minors comment holds, 4-deep threads, notifications incl. mention + subscription, votes + hot order flip + karma, reports → autohide → anon 404 → author held view, staff queue via AI bearer, member-mod queue, approve/pin/lock/unlock/remove/restore/dismiss, ban → 403s → unban, review → venue page averages, directory search/filter/sort, suggestion → accept, DMs + block + unblock, search, time windows, RSS, rules, google-hidden, XSS escaping (page + feed), settings password/email/delete, 404s, permalink without slug.
- **UI check** Playwright (chromium installed via npx) `node tasks/logs/test/ui-check.js` → **30 checks, ALL PASS, zero console errors**: 21 routes at 390x844 (no horizontal overflow anywhere; anon gates redirect to login for submit/mod/messages/notifications; 404 page returns 404), 4 desktop 1440x900 captures, signed-in flows on /forum/p/12 (vote click → score 1 + aria-pressed, comment submit → inserted + count update, collapse toggle), login modal at 390 (opens, signs in, reload lands signed-in). Run log `tasks/logs/test/ui-run3.log`.
- **Screenshots**: 28 files in `tasks/shots/forum/` (e.g. `forum-390.png`, `forum-1440.png`, `post-1440.png`, `venue-390.png`, `brothels-390.png`, `login-modal-390.png`, `forum-gate-390.png`, `forum-signedin-390.png`, `post-signedin-1440.png`).
- **Import proof**: `tasks/import-brothels.ps1` run against 8791 (fallback path, since `data/brothels.json` has not arrived yet) → `Imported: 1  Skipped: 0`, verified via API + SQL: The Black Garter, Rockdale, id 1, status open.
- `build.py` ran clean before dev; `node --check` clean on client; FTS confirmed (`f_fts`, trigger `f_fts_ai` present; search returns matches).

## Decisions and deviations (recorded as required)

1. **PBKDF2 iterations**: 25,000 chosen from the start (brief allows a lower argument if CPU limits fail). No failures observed; no real deploy so Workers CPU ceilings were not exercised. If a remote request ever 5xxs on join/login, drop the second argument in `hashPassword(pw, N)`.
2. **Link posts hold, reviews don't**: the 24h-new-account rule applies to link posts exactly as the brief words it; brand-new accounts' reviews go live (reports and the risk scanner still apply). Flagging as a deliberate reading; easy to extend.
3. **One full navigation** happens after a successful login modal/login (server-rendered state resync); every other interaction listed in the brief is reload-free.
4. **Comment loading**: one indexed query per post (cap 1000) trees in memory; first 30 roots render, "Load more comments" chunks roots client-side. Feed pages 25 with cursor.
5. **Cursor pagination** was exercised with a synthetic cursor (pin-branch) — local data is 14 live posts, below the 25/page threshold, so a natural multi-page walk was not reachable locally.
6. **Block semantics**: blocks stop sends both ways; the blocker also stops seeing the blocked member's messages.
7. **Google**: flow fully implemented server-side (verifyGoogle, username pick on first sign-in, hidden without client id). `settings.google_client_id` is empty, so the button is hidden and the flow could not be exercised locally.
8. **Mod access**: `/forum/mod` and mod actions accept the staff session / AI bearer, or a member with role mod/admin; roles managed via the mod action (or SQL for bootstrapping, as done in tests).

## Known issues / left for follow-up

- `data/brothels.json` has not been delivered by the directory worker yet. When it lands, run `tasks/import-brothels.ps1 -BaseUrl <url>` (idempotent upsert by slug; existing `closed` status is preserved). Until then the directory holds The Black Garter only.
- The nav contains a "RECRUITMENT SECTION HERE" placeholder — pre-existing house nav (`src/partials/nav.html`), not owned by this task.
- "Load more" appears once a scope has more than 25 live posts (or 30 comment roots); not reachable with current local data.
- Local dev database retains test rows (test posts/comments/members with `r####` suffixes are dev residue; safe to wipe, not shipped anywhere). Test passwords are local throwaways; no credentials were placed in any file.
- Login/join: no email verification (email optional by brief).

## Cheat sheet

```
# dev server (was left running during the task; stop with Ctrl+C / kill the session if still up)
npx wrangler pages dev --port 8791 --ip 127.0.0.1          # from project root

# API suite (needs the dev server up)
bash tasks/test-forum-api.sh

# UI check (Playwright; module resolved from the npx cache)
NODE_PATH="C:/Users/zwt26/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules" node tasks/logs/test/ui-check.js

# import (token from .dev.vars, never echoed)
GARTER_AI_TOKEN=<token> powershell -NoProfile -ExecutionPolicy Bypass -File tasks/import-brothels.ps1 -BaseUrl http://127.0.0.1:8791
```
