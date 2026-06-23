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
  // Only Linux cycles browsers. On Windows/macOS we deliberately leave every
  // browser untouched: editing the hosts file + flushing DNS is what enforces a
  // block. Killing the browser was only a convenience so already-open tabs
  // noticed immediately — not worth force-closing the user's windows for.
  if (getPlatform() === 'linux') {
    await cycleLinuxBrowsers();
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
