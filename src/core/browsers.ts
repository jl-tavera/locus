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

interface WindowsBrowser {
  exe: string;       // tasklist IMAGENAME / taskkill /IM target
  launchKey: string; // App Paths key passed to `start`
}

const WINDOWS_BROWSERS: WindowsBrowser[] = [
  { exe: 'chrome.exe',  launchKey: 'chrome'  },
  { exe: 'msedge.exe',  launchKey: 'msedge'  },
  { exe: 'brave.exe',   launchKey: 'brave'   },
  { exe: 'firefox.exe', launchKey: 'firefox' },
];

export async function cycleBrowsers(): Promise<void> {
  if (process.env.LOCUS_NO_BROWSER_RESTART) return;
  if (process.env.LOCUS_HOSTS_PATH) return;
  const platform = getPlatform();
  if (platform === 'wsl') {
    await cycleWindowsBrowsers();
    return;
  }
  if (platform === 'linux') {
    await cycleLinuxBrowsers();
    return;
  }
  // darwin / win32 native: no-op for now (out of scope for this change)
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

async function cycleWindowsBrowsers(): Promise<void> {
  const detected: WindowsBrowser[] = [];
  for (const b of WINDOWS_BROWSERS) {
    if (await isWindowsRunning(b.exe)) detected.push(b);
  }
  if (detected.length === 0) return;

  for (const b of detected) {
    try { await execa('taskkill.exe', ['/F', '/IM', b.exe]); } catch {}
  }

  for (let i = 0; i < 8; i++) {
    await sleep(500);
    if (!(await anyWindowsBrowserAlive())) break;
  }
  await sleep(300);

  for (const b of detected) {
    try {
      // cmd.exe /C start "" <key> — empty-string title is required so cmd
      // doesn't treat <key> as the window title.
      const sub = execa('cmd.exe', ['/C', 'start', '', b.launchKey], {
        detached: true,
        stdio: 'ignore',
      });
      sub.unref();
    } catch (err) {
      console.error(`locus: failed to relaunch ${b.launchKey}: ${(err as Error).message}`);
    }
  }
}

async function isWindowsRunning(exe: string): Promise<boolean> {
  try {
    const { stdout } = await execa('tasklist.exe', [
      '/FI', `IMAGENAME eq ${exe}`,
      '/FO', 'CSV',
      '/NH',
    ]);
    return stdout.toLowerCase().includes(exe.toLowerCase());
  } catch {
    return false;
  }
}

async function anyWindowsBrowserAlive(): Promise<boolean> {
  for (const b of WINDOWS_BROWSERS) {
    if (await isWindowsRunning(b.exe)) return true;
  }
  return false;
}
