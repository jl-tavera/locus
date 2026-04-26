const DURATION_RE = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;

export function parseDuration(input: string): number {
  if (typeof input !== 'string') throw new Error('duration must be a string');
  const value = input.trim().toLowerCase();
  if (!value) throw new Error('duration is empty');
  const match = DURATION_RE.exec(value);
  if (!match || (!match[1] && !match[2] && !match[3])) {
    throw new Error(`"${input}" is not a valid duration (try 25m, 1h, 1h30m, 90s)`);
  }
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  const total = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  if (total <= 0) throw new Error('duration must be greater than zero');
  return total;
}

export function formatRemaining(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDurationLong(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}
