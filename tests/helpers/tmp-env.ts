import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TmpHosts {
  hostsPath: string;
  backupDir: string;
  cleanup: () => void;
}

/**
 * Provisions a tmp dir with an empty hosts file and a backup subdir.
 * Caller passes both into HostsOpts so the real /etc/hosts is never touched.
 */
export function makeTmpHosts(initial = ''): TmpHosts {
  const dir = mkdtempSync(join(tmpdir(), 'locus-hosts-'));
  const hostsPath = join(dir, 'hosts');
  const backupDir = join(dir, 'backups');
  writeFileSync(hostsPath, initial);
  return {
    hostsPath,
    backupDir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export interface TmpConfigDir {
  configDir: string;
  cleanup: () => void;
}

/**
 * Points LOCUS_CONFIG_DIR at a fresh tmp dir so the Conf store + sqlite DB
 * land somewhere disposable on every OS. Returns a cleanup that restores the
 * env. (XDG_CONFIG_HOME would only isolate on Linux — conf ignores it on
 * Windows/macOS, so tests would otherwise hit the real user config.)
 *
 * NOTE: must run before any call to getStore() / getDb() because both modules
 * cache singletons on first call. With vitest pool: 'forks', each test file
 * gets a fresh worker so the singletons are fresh per file.
 */
export function setTmpConfigDir(): TmpConfigDir {
  const dir = mkdtempSync(join(tmpdir(), 'locus-cfg-'));
  const previous = process.env.LOCUS_CONFIG_DIR;
  process.env.LOCUS_CONFIG_DIR = dir;
  return {
    configDir: dir,
    cleanup: () => {
      if (previous === undefined) delete process.env.LOCUS_CONFIG_DIR;
      else process.env.LOCUS_CONFIG_DIR = previous;
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    },
  };
}
