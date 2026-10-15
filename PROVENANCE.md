# Provenance of this tree

Nothing here was authored by the source-of-truth lane. Every file was copied
byte-for-byte from an existing, inspected candidate, and each copy is recorded.

| What | Copied from | Verified by |
|---|---|---|
| `src/`, `build.py`, `data/`, `tools/`, `tasks/`, `wrangler.toml`, `package.json`, `HANDOVER-ASTRA.md`, `.dev.vars.example` | `C:/Hecate-Umbra/sites/garter-black-v3` at git commit `5f8b6dfc9f73aa229f8e461866e605db84710a7f` ("garter.black v3: establish single source of truth", 2026-10-15), taking only files listed by `git ls-files` | file-for-file against that repo's tracked file list; media extensions dropped on copy |
| `recovered-dist/**` | `C:/Hecate-Umbra/sites/garter-black-v3/dist/` — build output for routes that have **no `src/` counterpart** and were therefore absent from the git repo | byte-for-file `cp -p`; only `.html .css .js .json .xml .txt` taken |

The upstream repo at `sites/garter-black-v3` had 103 tracked files; 25 of those
were media (film snapshots, contact sheets, venue jpg) and were dropped, leaving
78 source files here. `recovered-dist/` adds 24 further text files.

`recovered-dist/` is not a claim that those routes are finished. It is a claim
that those bytes exist, were reachable, and were at risk of being deleted by the
next `rm -rf dist && python build.py`. See `decisions/garter-black.md`.
