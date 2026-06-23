export type Platform = 'linux' | 'darwin' | 'win32';

let cached: Platform | null = null;

function detect(): Platform {
  const override = process.env.LOCUS_FORCE_PLATFORM;
  if (override === 'linux' || override === 'darwin' || override === 'win32') {
    return override;
  }
  if (process.platform === 'darwin') return 'darwin';
  if (process.platform === 'win32') return 'win32';
  return 'linux';
}

export function getPlatform(): Platform {
  if (cached === null) cached = detect();
  return cached;
}
