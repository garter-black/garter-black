# REPORT — gods · 19 sleeping Telegram god profiles

- Task: `C:\Hecate-Umbra\sites\garter-black-v3\tasks\TASK-gods.md`
- Worker: Umbra build worker (gods). Date: 2 Oct 2026. Host Hermes 0.21.5 (code 60e531cb).
- Nothing deployed. No token values printed anywhere.

**Status: DONE.** All 19 profiles built, every check green (except artemis's dead bot token,
pre-existing), all 19 left asleep, Hecate's default home untouched and still not running.

## Results table

Profile path prefix: `C:\Users\zwt26\AppData\Local\hermes\profiles\<god>`.
Soul copy saved for every god at `C:\Hecate-Umbra\soul\gods\<god>.md` (= profile `SOUL.md`).
"Tests" = cortex `memory_status` correct db+agent / `hermes -p <god> mcp test hecate-memory`
Connected (5 tools) / one-shot session reply OK / `state.db` present.

| god | profile (prefix profiles\) | soul source | cortex db | agent id | bot username | getMe | tests |
|---|---|---|---|---|---|---|---|
| aphrodite | profiles\aphrodite | existing (FLEET-ARCHIVE) + house block | aphroditecortex | 20 | @Aphrodite_blackbot | ok | all pass |
| artemis | profiles\artemis | existing (FLEET-ARCHIVE) + house block | artemiscortex | 10 | (token dead) | **401 Unauthorized** | all pass except bot |
| athena | profiles\athena | existing (FLEET-ARCHIVE) + house block | athenacortex | 5 | @Hecate_PBI_bot | ok | all pass |
| cassandra | profiles\cassandra | existing (FLEET-ARCHIVE) + house block | cassandracortex | 13 | @cassandra_blackbot | ok | all pass |
| circe | profiles\circe | existing (archive stub, 1,970 B) + house block | circecortex | 23 | @Hecate_Vanguard_Bot | ok | all pass |
| demeter | profiles\demeter | existing (FLEET-ARCHIVE) + house block | demetercortex | 15 | @BlackIndustries_Bot | ok | all pass |
| eos | profiles\eos | existing (FLEET-ARCHIVE) + house block | eoscortex | 11 | @Eos_blackbot | ok | all pass |
| erato | profiles\erato | existing (FLEET-ARCHIVE) + house block | eratocortex | 17 | @Erato_blackbot | ok | all pass |
| euterpe | profiles\euterpe | existing (FLEET-ARCHIVE) + house block | euterpecortex | 16 | @Euterpe_blackbot | ok | all pass |
| hedone | profiles\hedone | existing (FLEET-ARCHIVE) + house block | hedonecortex | 21 | @Hedone_blackbot | ok | all pass |
| hera | profiles\hera | existing (FLEET-ARCHIVE) + house block | heracortex | 6 | @Hecate_Black_Bot | ok | all pass |
| hestia | profiles\hestia | existing (FLEET-ARCHIVE) + house block | hestiacortex | 8 | @hecate_cloudbot | ok | all pass |
| medea | profiles\medea | existing (FLEET-ARCHIVE) + house block | medeacortex | 12 | @Medea_blackbot | ok | all pass |
| nyx | profiles\nyx | existing (FLEET-ARCHIVE) + house block | nyxcortex | 7 | @Nyx_blackbot | ok | all pass |
| persephone | profiles\persephone | existing (FLEET-ARCHIVE) + house block | persephonecortex | 19 | @Persephone_blackbot | ok | all pass |
| peitho | profiles\peitho | **written** (no archived soul existed) | peithocortex | 24 | @Peitho_blackbot | ok | all pass |
| selene | profiles\selene | existing (FLEET-ARCHIVE) + house block | selenecortex | 9 | @Selene_blackbot | ok | all pass |
| styx | profiles\styx | existing (FLEET-ARCHIVE) + house block | styxcortex | 18 | @Styx_blackbot | ok | all pass |
| thalia | profiles\thalia | existing (FLEET-ARCHIVE) + house block | thaliacortex | 14 | @Thalia_blackbot | ok | all pass |

Soul archive source: `D:\Hecate-Prime\profiles\hecate\artifacts\FLEET-ARCHIVE-20260924\<god>\SOUL.md`.
House block appended to every soul: current truth rules, Rio operator / Hecate commands the
Pantheon, draft-only external comms, current model route, own-cortex memory, asleep-by-default.
No wife or romance material in any of the 19 (verified: 0 hits across all archive souls earlier;
peitho written clean). Peitho's soul was composed from `PANTHEON\peitho` docs, `soulroster.md`
(21 Sep: "Legal research and professional legal coordination") and the THEIA deity page, in the
same house format (ATHENA BASIC 15 prefix + identity + lane + house rules).

## What was built (per god)

1. **Profile**: `hermes profile create <god> --no-alias` (default bundled skills kept, 58 synced).
2. **Config** (`profiles\<god>\config.yaml`): model = default home's route (`opencode-go` /
   `space-bunny-free`, chat_completions, reasoning max); safety mirrors the default home
   (`approvals.mode: off`, `security.redact_secrets: false`); `mcp_servers.hecate-memory` = direct
   stdio server with `HECATE_PG_DSN=postgresql://postgres@127.0.0.1:5432/<god>cortex` and
   `HECATE_AGENT_ID` (quoted string - YAML-string gotcha honored); Telegram platform block
   (`enabled: true`, `dm_policy: allowlist`); `gateway.standalone: true` (see decisions).
