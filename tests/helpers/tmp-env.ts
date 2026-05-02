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

export interface TmpXdg {
  configHome: string;
  cleanup: () => void;
}

/**
 * Points XDG_CONFIG_HOME at a fresh tmp dir so the Conf store + sqlite DB
 * land somewhere disposable. Returns a cleanup that restores the env.
 *
 * NOTE: must run before any call to getStore() / getDb() because both modules
 * cache singletons on first call. With vitest pool: 'forks', each test file
 * gets a fresh worker so the singletons are fresh per file.
 */
export function setTmpXdg(): TmpXdg {
  const dir = mkdtempSync(join(tmpdir(), 'locus-xdg-'));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  return {
    configHome: dir,
    cleanup: () => {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previous;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
