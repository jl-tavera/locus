```
   █████          ███████      █████████  █████  █████  █████████
  ▒▒███         ███▒▒▒▒▒███   ███▒▒▒▒▒███▒▒███  ▒▒███  ███▒▒▒▒▒███
   ▒███        ███     ▒▒███ ███     ▒▒▒  ▒███   ▒███ ▒███    ▒▒▒
   ▒███       ▒███      ▒███▒███          ▒███   ▒███ ▒▒█████████
   ▒███       ▒███      ▒███▒███          ▒███   ▒███  ▒▒▒▒▒▒▒▒███
   ▒███      █▒▒███     ███ ▒▒███     ███ ▒███   ▒███  ███    ▒███
   ███████████ ▒▒▒███████▒   ▒▒█████████  ▒▒████████  ▒▒█████████
  ▒▒▒▒▒▒▒▒▒▒▒    ▒▒▒▒▒▒▒      ▒▒▒▒▒▒▒▒▒    ▒▒▒▒▒▒▒▒    ▒▒▒▒▒▒▒▒▒
```

A minimal, monochrome site blocker that keeps your chosen sites **locked by
default** by editing the system hosts file. To get in, you solve a timed math
challenge and pick a short unlock window (5/10/15/30 min, max 30); when it ends
the sites **auto re-lock** — enforced by a background task so closing the app
can't leave them open. Two surfaces: direct subcommands and an Ink-powered TUI.

## install

```sh
npm install
npm run build
npm link        # exposes the `locus` bin globally
```

Once published you'll be able to `npm i -g locus`. For now the local link is the
install path.

## the admin requirement

LOCUS edits the hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows,
`/etc/hosts` on macOS/Linux), which requires admin/root. Any command that writes
to the hosts file (`lock`, `relock`, and unlocking) will refuse to run without
access:

```
locus needs write access to the Windows hosts file.
fix: run  locus setup  (one-time, prompts UAC) — then any PowerShell works.
or: relaunch your terminal as administrator.
```

Read-only commands (`add`, `remove`, `list`, `profile *`, `status`) work without
elevation.

## Windows

Just run `locus`. The first time you launch it you'll see a single UAC
prompt — accept once, and from then on `locus`, `locus lock`, and the
unlock flow work from any normal (non-admin) PowerShell. No admin
terminal needed.

Behind the scenes locus is granting your Windows user `Modify` on
`C:\Windows\System32\drivers\etc\hosts` (the file Windows browsers
consult). To re-run the setup explicitly: `locus setup`. To revert, open
that file's Properties → Security tab and remove your user's entry.

If you cancel the UAC prompt, the TUI still opens in read-only mode —
sites, profiles, status, and streak all work, only locking/unlocking
needs the grant. Run `locus setup` later to enable it, or relaunch your
terminal as administrator.

The auto re-lock uses a one-shot Windows Scheduled Task (`locus-relock`),
created under your user — no admin needed. DNS flush uses `ipconfig
/flushdns` so blocks land immediately.

## commands

```
locus                                 launch the interactive TUI
locus add <url>                       add a site to the library
locus remove <url>  (alias: rm)       remove a site from the library + every profile
locus list                            list every site
locus profile create <name>           create a new profile
locus profile delete <name>           delete a profile
locus profile list                    list profiles
locus profile add <name> <url>        add a site to a profile (auto-adds new sites)
locus profile remove <name> <url>     remove a site from a profile
locus lock [profile|all]              block the locked set now (and set what's locked)
locus relock                          re-lock now, ending any unlock (also run by the task)
locus status                          locked / unlocked + time until re-lock
locus streak                          unlock-history calendar + current streak
```

Unlocking (with the challenge + 5/10/15/30-min picker) lives in the TUI — run
`locus` with no arguments. URL inputs are normalized: scheme, path, port,
trailing slash, and a leading `www.` are all stripped before storage. Each site
is blocked under both `example.com` and `www.example.com` automatically.

## interactive TUI

Run `locus` with no arguments to enter the dashboard. Navigate with arrows,
select with Enter, return with Esc, quit with `q` from the dashboard.

```
   █████          ███████      █████████  ...

  always locked · solve to unlock · monochrome

  ▌ unlock
    sites
    profiles
    streak
    status
    quit

  ↑↓ navigate · enter select · esc back
```

Screens:
- **unlock** — pick a window (5/10/15/30 min) → solve the challenge → live countdown until re-lock (Ctrl-C re-locks early, no challenge needed)
- **sites** — add (`a`), delete selected (`d`)
- **profiles** — create (`c`), delete (`d`), open (Enter); `l` sets the highlighted profile as the locked set, `a` locks the whole library
- **streak** — GitHub-style contribution calendar of your unlock history, current streak + longest, total minutes, busiest day
- **status** — locked / unlocked + time until re-lock

## unlock mode

