import { execa } from 'execa';
import { setTimeout as sleep } from 'node:timers/promises';

interface BrowserSpec {
  proc: string;
  exec: string;
}

// proc = name pgrep -x will match (kernel comm, max 15 chars)
// exec = command to relaunch with
const BROWSERS: BrowserSpec[] = [
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
  const sudoUser = process.env.SUDO_USER;
  if (!sudoUser) return;

  const detected = new Set<string>();
  for (const b of BROWSERS) {
    if (await isRunning(b.proc)) detected.add(b.exec);
  }
  if (detected.size === 0) return;

  for (const b of BROWSERS) {
    try { await execa('pkill', ['-TERM', '-x', b.proc]); } catch {}
  }

  for (let i = 0; i < 8; i++) {
    await sleep(500);
    if (!(await anyBrowserAlive())) break;
  }

  for (const b of BROWSERS) {
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

async function isRunning(proc: string): Promise<boolean> {
  try {
    await execa('pgrep', ['-x', proc]);
    return true;
  } catch {
    return false;
  }
}

async function anyBrowserAlive(): Promise<boolean> {
  for (const b of BROWSERS) {
    if (await isRunning(b.proc)) return true;
  }
  return false;
}
