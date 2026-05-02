# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install
npm run dev          # tsup --watch — bundles src/cli.ts → dist/cli.js
npm run build        # tsup + chmod +x dist/cli.js (adds the `#!/usr/bin/env node` banner)
npm run typecheck    # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run test         # vitest run — unit + integration suite under tests/
npm run test:watch   # vitest in watch mode
npm run start        # node dist/cli.js
npm link             # exposes `locus` globally after build
```

No linter is wired up. `typecheck` covers `src/`; `test` exercises the suite under `tests/`. CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every push to `main` and on pull requests.

### Tests

- `tests/unit/` — pure-function tests (url, duration, streak, calendar). No I/O.
- `tests/integration/` — exercises real files: `hosts-write.test.ts` writes to a tmp file via `HostsOpts`, `sessions.test.ts` and `store.test.ts` redirect Conf + sqlite via a tmp `XDG_CONFIG_HOME`.
- `tests/helpers/tmp-env.ts` — `makeTmpHosts()` / `setTmpXdg()` provision per-test sandboxes.
- Vitest runs with `pool: 'forks'` so each test file gets a fresh worker; that's important because `src/core/store.ts` and `src/core/sessions.ts` cache singletons in module scope and would otherwise leak state between files.

### Running locally without sudo

`block` / `unblock` / `focus` normally refuse to run without root because they edit `/etc/hosts`. To exercise the full flow against a temp file:

```sh
export LOCUS_HOSTS_PATH=/tmp/locus-hosts
touch /tmp/locus-hosts
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
| `conf` JSON | `config.json` | sites, profiles, `activeFocus` | `src/core/store.ts` |
| SQLite (WAL) | `sessions.db` | completed/cancelled focus sessions | `src/core/sessions.ts` |

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

Every write goes: backup (`hosts.<ISO>.bak`, pruned to last 10 by mtime) → write to `<path>.locus.tmp` → `rename` (atomic). `findBlock()` is the source of truth for locating the managed region; `getActiveBlock()` parses it back out for `status` and the TUI status screen.

### Focus lifecycle

`startFocus()` in `src/core/focus.ts` is the orchestrator:

1. resolve hostnames (named profile, or the entire library when `profileName === null` → `ALL_SITES_LABEL`)
2. `writeBlock()` → `flushDns()` → `cycleBrowsers()` (kill + relaunch Chromium/Firefox-family browsers so they drop cached DNS and HTTP/2 sockets)
3. persist `activeFocus` to the Conf store (`profileId`, `startedAt`, `durationMs`, `endsAt`)

`endFocus(status)` reverses it and records a row in `sessions` (status is `completed` or `cancelled`; only `completed` advances streaks).

**Crash recovery:** `recoverFocus()` runs at the top of `main()` in `src/cli.ts` *and* at the top of `launchTui()`. If `activeFocus.endsAt` is in the past it auto-completes the orphan; if it's still in the future the TUI boots straight into the FocusRunner screen with the remaining time.

**Cancel guard:** `src/ui/screens/FocusRunner.tsx` requires solving a 3-digit + 3-digit addition challenge within 8 s before honouring an early Ctrl-C cancel — it's intentional friction, don't simplify it without checking.

### Browser cycling (`src/core/browsers.ts`)

Only runs when `SUDO_USER` is set (i.e. invoked via `sudo`) and not in dev mode (`LOCUS_HOSTS_PATH`). It pgreps each known browser, TERMs them, waits up to 4 s, KILLs survivors, then relaunches each detected browser via `sudo -u $SUDO_USER --preserve-env=...` so windows/tabs come back as the original user.

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
- `recoverFocus()` must be the first thing the CLI does on startup, before any command runs, otherwise an orphaned focus session won't auto-clean.
