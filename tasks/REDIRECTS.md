# Redirect prep — retired hosts → garter.black routes

Worker: pages worker, task TASK-pages.md. Status: **prepared, not deployed**. No deploy was run; no secrets printed.

Each folder below contains `_redirects` (Cloudflare Pages format, single line `/* https://garter.black/<route> 301`) plus a tiny `index.html` (meta refresh + link fallback). To retire a host, deploy its folder to the host's project and confirm the old host 301s to the new route.

| Retired host | Target | Served today by | Deploy later (do not run without authorization) |
|---|---|---|---|
| `69.delivery` | `https://garter.black/escorts` | **Worker `sixty-nine`** — zone `69.delivery` has routes `69.delivery/*` and `*.69.delivery/*` → `sixty-nine`. Not a Pages project, so a Pages folder cannot attach directly; cutover needs the worker updated (or a new Pages project + DNS swap). | `npx wrangler pages deploy tasks/redirects/69-delivery --project-name <new-or-existing-project>` |
| `fireflies.garter.black` | `https://garter.black/escorts` | **Pages project `fireflies`** — custom domain `fireflies.garter.black` confirmed on the project. | `npx wrangler pages deploy tasks/redirects/fireflies-garter-black --project-name fireflies` |
| `stream.garter.black` | `https://garter.black/streamersbyhour` | **Pages project `stream-garter-black`** — custom domain `stream.garter.black`. No worker route on the host. | `npx wrangler pages deploy tasks/redirects/stream-garter-black --project-name stream-garter-black` |
| `rose.garter.black` | `https://garter.black/rose` | **Pages project `rose-garter-black`** (custom domain `rose.garter.black`) **plus** worker route `rose.garter.black/*` → `pbi-edge` on the `garter.black` zone. Decide with Rio whether the `pbi-edge` route is removed when the host retires. | `npx wrangler pages deploy tasks/redirects/rose-garter-black --project-name rose-garter-black` |

Deploying a redirect folder to an existing project replaces the content currently served on that host, which is the intended retirement step once the new routes are live and verified.

## How the mapping was established (read-only only)

- `npx wrangler pages project list` (token + account id loaded from `C:\Hecate-Umbra\.env` at run time; nothing printed).
- Read-only Cloudflare API GETs: `GET /accounts/<id>/zones`, `/zones/<id>/dns_records`, `/zones/<id>/workers/routes`, `/accounts/<id>/workers/domains`, `/accounts/<id>/pages/projects/<name>/domains`.

Findings of note:

- `garter.black` zone: `garter.black → garter-black.pages.dev` (Pages project `garter-black`, this repo's `wrangler.toml` name) with worker route `garter.black/*` → `pbi-edge` (the edge injection layer). `rose.garter.black/*` also routes through `pbi-edge`.
- `stream.garter.black → stream-garter-black.pages.dev`; `rose.garter.black → rose-garter-black.pages.dev`; `album.garter.black → darkest-nights.pages.dev`; `fireflies.garter.black → fireflies` project (domain confirmed via API; the project list table did not show it).
- `69.delivery` DNS: apex `A 192.0.2.1` (placeholder, proxied) with `blacklace.69.delivery` and `fireflies.69.delivery` CNAMEs — all served by worker `sixty-nine`.
- Related, for the wider cutover: `garter.shop` and `old.garter.shop` are worker custom domains (`garter-shop`, `garter-shop-advisory-old`); `old.garter.black` → worker `old-garter-black`; `develop.garter.black` → worker `develop-garter-black`; `black.garter.app` → worker `black-garter-venue` (the 3D building link used on /brothel).
