# TASK · forum · garter.black/forum (syd99 + Reddit, done properly)

Read `tasks/CONVENTIONS.md` first. Port 8791. Root `C:\Hecate-Umbra\sites\garter-black-v3`.

Rio: "a review/feedback forum, anyone can sign in via Google or user and password. Make a way better version of aus99 / syd99 (Sydney's biggest brothel forum). It must have all of their functionalities, and a list of all Sydney brothels with an info page and reviews. In the style of what works: Reddit. Every post can be thumbs upped, and garter.black/forum/all lists all top articles."

## You own
- `dist/_worker.js/forum.js` (replace the placeholder; you may add `dist/_worker.js/forum-*.js` helper modules)
- `src/forum/**` (page shells built by build.py), `dist/assets/forum.css`, `dist/assets/forum.js`
- `data/seed-boards.json`, `tasks/REPORT-forum.md`
Directory data arrives separately in `data/brothels.json` (another worker). Build the importer; import whatever exists when you finish.

## Architecture
- Server side rendering for SEO plus a small client script for interactivity. `forum.page()` fetches the built shell (`env.ASSETS.fetch(new Request(url.origin + "/forum/_shell"))`, shell built from `src/forum/_shell.html`), renders the page HTML server side, and injects it into `<div id="forum-root"></div>` with HTMLRewriter (`setInnerContent(html, {html:true})`), plus title, description, canonical and JSON-LD via `lib.injectMeta()`. The client (`/assets/forum.js`) handles votes, comment forms, collapse, login modal, load more, without full reloads.
- All tables prefixed `f_`. Export `SCHEMA` (idempotent statements). Seed boards with `INSERT OR IGNORE` inside SCHEMA.
- JSON API under `/api/forum/*`. Use lib helpers (`json`, `fail`, `readJSON`, `clean`, `limitOrFail`, `userSession`, `staffSession`, `signToken`, `hashPassword`, `verifyPassword`, `verifyGoogle`, `settings`, `audit`, `esc`, `slugify`).
- Cursor pagination, indexed queries, at most a handful of D1 queries per request.

## Routes (pages)
| Route | Page |
|---|---|
| `/forum` | front page: Hot posts from all boards, sort tabs Hot · New · Top · Rising, sidebar (about, sign in or member card, boards list, Sydney brothels search box, top brothels this month, rules) |
| `/forum/all` | everything ranked by Top, with time tabs Today · Week · Month · Year · All time (default Week) and sort tabs |
| `/forum/b/<board>` | one board, same sorts, board header and description |
| `/forum/p/<id>-<slug>` | post page: post body, votes, flair, linked brothel card if any, threaded comments (sort Best · Top · New · Old), reply forms, collapse, permalink, edit and delete own, report, subscribe |
| `/forum/submit` | create post: board, flair, type Text · Link · Review. Review type requires a brothel (typeahead from the directory), overall rating 1 to 5, sub ratings Rooms · Service · Value, optional lady working name, optional visit month |
| `/forum/brothels` | directory of Sydney brothels: search, suburb filter, sort by Rating · Reviews · Name · Newest, map-free list of cards (name, suburb, rating stars, review count, latest review age) |
| `/forum/brothels/<slug>` | venue page: name, suburb, address, phone (tel link), website (nofollow), hours, notes, average ratings with sub ratings bars, reviews (the review posts for this venue), threads mentioning it, Write a review, Suggest an edit (goes to mod queue), status badge (open / closed / unverified) |
| `/forum/u/<username>` | member: karma, cake day, rank title, posts and comments tabs |
| `/forum/messages` | private messages inbox and conversation view (members only), block a member |
| `/forum/notifications` | replies to your posts and comments, mentions |
| `/forum/search?q=` | posts and brothels (use FTS5 virtual table if it works in D1, else indexed LIKE) |
| `/forum/rules` | rules page |
| `/forum/mod` | moderation: reports queue, pending posts, brothel edit suggestions, members (ban, make mod), remove, approve, lock, pin. Access: staff session (`staffSession()` from the roster login, or AI bearer) or member role `mod`/`admin` |
| `/forum/login` | sign in / join page (also available as a modal everywhere) |
| `/forum/settings` | change password, set email (optional), delete account |

## Boards (seed)
general · General discussion; reviews · Field reports and reviews; whos-working · Who's working; brothels · Brothel news and openings; escorts · Independent escorts; massage · Massage parlours; newbies · New to it; lounge · The ladies' lounge (for workers); offtopic · Off topic; meta · Site feedback. Flairs per post: Review, Question, News, Discussion, Warning, Meta.

