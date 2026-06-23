# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install
npm run dev          # tsup --watch — bundles src/cli.ts → dist/cli.js
npm run build        # tsup + fs.chmodSync dist/cli.js (cross-platform; adds the `#!/usr/bin/env node` banner, exec bit is a no-op on Windows)
npm run typecheck    # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run test         # vitest run — unit + integration suite under tests/
npm run test:watch   # vitest in watch mode
npm run start        # node dist/cli.js
npm link             # exposes `locus` globally after build
```

No linter is wired up. `typecheck` covers `src/`; `test` exercises the suite under `tests/`. CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every push to `main` and on pull requests.

### Tests

- `tests/unit/` — pure-function tests (url, duration, streak, calendar). No I/O.
- `tests/integration/` — exercises real files: `hosts-write.test.ts` writes to a tmp file via `HostsOpts`, `sessions.test.ts` and `store.test.ts` redirect Conf + sqlite via a tmp `LOCUS_CONFIG_DIR` (works on every OS — `XDG_CONFIG_HOME` would only isolate on Linux).
- `tests/helpers/tmp-env.ts` — `makeTmpHosts()` / `setTmpConfigDir()` provision per-test sandboxes.
- Vitest runs with `pool: 'forks'` so each test file gets a fresh worker; that's important because `src/core/store.ts` and `src/core/sessions.ts` cache singletons in module scope and would otherwise leak state between files.

### Running locally without elevation

`lock` / `relock` (and the TUI unlock flow) refuse to run without write access because they edit the hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows, `/etc/hosts` on macOS/Linux). To exercise the full flow against a temp file (PowerShell):

```powershell
$env:LOCUS_HOSTS_PATH = "$env:TEMP\locus-hosts"
New-Item -ItemType File -Force $env:LOCUS_HOSTS_PATH
node dist/cli.js block <profile>
```

When `LOCUS_HOSTS_PATH` is set, `requireElevated()` (src/core/privileges.ts) returns early and `cycleBrowsers()` (src/core/browsers.ts) becomes a no-op — both gates check that env var. The Conf store and backup directory are unaffected.

`LOCUS_NO_BROWSER_RESTART=1` opts out of the browser kill/relaunch on real runs.

### Seeding the streak / contribution calendar

```sh
node scripts/seed-mock-sessions.mjs            # adds ~365d of fake sessions
node scripts/seed-mock-sessions.mjs --reset    # wipes the table first
```

This writes directly to the same SQLite DB the CLI uses (`<conf-dir>/sessions.db`).

## Architecture

Single ESM bundle, two surfaces over one shared core:

- **CLI surface** — `src/cli.ts` registers commander subcommands; each lazy-imports its handler from `src/commands/*.ts`.
- **TUI surface** — running `locus` with no args calls `launchTui()` (`src/ui/launch.ts`), which renders the Ink `App` (`src/ui/App.tsx`). Screens live in `src/ui/screens/`.

Both surfaces call into `src/core/` for everything that has side effects.

### Two storage backends

State is split across two stores, both rooted at the OS conf dir (`~/.config/locus/` on Linux):

| Store | File | What it holds | Module |
|---|---|---|---|
| `conf` JSON | `config.json` | sites, profiles, `lockProfileId`, `activeUnlock` | `src/core/store.ts` |
| SQLite (WAL) | `sessions.db` | completed/cancelled unlock history | `src/core/sessions.ts` |

`getSessionsDbPath()` derives the SQLite path from the Conf store path so they always sit side by side. The DB schema is created on first connection (`CREATE TABLE IF NOT EXISTS sessions ...`) — there is no migration system; if you change the schema, also update `scripts/seed-mock-sessions.mjs`, which duplicates the `CREATE TABLE` statement.

### Hosts file editing (`src/core/hosts.ts`)

All edits sit between sentinel comments — LOCUS never touches anything outside this block:

```
# >>> LOCUS START
# managed by LOCUS — do not edit by hand
127.0.0.1 example.com
127.0.0.1 www.example.com
# <<< LOCUS END
```

Every write goes: backup (`hosts.<ISO>.bak`, pruned to last 10 by mtime) → `atomicWrite()`. On Unix that's write-to-`<path>.locus.tmp` → `rename` (atomic); on Windows it writes in place, because `locus setup` grants Modify on the *file* only — a normal user can't create a sibling temp in `System32\drivers\etc` (the backup is the recovery net). `findBlock()` locates the managed region; `getActiveBlock()` parses it back out for `status` and the TUI. Backups default to `%APPDATA%\locus\backups` (or beside the config when `LOCUS_CONFIG_DIR` is set).

### Lock / unlock lifecycle (the core model)

locus is **locked by default**: the locked set (a chosen profile, or the whole library when `lockProfileId === null` → `ALL_SITES_LABEL`) is written to the hosts file and stays there. You earn a temporary *unlock* by solving a challenge.

`src/core/lock.ts` is the orchestrator:
- `applyLock()` — idempotent; (re)writes the block for `getLockHostnames()` only when it differs from `getActiveBlock()`. Establishes the always-locked state. `setLockProfile(id)` changes which set is locked and re-applies.
- `startUnlock(durationMs)` — validates the duration (presets 5/10/15/30 min, max 30), `clearBlock()` + `flushDns()`, persists `activeUnlock` (`{profileId, startedAt, durationMs, endsAt}`) to the Conf store, and `scheduleRelock(endsAt)`.
- `endUnlock(status)` — `applyLock()` (re-block), records a `sessions` row (`completed`/`cancelled`; only `completed` advances streaks — now an *unlock history*), clears `activeUnlock`, `cancelRelock()`.
- `relock()` — scheduler/`locus relock` entry: ends an active unlock or just re-asserts the lock.

**Recovery:** `recover()` runs at the top of `main()` in `src/cli.ts` *and* `launchTui()`. An expired `activeUnlock` → re-lock immediately; a live one → report remaining time so the TUI boots into `UnlockRunner`; otherwise locked. The TUI additionally calls `applyLock()` on open so the locked-by-default state is re-asserted every launch.

**Strict auto re-lock (`src/core/scheduler.ts`):** on Windows, `startUnlock` registers a one-shot Scheduled Task `locus-relock` (PowerShell `Register-ScheduledTask`, runs as the current user) that runs `locus relock` at `endsAt` even if the app/terminal is closed — no close-the-terminal loophole. No-op under `LOCUS_HOSTS_PATH` (dev) or non-Windows; the foreground countdown and `recover()` are backstops.

**Challenge gate:** `src/ui/components/Challenge.tsx` is a 3-digit + 3-digit addition with an 8 s timer (wrong/timeout regenerates). It gates *unlocking* (the tempting action) in `src/ui/screens/Unlock.tsx`. Re-locking early (Ctrl-C in `UnlockRunner.tsx`) is free — it's the disciplined action. Intentional friction; don't simplify without checking.

### Platform detection (`src/core/platform.ts`)

`getPlatform()` returns `'win32' | 'darwin' | 'linux'` (cached). `LOCUS_FORCE_PLATFORM` overrides it for tests. Every OS-specific branch (hosts path, DNS flush, browser cycling, setup) keys off this, not raw `process.platform`.

### Elevation / setup (`src/core/privileges.ts`, `src/core/install.ts`)

`isElevated()` simply tries to open the hosts file `r+` — works on every OS, no `getuid`/`sudo`. On **Windows**, `grantHostsWriteAccess()` (the `locus setup` command, also auto-offered on first TUI launch via `maybeFirstRunSetup()` in `src/ui/launch.ts`) fires one UAC prompt that runs `icacls '<hosts>' /grant '<user>:M'`, granting the current Windows user Modify rights so later `lock`/`relock`/unlock work from a normal PowerShell. It no-ops (`reason: 'not-windows'`) on macOS/Linux, where locking still requires running from an elevated/`sudo` terminal.

### Browser cycling (`src/core/browsers.ts`)

Skipped in dev mode (`LOCUS_HOSTS_PATH`) or when `LOCUS_NO_BROWSER_RESTART=1`. **Only Linux cycles browsers** — and only when `SUDO_USER` is set: `cycleLinuxBrowsers()` does pgrep → pkill -TERM → pkill -KILL → relaunch via `sudo -u $SUDO_USER --preserve-env=...` as the original user. **Windows and macOS are a no-op** — the hosts edit + DNS flush enforce the block; force-killing the user's browser to refresh already-open tabs isn't worth the disruption (on Windows `taskkill /F` also tended to leave orphaned background processes holding the profile lock, breaking the next launch).

### URL & duration normalization

- `src/utils/url.ts` `normalizeUrl()` — strips scheme, path, port, leading `www.`, lowercases. Rejects localhost/127.0.0.1/::1 and anything that isn't a valid hostname. Always run user input through this before storing or comparing.
- `src/utils/duration.ts` `parseDuration()` — accepts `1h`, `25m`, `90s`, `1h30m`. Returns ms.

When blocking, each stored hostname is written as both `host` and `www.host` (see `buildBlock()` in hosts.ts).

### Streak / calendar

`src/core/calendar.ts` builds the 53-week grid; intensity buckets are quartiles of *that user's* daily focus minutes (so the heatmap auto-scales). `src/core/streak.ts` walks the set of distinct completed-session days. Both filter to `status === 'completed'` — cancelled sessions are recorded but excluded.

## Conventions

- ESM only (`"type": "module"`). All internal imports use the `.js` extension on TS source files (NodeNext resolution requires it).
- Strict TS with `noUncheckedIndexedAccess` — array/map indexing returns `T | undefined`; respect it.
- Lowercase-only user-facing copy (errors, headings, menu labels). Section headings in the TUI use em-dash style (`— sites —`). Strict greyscale palette in Ink components — no coloured accents, the only exception is the red/yellow/green countdown on the cancel-challenge timer.
- `recover()` (`src/core/lock.ts`) must be the first thing the CLI does on startup, before any command runs, otherwise an expired unlock won't auto re-lock.
