# garter.black v3 · conventions for every worker

Project root (on Rio's PC): `C:\Hecate-Umbra\sites\garter-black-v3`
Cloudflare Pages project `garter-black` (advanced mode worker in `dist/_worker.js/`). D1 binding `DB`, R2 binding `MEDIA`.

## Hard rules
1. **Never deploy** to Cloudflare, never change DNS, never touch any other site or folder except what your brief names. Claude reviews and deploys.
2. **Never print secrets** (no `.env` values in logs, reports or screenshots). Read keys only into process env when a brief explicitly allows it.
3. **No connection to theblackgarter.com.au** (previous managers). No links, no API calls, no images from it, no mention of it.
4. Visible copy: terse, confident, discreet. **No dashes** in visible copy (no em dash, en dash, or " - " as punctuation; use a middle dot `&middot;`, a comma, or the word "to"). No explicit content or imagery. Never invent facts (prices, hours, phone numbers): use only what existing pages already say.
5. File ownership. Only edit files your brief gives you. Claude owns: `build.py`, `src/partials/*`, `dist/assets/garter.css`, `dist/assets/garter.js`, `dist/assets/corridor.js`, `dist/_worker.js/{index,lib,schema,roster}.js`, `src/index.html`, `src/ladies/**`, `src/roster/**`. If you need a change there, write it in your report instead.
6. When finished: write `tasks/REPORT-<your-task>.md` (what you built, files, how you tested, what is left, known issues) and store a 3 to 6 line summary in the cortex with the `hecate-memory` MCP `memory_remember` tool (category `fact`, importance 0.8).

## Page system
House pages live in `src/<route>/index.html` and start with front matter:
```html
<!--page {"title":"Escorts · The Black Garter","desc":"...","canonical":"/escorts","og":"/assets/room-gold.jpg"} -->
<!--head--> optional extra head tags <!--/head-->
...page body (sections)...
<!--scripts--> optional extra scripts <!--/scripts-->
```
Build: `C:\Hecate-Umbra\runtime\memory-venv\Scripts\python.exe build.py` (writes `dist/`). The builder adds head, 18+ gate, nav, footer, 3D gold corridor, gsap and `/assets/garter.js`. Front matter keys: `title desc canonical og robots loader corridor gate chrome bodyClass edgeOff`.
`{{phone}} {{tel}} {{email}} {{wa}}` placeholders are filled by the builder.

Raw aliases (copies of existing sites) go straight into `dist/<route>/` with their assets in `dist/<route>/assets/`. build.py never touches them.

## Design system (`/assets/garter.css`)
Palette 90% black, 8% dark metallic gold, 2% deep red. Tokens: `--bg #060606`, `--panel #0c0c0c`, `--ink #cdb787`, `--soft #a8884a`, `--mute #80693a`, `--faint #544326`, `--gold #c8a558`, `--goldb #e2c787`, `--red #7a1420`, `--redb #a8202f`, `--line`, `--lsoft`. Fonts: Cormorant Garamond (display, light 300, italic accents) + Inter 300 (body, uppercase tracked labels). Never white text.
Section pattern:
```html
<section id="x"><div class="wrap">
  <div class="kick rv">01 &middot; Label</div>
  <h2 class="rv">Statement. <em>Italic gold turn.</em></h2>
  <p class="lede rv">One or two lines. <b>Bold gold key phrase.</b></p>
  <div class="grid rv"> <div class="item"><span class="rn">i</span><div class="lab">Label</div><h3>Title</h3><p>Copy</p><a class="deep" href="#">link</a></div> ... </div>
</div></section>
```
Hero: `<section id="hero" class="sub">` with `.hg`, `.h-kick`, `h1` with `<span class="w"><span>Word</span></span>`, `.h-line`, `.h-sub`, `.h-strip`, `.h-cta`, `.h-img` (img or `<video data-film autoplay muted loop playsinline>`), plus `<span class="cob-v l"></span><span class="cob-v r"></span>`.
Components: `.btn.solid` `.btn.ghost` `.btn.sm`, `.grid` `.grid.two` `.grid.four`, `.specs/.srow`, `.stats/.stat`, `.menu/.rate`, `.wk`, `.industry`, `.doors/.door`, `.band`, `.tabs/.tab[aria-selected]`, `.form/.fld/.chk/.seg`, `.chips/.chip`, `.stars`, `.panel`, `dialog.modal`, `#faq details`. Reveal on scroll: add `rv` class. Every `section` (except `#hero`) automatically gets the pulsing gold COB LED line on top.
JS helpers (`window.GB`): `GB.api(path,{body})`, `GB.esc`, `GB.toast(msg,isErr)`, `GB.ago(iso)`, `GB.stars(v)`, `GB.reveal(root)`, `GB.hm("20:00")`.

## Server (`dist/_worker.js/`)
`index.js` routes `/api/forum/*` and `/forum*` to `forum.js` (`export const SCHEMA = [...]`, `export async function api(request, env, ctx, url)`, `export async function page(request, env, ctx, url)` returning a Response or null). Schema statements must be idempotent (`CREATE TABLE IF NOT EXISTS`); index.js applies them once per isolate.
`lib.js` exports: `json bad fail HttpError readJSON esc slugify clean nowIso sydParts rosterDay signToken readToken hashPassword verifyPassword cookies setCookie clearCookie staffSession requireStaff userSession verifyGoogle ipHash throttle limitOrFail settings audit telegram sendEmail serveMedia injectMeta randomToken sha256hex`.
Staff (roster admins) carry the `gb_staff` cookie; `staffSession()` also accepts `Authorization: Bearer <AI_TOKEN>`.

## Local test
`npx wrangler pages dev --port <your port> --ip 127.0.0.1` from the project root (uses `wrangler.toml`, local D1 and R2, `.dev.vars`). Ports: pages 8792, forum 8791. Check desktop 1440x900 and mobile 390x844. If Playwright is available (`npx playwright screenshot --viewport-size=390,844 <url> out.png`), save screenshots in `tasks/shots/<task>/`.
