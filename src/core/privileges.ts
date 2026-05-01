import { promises as fs } from 'node:fs';
import { getHostsPath } from './hosts.js';
import { getPlatform } from './platform.js';

export async function isElevated(): Promise<boolean> {
  try {
    const handle = await fs.open(getHostsPath(), 'r+');
    await handle.close();
    return true;
  } catch {
    return false;
  }
}

export async function requireElevated(): Promise<void> {
  if (process.env.LOCUS_HOSTS_PATH) return;
  if (await isElevated()) return;
  for (const line of elevationMessage()) console.error(line);
  process.exit(1);
}

function elevationMessage(): string[] {
  switch (getPlatform()) {
    case 'wsl':
      return [
        'locus needs write access to the Windows hosts file.',
        'fix: run  locus setup  (one-time, prompts UAC) — then any terminal works.',
        'or: relaunch your terminal as administrator.',
        '(sudo inside WSL is not enough — Windows ACLs gate this file.)',
      ];
    case 'win32':
      return [
        'locus needs admin privileges to edit the hosts file.',
        'right-click your terminal and choose "Run as administrator", then run locus again.',
      ];
    case 'darwin':
    case 'linux':
    default:
      return [
        'locus needs admin privileges to edit your hosts file.',
        'try: sudo locus  (or run from an elevated terminal)',
      ];
  }
}
