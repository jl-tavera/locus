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

A minimal, monochrome site blocker that edits your system hosts file. Two modes:
direct subcommands for power users, and an Ink-powered TUI for interactive flows.

## install

```sh
npm install
npm run build
npm link        # exposes the `locus` bin globally
```

Once published you'll be able to `npm i -g locus`. For now the local link is the
install path.

## the sudo requirement

LOCUS edits `/etc/hosts` (or `C:\Windows\System32\drivers\etc\hosts` on Windows),
which requires admin/root. Any command that writes to the hosts file
(`block`, `unblock`, `focus`) will refuse to run without elevation:

```
locus needs admin privileges to edit your hosts file.
try: sudo locus  (or run from an elevated terminal on windows)
```

Read-only commands (`add`, `remove`, `list`, `profile *`, `status`) work without
sudo.

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
locus block <name>                    write a profile's sites to the hosts file
locus unblock                         clear the LOCUS block
locus focus <name> <duration>         block for a duration with a live countdown
locus status                          current block + active focus
```

Durations parse `1h`, `25m`, `90s`, `1h30m`. URL inputs are normalized: scheme,
path, port, trailing slash, and a leading `www.` are all stripped before
storage. Each site is blocked under both `example.com` and `www.example.com`
automatically.

## interactive TUI

Run `locus` with no arguments to enter the dashboard. Navigate with arrows,
select with Enter, return with Esc, quit with `q` from the dashboard.

```
   █████          ███████      █████████  ...

  minimal site blocker · monochrome

  ▌ sites
    profiles
    focus
    status
    quit

  ↑↓ navigate · enter select · esc back
```

Screens:
- **sites** — add (`a`), delete selected (`d`)
- **profiles** — create (`c`), delete (`d`), open (Enter); inside a profile, add (`a`) / remove (`r`) sites
- **focus** — pick profile → enter duration → live countdown with progress bar
- **status** — current hosts block + remaining focus time

## focus mode

`locus focus Work 25m` writes the block, starts a centered MM:SS countdown,
auto-unblocks at zero, and flushes the OS DNS cache. Press Ctrl-C during the
session and you'll be prompted to confirm an early end (`y/N`).

When a block lands, locus closes and reopens any running Chromium-family or
Firefox browser (brave, chromium, chrome, firefox, zen). Browsers cache DNS
internally and reuse open HTTP/2 sockets, so without a restart a blocked site
can keep loading. Tabs are restored on relaunch. Set
`LOCUS_NO_BROWSER_RESTART=1` to opt out.

If the process dies hard (kill -9, terminal closed, system reboot), the next
launch checks `activeFocus.endsAt`:

- still in the future → the dashboard re-opens directly into the running focus screen
- already past → the orphan is cleaned up automatically (block is cleared, state reset)

## storage

```
~/.config/locus/config.json          sites + profiles + active focus     (Linux/XDG)
~/.config/locus/backups/             timestamped hosts backups (last 10)
```

On macOS: `~/Library/Application Support/locus/`. On Windows: `%APPDATA%\locus\`.

Every write to the hosts file is preceded by a backup
(`hosts.<ISO-timestamp>.bak`). The backup directory is pruned to the most recent
10 by mtime.

## development

```sh
npm install
npm run dev          # tsup --watch
npm run build        # bundle to dist/cli.js (with shebang + chmod +x)
npm run typecheck    # tsc --noEmit
```

To exercise the full block/unblock/focus flow without touching `/etc/hosts`,
point LOCUS at a temp file:

```sh
export LOCUS_HOSTS_PATH=/tmp/locus-hosts
touch /tmp/locus-hosts
node dist/cli.js block Work
cat /tmp/locus-hosts
```

When `LOCUS_HOSTS_PATH` is set, the privilege check is bypassed so you can iterate
without sudo. The store and backup directories are unchanged.

## safety

- All edits are scoped between sentinel comments (`# >>> LOCUS START` …
  `# <<< LOCUS END`). LOCUS will never touch a line outside that block.
- Writes are atomic (write to `<path>.locus.tmp`, then `rename`). A killed
  process can't leave the hosts file half-written.
- Pre-existing entries are preserved on every block / unblock cycle.
- DNS flush is best-effort; it never fails the parent operation.

## design

Strict greyscale palette. No coloured accents, no spinners screaming for
attention. Hierarchy comes from `bold` + `dimColor` + rounded grey borders.
Section headings are lowercase em-dash style: `— sites —`, `— profiles —`.
