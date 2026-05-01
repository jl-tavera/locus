import { readFileSync } from 'node:fs';

export type Platform = 'linux' | 'wsl' | 'darwin' | 'win32';

let cached: Platform | null = null;

function detect(): Platform {
  const override = process.env.LOCUS_FORCE_PLATFORM;
  if (override === 'linux' || override === 'wsl' || override === 'darwin' || override === 'win32') {
    return override;
  }
  if (process.platform === 'darwin') return 'darwin';
  if (process.platform === 'win32') return 'win32';
  if (process.platform === 'linux' && isWslLinux()) return 'wsl';
  return 'linux';
}

function isWslLinux(): boolean {
  for (const p of ['/proc/sys/kernel/osrelease', '/proc/version']) {
    try {
      const content = readFileSync(p, 'utf8').toLowerCase();
      if (content.includes('microsoft') || content.includes('wsl')) return true;
    } catch {
      // file missing — try the next one
    }
  }
  return false;
}

export function getPlatform(): Platform {
  if (cached === null) cached = detect();
  return cached;
}

export function isWsl(): boolean {
  return getPlatform() === 'wsl';
}
