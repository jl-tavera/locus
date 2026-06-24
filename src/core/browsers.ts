import { execa } from 'execa';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPlatform } from './platform.js';

interface LinuxBrowser {
  proc: string;
  exec: string;
}

// proc = name pgrep -x will match (kernel comm, max 15 chars)
// exec = command to relaunch with
const LINUX_BROWSERS: LinuxBrowser[] = [
  { proc: 'brave',       exec: 'brave' },
  { proc: 'chromium',    exec: 'chromium' },
  { proc: 'chrome',      exec: 'google-chrome-stable' },
  { proc: 'firefox',     exec: 'firefox' },
  { proc: 'firefox-bin', exec: 'firefox' },
  { proc: 'zen',         exec: 'zen-browser' },
  { proc: 'zen-bin',     exec: 'zen-browser' },
];

const RELAUNCH_ENV = [
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'XDG_RUNTIME_DIR',
  'DBUS_SESSION_BUS_ADDRESS',
  'XAUTHORITY',
  'XDG_SESSION_TYPE',
  'HOME',
].join(',');

export async function cycleBrowsers(): Promise<void> {
  if (process.env.LOCUS_NO_BROWSER_RESTART) return;
  if (process.env.LOCUS_HOSTS_PATH) return;
  // Brave (and every Chromium browser) keeps an in-process DNS/host cache that
  // survives the OS-level `ipconfig /flushdns`, so an unblocked site keeps
  // resolving to 127.0.0.1 until a manual refresh. Restarting the browser clears
  // that cache. On Windows we restart Brave only, and gracefully (no force-kill —
  // /F left orphaned processes holding the profile lock). macOS stays untouched.
  const platform = getPlatform();
  if (platform === 'linux') {
    await cycleLinuxBrowsers();
  } else if (platform === 'win32') {
    await cycleWindowsBrave();
  }
}

/**
 * Gracefully restart Brave on Windows so it drops its cached resolution of a
 * just-unblocked site. Best-effort: any failure is swallowed (the hosts edit +
 * DNS flush already enforce the change; this is only for immediacy). We capture
 * the running brave.exe path first and bail if we can't — never close a browser
 * we can't reopen. CloseMainWindow() lets Brave save its session so
 * "continue where you left off" restores the tabs on relaunch.
 */
async function cycleWindowsBrave(): Promise<void> {
  const ps = [
    `$procs = Get-Process -Name brave -ErrorAction SilentlyContinue`,
    `if (-not $procs) { return }`,
    `$path = $procs | Where-Object Path | Select-Object -First 1 -ExpandProperty Path`,
    `if (-not $path) { return }`,
    `$procs | ForEach-Object { $_.CloseMainWindow() | Out-Null }`,
    `for ($i = 0; $i -lt 25; $i++) {`,
    `  Start-Sleep -Milliseconds 200`,
    `  if (-not (Get-Process -Name brave -ErrorAction SilentlyContinue)) { break }`,
    `}`,
    `Start-Process -FilePath $path`,
  ].join('\n');

  try {
    await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  } catch (err) {
    console.error(`locus: failed to restart brave: ${(err as Error).message}`);
  }
}

async function cycleLinuxBrowsers(): Promise<void> {
  const sudoUser = process.env.SUDO_USER;
  if (!sudoUser) return;

  const detected = new Set<string>();
  for (const b of LINUX_BROWSERS) {
    if (await isLinuxRunning(b.proc)) detected.add(b.exec);
  }
  if (detected.size === 0) return;

  for (const b of LINUX_BROWSERS) {
    try { await execa('pkill', ['-TERM', '-x', b.proc]); } catch {}
  }

  for (let i = 0; i < 8; i++) {
    await sleep(500);
    if (!(await anyLinuxBrowserAlive())) break;
  }

  for (const b of LINUX_BROWSERS) {
    try { await execa('pkill', ['-KILL', '-x', b.proc]); } catch {}
  }
  await sleep(300);

  for (const cmd of detected) {
    try {
      const sub = execa('sudo', [
        '-u', sudoUser,
        `--preserve-env=${RELAUNCH_ENV}`,
        '--', cmd,
      ], { detached: true, stdio: 'ignore' });
      sub.unref();
    } catch (err) {
      console.error(`locus: failed to relaunch ${cmd}: ${(err as Error).message}`);
    }
  }
}

async function isLinuxRunning(proc: string): Promise<boolean> {
  try {
    await execa('pgrep', ['-x', proc]);
    return true;
  } catch {
    return false;
  }
}

async function anyLinuxBrowserAlive(): Promise<boolean> {
  for (const b of LINUX_BROWSERS) {
    if (await isLinuxRunning(b.proc)) return true;
  }
  return false;
}