3. **Soul**: `SOUL.md` in the profile + copy in `C:\Hecate-Umbra\soul\gods\`.
4. **.env**: `TELEGRAM_BOT_TOKEN` (that god's token), `TELEGRAM_ALLOWED_USERS`,
   `TELEGRAM_HOME_CHANNEL`, `TELEGRAM_HOME_CHANNEL_NAME` (copied from `C:\Hecate-Umbra\.env`,
   the active source named in the brief), opencode keys, and `HECATE_AGENT_ID` + `HECATE_PG_DSN`.
5. **Cortex**: database `<god>cortex` created on the same server (127.0.0.1:5432), schema =
   `pg_dump --schema-only` of canonical `cortex` applied — all 19 verified identical (59 tables,
   table-set diff clean; file receipts in `C:\Hecate-Umbra\gods\verify\tables-*.txt`). `agents`
   row seeded per god (id, external_id, name, role, hive_slot).
6. **state.db**: created by a real one-shot session per profile (`hermes -p <god> -z`), then
   verified present. Note: in 0.21.5 a bare `-p <god> status` does NOT create state.db; the
   brief's intent (profile's own store exists) is met via the one-shot.

## Verification evidence (this build)

- `memory_status` against each god's exact MCP env: 19/19 correct database + agent id
  (`gods\verify` receipts; build script `gods\build\mcp_smoke.py`).
- `hermes -p <god> mcp test hecate-memory`: 19/19 "Connected" (1.3-2.2s), 5 tools discovered.
- One-shot session per god: reply OK; `state.db` present for all 19.
- getMe: 18/19 ok; artemis = HTTP 401 "Unauthorized" (token revoked per the standing house note;
  needs a fresh BotFather token from Rio before she can wake).
- Wake/sleep/status scripts (`C:\Hecate-Umbra\gods\`): end-to-end tested with **cassandra**:
  wake 22:19 → log shows "[Telegram] Connected to Telegram (polling mode)", "polling confirmed
  healthy", "telegram connected"; guard re-wake says "already awake"; sleep 22:25 → clean stop,
  both PIDs dead, pid file removed; status.ps1 shows all 19 asleep.
- Autostart: no Scheduled Tasks, no services, nothing registered (`schtasks` / `Get-Service`
  checked). Gateways run hidden only via `wake.ps1`.

## Hecate default unchanged (before → after)

- `SOUL.md`  sha256 `41d32353f5f60002dadc92aa4c3105edda493e0d9b2403e63284e368a0aa4ebe` → identical
- `config.yaml` sha256 `a70fd235bff1c30556441e67a9b9cd2022cec2176d4f95bbac25e95e31f7912f` → identical
- default `.env` identical to the pre-build backup copy; default gateway: not running at start,
  not running at finish (same state). Backups: `C:\Hecate-Umbra\backups\gods-20261002\`.

## Decisions recorded (most reasonable choice per instruction)

1. **`gateway.standalone: true` on all 19.** Hermes 0.21.5 refuses per-profile gateways by
   default ("exactly one gateway per host ... profile does not get a gateway of its own"); its
   own refusal message names `gateway.standalone: true` as the sanctioned compatibility path.
   This keeps the brief's model (per-god wake/sleep; nothing autostarts; default gateway off).
   It is a temporary shim per Hermes; fold to `hermes gateway migrate --multiplex` someday.
2. **Agent ids**: from the canonical `cortex.agents` table + `D:\Hecate-Prime\hive\MASTERLIST.md`
   (athena 5 ... hedone 21). No record exists for circe/peitho → assigned next free ids **23**
   (circe) and **24** (peitho); flagged for operator review.
3. **Allowlist/home channel** copied from `C:\Hecate-Umbra\.env` (active values; the default
   home's `.env` has those keys commented out). Allowlist mechanism confirmed in 0.21.5 source
   (`TELEGRAM_ALLOWED_USERS`, per-profile scoped; valid `dm_policy` values are
   open/allowlist/disabled/pairing - old "restricted" is not one, so "allowlist" was used).
4. **Cortex summary category**: brief says `decision`, importance 0.9 (overrides the generic
   conventions value fact/0.8). Stored accordingly.
5. **skills**: default profile-create behavior kept (58 bundled skills) - the 2026 old fleet
   used `--no-skills`, not required by this brief.

## Known issues / left to do

- **artemis token**: revoked (401). Everything else for artemis is complete; wake her only after
  Rio supplies a fresh `TELEGRAM_BOT_TOKEN_ARTEMIS` in `C:\Hecate-Umbra\.env`, then re-copy it to
  `profiles\artemis\.env`.
- **Shared cron while awake**: by 0.21.5 design, any running gateway also ticks the host's cron
  for other profiles. During the cassandra wake test the default profile's "MV32 creative loop"
  job was claimed and then drained at sleep (its previous run today ended the same way when its
  owner exited; the scheduler heals the stale row on next start). If that job's cadence matters,
  check its output. Nothing ticks while all 19 are asleep.
- **Default SOUL.md heuristic hit**: the default (Hecate) soul contains a legacy comment
  `<!-- MODULE 02: ... (SYSTEM 1 VS. 2) -->` that the prompt-injection scanner flags
  (html_comment_injection) and then loads anyway (warn-only, user's own file). Benign; left
  untouched (hash verified unchanged). The 19 god souls trigger nothing.

## Files

- Scripts: `C:\Hecate-Umbra\gods\{wake.ps1, sleep.ps1, status.ps1}`, usage in `gods\README.md`.
- Receipts: `gods\bots.json` (usernames only), `gods\verify\` (schema diffs, smoke evidence,
  soul sources), `gods\build\` (the build scripts).
- Logs/pids: `gods\logs\`, `gods\pids\` (empty while asleep).