## Functionality parity checklist (syd99 / aus99 plus Reddit)
Directory of every venue with info page; reviews and field reports per venue with ratings; working name tags on reviews; who's working threads; member registration and profiles; private messages; notifications and thread subscriptions; search; sticky (pinned) and locked threads; edit and delete own posts with "edited" marker; quote reply; report; member ranks by karma (e.g. Newcomer, Regular, Trusted, Veteran, Legend); post and comment up and down votes; score; Hot ranking (Reddit formula `sign*log10(max(|ups-downs|,1)) + (created_epoch - 1134028003)/45000`); Top with time windows; Best comment sort (Wilson lower bound); karma; collapse comment trees; load more; deep links; RSS for `/forum/all` (`/forum/all.rss`).
Before writing, look at how aus99/syd99 present things (public pages only, read only, do not copy their text or data) and list anything else they have in your report.

## Auth
- Join with username + password: username 3 to 20 of `[a-z0-9_]` (case-insensitive unique), password 10+ chars, required checkbox "I am 18 or over and agree to the rules". Email optional. Hash with `lib.hashPassword` (PBKDF2). If Workers CPU limits fail the request, lower iterations via an argument and note it in the report.
- Sign in with Google: Google Identity Services button (`https://accounts.google.com/gsi/client`) using `settings(env).google_client_id`; when empty, hide the button. Server verifies with `lib.verifyGoogle`; first Google sign in asks the member to pick a username.
- Session cookie `gb_user` = `signToken(env, {uid, u, exp})`, 30 days, `setCookie("gb_user", tok, 2592000)`. Logout clears it.
- Rate limits with `limitOrFail` (keys include ip hash or member id): join 5/hour/ip, login 10 per 10 min/ip, post 10/hour, comment 60/hour, vote 600/hour, message 30/hour, report 20/hour.

## Safety and moderation (non-negotiable)
- Text only in v1: no image uploads, no image or video embeds. Render user text by escaping first, then a tiny safe markdown: `**bold**`, `*italic*`, `> quote`, line breaks, autolinked URLs with `rel="nofollow ugc noopener"`. Never trust HTML.
- Rules (on /forum/rules and shown at join): adults only; working names only, never real names, phone numbers, addresses or photos of workers or clients; no doxxing, threats or harassment; nothing involving anyone under 18 or anyone who did not consent; no drug dealing; no advertising your own services; reviews must be your own genuine experience.
- Auto hold for review (status `pending`): posts or comments that contain a phone number or email, any of a minors keyword list (teen, schoolgirl, underage, young looking, barely legal, high school, and similar), or link posts from accounts younger than 24 hours. Three reports auto hide pending review.
- Banned members cannot post, vote or message. Blocks hide messages from the blocked member.
- Every mod action goes to `lib.audit`.

## UI and design (top 0.1%, house style)
Use garter.css tokens and components, plus `forum.css`. Black and dark metallic gold, Cormorant Garamond for titles, Inter for UI. Desktop: feed column plus 320px sidebar; mobile: single column with a sticky top bar (board picker, sort, search, sign in). Post rows: vote rail (gold chevrons, score in serif numerals, upvoted state gold glow, downvoted state deep red), title in serif 22 to 26px, meta line in tracked uppercase 10px (b/board · u/name · 3h · 12 comments), flair chip, review rating stars. Comments: nested with thin gold left rules, depth indent 18px, collapse toggle, author rank chip. Empty states that read like the house ("No reviews yet. Be the first to write one."). Every page passes at 390px width with no horizontal scroll. Keyboard and screen reader friendly (buttons are buttons, aria-pressed on votes, labels on inputs).

## Directory import
- `POST /api/forum/admin/import` (staff or AI bearer only) reads a JSON array in the request body with fields `name, suburb, address, phone, website, hours, notes, sources, confidence` and upserts by slug. Entries with confidence `low` get status `unverified`.
- Also a seed path: if `data/brothels.json` exists when you finish, write `tasks/import-brothels.ps1` that posts it to a running server (`-BaseUrl`, `-Token`), and run it against your local dev server to prove it works.
- Always include The Black Garter (suburb Rockdale, address 17 to 19 The Seven Ways, Rockdale NSW 2216, phone 0451 700 056, website https://garter.black).

## Done means
`python build.py` clean; local dev (8791) proves: join, login, logout, Google button hidden without client id, create text, link and review posts, vote (and the score and hot order update), threaded comments 4 deep, collapse, edit, delete, report and auto hide, mod remove and approve and pin and lock, ban, DM send and receive and block, notifications on reply, search, directory list, filter and venue page with averages, /forum/all time windows, RSS, rules, 390px layout. No console errors. `tasks/REPORT-forum.md` lists every route and endpoint, the parity checklist with status, and screenshots if Playwright works. Cortex summary stored.