Sites stay locked by default. From the TUI's **unlock** screen you pick how long
to open them (5/10/15/30 min), solve a timed 3-digit + 3-digit addition (8 s per
attempt; wrong/timeout regenerates), and the locked set opens with a centered
MM:SS countdown. At zero it auto re-locks and flushes the OS DNS cache. Ctrl-C
re-locks immediately — re-locking is free, only unlocking is gated.

On Windows, starting an unlock registers a one-shot Scheduled Task (`locus-relock`)
that re-applies the block at the deadline **even if you close the app or
terminal** — there's no close-the-window loophole. The foreground countdown and a
startup check are backstops. Each unlock is recorded; completed windows count
toward the streak.

What's locked is the whole library by default, or a single profile you designate
(`locus lock <profile>` / press `l` in the profiles screen).

The hosts edit plus a DNS-cache flush is what enforces a block. locus does not
touch your browser on Windows or macOS — new navigations are blocked, but a site
already open in a tab may keep loading from the browser's internal DNS cache or
an existing connection until you reload it. (On Linux, when run via `sudo`, locus
will close and reopen Chromium/Firefox-family browsers so the block lands
instantly; set `LOCUS_NO_BROWSER_RESTART=1` to opt out there too.)

If the app is closed during an unlock, the background task re-locks at the
deadline anyway. The next launch also reconciles the `activeUnlock` window:

- still in the future → the TUI re-opens directly into the running unlock countdown
- already past → it re-locks immediately (block re-applied, state reset)

## storage

```
~/.config/locus/config.json          sites + profiles + lock/unlock state (Linux/XDG)
~/.config/locus/sessions.db          unlock history (SQLite)
~/.config/locus/backups/             timestamped hosts backups (last 10)
```

On macOS: `~/Library/Application Support/locus/`. On Windows: `%APPDATA%\locus\`.

Every write to the hosts file is preceded by a backup
(`hosts.<ISO-timestamp>.bak`). The backup directory is pruned to the most recent
10 by mtime.

Sessions are stored in a small SQLite database (better-sqlite3, WAL journal):
`id`, profile name + id, started/ended timestamps, planned vs actual duration,
and status (`completed` / `cancelled`). The streak screen reads this table to
build the contribution calendar.

## development

```sh
npm install
npm run dev          # tsup --watch
npm run build        # bundle to dist/cli.js
npm run typecheck    # tsc --noEmit
```

To exercise the full lock/unlock flow without touching the real hosts file,
point LOCUS at a temp file (PowerShell):

```powershell
$env:LOCUS_HOSTS_PATH = "$env:TEMP\locus-hosts"
New-Item -ItemType File -Force $env:LOCUS_HOSTS_PATH
node dist/cli.js add example.com
node dist/cli.js lock
Get-Content $env:LOCUS_HOSTS_PATH
```

When `LOCUS_HOSTS_PATH` is set, the privilege check is bypassed and the auto
re-lock task is skipped, so you can iterate without elevation. The store and
backup directories are unchanged.

## safety

- All edits are scoped between sentinel comments (`# >>> LOCUS START` …
  `# <<< LOCUS END`). LOCUS will never touch a line outside that block.
- A timestamped backup is taken before every write. On Unix writes are atomic
  (temp file + `rename`); on Windows the file is written in place (the `setup`
  grant covers the file, not its system directory).
- Pre-existing entries are preserved on every lock / unlock cycle.
- DNS flush is best-effort; it never fails the parent operation.

## streak + contribution calendar

`locus streak` (or the streak screen in the TUI) renders the last 53 weeks of
your unlock history as a GitHub-style heatmap:

```
   jan       feb       mar       apr   …
   · · · ░ · ▒ · · ▓ · · █ · · ░ · · · · …
m  · ░ · · ▒ · ▓ · · · █ · · · · · ▒ · …
   · · · ▒ · · · ▓ · · · █ · · · ░ · · …
w  · ▓ · · · ▒ · · · █ · · · ░ · · ▒ · …
…
```

Each cell is one day. Intensity is bucketed by quartiles of daily unlock minutes
(empty / q1 / q2 / q3 / top), so the scale auto-adjusts to your own habits
rather than a fixed threshold. Below the grid:

```
total: 42 unlocks · 17h 35m
current streak: 4 days · longest: 11 days
busiest: 2026-03-14 (5 unlocks, 2h 30m)
```

Only unlocks with status `completed` (the window ran its full length) count
toward the calendar and streak. Re-locking early (Ctrl-C) records the unlock as
`cancelled` and it does not advance the streak.

## design

Strict greyscale palette. No coloured accents, no spinners screaming for
attention. Hierarchy comes from `bold` + `dimColor` + rounded grey borders.
Section headings are lowercase em-dash style: `— sites —`, `— profiles —`.
The countdown timer uses 5-row solid block digits for legibility at a glance.
