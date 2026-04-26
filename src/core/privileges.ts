import { promises as fs } from 'node:fs';
import { getHostsPath } from './hosts.js';

export async function isElevated(): Promise<boolean> {
  if (process.platform === 'win32') {
    try {
      const hostsPath = getHostsPath();
      const handle = await fs.open(hostsPath, 'r+');
      await handle.close();
      return true;
    } catch {
      return false;
    }
  }
  return process.getuid?.() === 0;
}

export async function requireElevated(): Promise<void> {
  if (process.env.LOCUS_HOSTS_PATH) return;
  if (await isElevated()) return;
  console.error('locus needs admin privileges to edit your hosts file.');
  console.error('try: sudo locus  (or run from an elevated terminal on windows)');
  process.exit(1);
}
