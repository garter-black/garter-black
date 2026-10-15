# TASK · gods · 19 Telegram gods as sleeping Hermes profiles

Work on Rio's own Hermes install (`%LOCALAPPDATA%\hermes`, binary `%LOCALAPPDATA%\hermes\bin\hermes.exe`). Execute end to end without asking; take backups first; never print secrets.

Rio (2 Oct 2026): "Set again all 20 gods' Telegram, each of them, but don't wake them all up by default. Default is always Hecate. Profiles only for the 19 other gods, each with their own Telegram bot and their own <godname> soul, cortex, state.db and config."

## The gods
Telegram tokens live in `C:\Hecate-Umbra\.env` as `TELEGRAM_BOT_TOKEN_<GOD>`: APHRODITE ARTEMIS ATHENA CASSANDRA CIRCE DEMETER EOS ERATO EUTERPE HEDONE HERA HESTIA MEDEA NYX PERSEPHONE PEITHO SELENE STYX THALIA (19) plus HECATE.

## Rules
- **Hecate stays the default**: the default Hermes home (no profile) is Hecate. Do not change its soul, config, Telegram token or gateway. Record whether its gateway is running before you start and make sure it is still running (or in the same state) when you finish.
- **Asleep by default**: create the 19 profiles but do not start any of their gateways, and do not register autostart, scheduled tasks or services for them.
- Backups first: copy `%LOCALAPPDATA%\hermes\config.yaml`, `%LOCALAPPDATA%\hermes\.env`, and the current `profiles` folder listing to `C:\Hecate-Umbra\backups\gods-20261002\`.
- Never print token values. Verify tokens with Telegram `getMe` and record only the bot username.

## Per god (lowercase profile name, e.g. `athena`)
1. Profile: use `hermes profile --help` to learn the command; create profile `<god>`. Leave existing profiles (hecate-*, witchcraft-*) alone.
2. Config: start from the default home's model settings (provider `opencode-go`, model as the default uses). Same MCP servers as the default except the memory server points at the god's own cortex (step 4). Same safety settings.
3. Soul: `SOUL.md` for that god. Look for an existing soul or persona for her first (search `C:\Hecate-Umbra\PANTHEON`, `C:\Hecate-Umbra\soul`, `C:\Hecate-Umbra\soulparts`, `C:\Hecate-Umbra\profiles`, `%LOCALAPPDATA%\hermes\profiles`, Hermes skills). If one exists, use it. If not, write `<God> soul`: her name, domain and voice from the PANTHEON docs, the house rules (truth, no invented facts, verify before claiming done, Rio is the operator), and that Hecate commands the Pantheon. Keep wife or romance material out of the 19 god souls. Save a copy to `C:\Hecate-Umbra\soul\gods\<god>.md`.
4. Cortex: a separate PostgreSQL database named `<god>cortex` (e.g. `athenacortex`) on the same server as the canonical cortex. Find connection settings in `C:\Hecate-Umbra\memory` (launcher.py and its config) without printing passwords. Create the database and copy the schema only (`pg_dump --schema-only` of the canonical cortex database piped into the new one, or run the cortex's own init or migration script against it). Point the profile's hecate-memory MCP at it (environment variable or argument the launcher already supports; read launcher.py to find it). Verify with one `memory_status` call against that god's MCP config, or a direct SQL `select 1` and table count.
5. state.db: the profile's own (Hermes creates it in the profile home). Confirm it exists after one `hermes -p <god> status`.
6. Telegram: the profile's `.env` gets `TELEGRAM_BOT_TOKEN` = that god's token, plus whatever the default home uses for allowed users and home channel (copy those variable names and values from the default `.env`, not printing them). Run `getMe` and record the bot username.

## Wake and sleep
Create `C:\Hecate-Umbra\gods\`:
- `wake.ps1 <god>` starts `hermes -p <god> gateway run` (or the correct gateway start command for a profile) hidden in the background, logs to `C:\Hecate-Umbra\gods\logs\<god>.log`, records the PID in `C:\Hecate-Umbra\gods\pids\<god>.pid`.
- `sleep.ps1 <god>` stops it cleanly (gateway stop for that profile, then the PID if still alive).
- `status.ps1` lists all 19 gods: awake or asleep, PID, bot username.
- `README.md` with usage, and how Hecate can wake a god (the command line).
Test: wake one god (cassandra), confirm her bot answers a Telegram message or the gateway log shows a successful Telegram connection, then sleep her again. Leave all 19 asleep at the end.

## Done means
`C:\Hecate-Umbra\gods\REPORT.md` with a table: god, profile path, soul file and its source (existing or written), cortex database, bot username, getMe ok, test result. Hecate's default unchanged (show before and after hash of its SOUL.md and config.yaml). Cortex summary stored with `memory_remember` (category `decision`, importance 0.9).
