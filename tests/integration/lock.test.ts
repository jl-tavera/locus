import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import Database from 'better-sqlite3';
import { makeTmpHosts, setTmpConfigDir, type TmpHosts, type TmpConfigDir } from '../helpers/tmp-env.js';

// LOCUS_HOSTS_PATH sandboxes the hosts file (and makes the scheduler a no-op);
// LOCUS_CONFIG_DIR sandboxes the Conf store + sqlite + backups. Both must be set
// before the singleton modules are imported.
let tmpHosts: TmpHosts;
let cfg: TmpConfigDir;
let lock: typeof import('../../src/core/lock.js');
let store: typeof import('../../src/core/store.js');
let hosts: typeof import('../../src/core/hosts.js');
let sessions: typeof import('../../src/core/sessions.js');

beforeAll(async () => {
  tmpHosts = makeTmpHosts('127.0.0.1 localhost\n');
  cfg = setTmpConfigDir();
  process.env.LOCUS_HOSTS_PATH = tmpHosts.hostsPath;
  lock = await import('../../src/core/lock.js');
  store = await import('../../src/core/store.js');
  hosts = await import('../../src/core/hosts.js');
  sessions = await import('../../src/core/sessions.js');
});

afterAll(() => {
  sessions.closeDb();
  delete process.env.LOCUS_HOSTS_PATH;
  tmpHosts.cleanup();
  cfg.cleanup();
});

beforeEach(() => {
  const s = store.getStore();
  s.set('sites', []);
  s.set('profiles', []);
  s.set('lockProfileId', null);
  s.set('activeUnlock', null);
  writeFileSync(tmpHosts.hostsPath, '127.0.0.1 localhost\n');
  // wipe recorded sessions for a clean slate (ensure table exists first)
  sessions.listAllSessions();
  const db = new Database(store.getSessionsDbPath());
  db.exec('DELETE FROM sessions');
  db.close();
});

describe('lock / unlock lifecycle', () => {
  it('applyLock blocks the whole library by default', async () => {
    store.addSite('example.com');
    store.addSite('twitter.com');
    await lock.applyLock();
    expect(await hosts.getActiveBlock()).toEqual(['example.com', 'twitter.com']);
  });

  it('startUnlock clears the block and records an active window', async () => {
    store.addSite('example.com');
    await lock.applyLock();
    const { endsAt } = await lock.startUnlock(5 * 60_000);
    expect(await hosts.getActiveBlock()).toEqual([]);
    const win = store.getActiveUnlock();
    expect(win).not.toBeNull();
    expect(endsAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('endUnlock re-applies the block and records a completed session', async () => {
    store.addSite('example.com');
    await lock.applyLock();
    await lock.startUnlock(5 * 60_000);
    await lock.endUnlock('completed');
    expect(await hosts.getActiveBlock()).toEqual(['example.com']);
    expect(store.getActiveUnlock()).toBeNull();
    const all = sessions.listAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe('completed');
  });

  it('startUnlock rejects a duration over 30 minutes', async () => {
    store.addSite('example.com');
    await lock.applyLock();
    await expect(lock.startUnlock(31 * 60_000)).rejects.toThrow(/30 min/i);
  });

  it('recover re-locks an expired unlock window', async () => {
    store.addSite('example.com');
    await lock.applyLock();
    // simulate an unlock that lapsed while the app was closed
    await lock.startUnlock(5 * 60_000);
    const win = store.getActiveUnlock()!;
    store.setActiveUnlock({ ...win, endsAt: new Date(Date.now() - 1000).toISOString() });
    const result = await lock.recover();
    expect(result.state).toBe('locked');
    expect(result.enforced).toBe(true);
    expect(await hosts.getActiveBlock()).toEqual(['example.com']);
    expect(store.getActiveUnlock()).toBeNull();
  });

  it('recover reports remaining time for a live unlock window', async () => {
    store.addSite('example.com');
    await lock.applyLock();
    await lock.startUnlock(10 * 60_000);
    const result = await lock.recover();
    expect(result.state).toBe('unlocked');
    expect(result.enforced).toBe(true);
    expect(result.remainingMs ?? 0).toBeGreaterThan(0);
  });

  // Regression: recordSession() used to run *before* applyLock(). A failed
  // re-block therefore committed a session row while leaving activeUnlock set,
  // so every later retry recorded another duplicate and inflated the streak.
  it('endUnlock records nothing and keeps the window when re-blocking fails', async () => {
    store.addSite('example.com');
    await lock.applyLock();
    await lock.startUnlock(5 * 60_000);
    // Removing the hosts file makes backupHosts() -> readFile throw ENOENT,
    // which is how a real permission failure surfaces out of applyLock().
    rmSync(tmpHosts.hostsPath, { force: true });

    await expect(lock.endUnlock('completed')).rejects.toThrow();
    expect(sessions.listAllSessions()).toHaveLength(0);
    expect(store.getActiveUnlock()).not.toBeNull();
  });

  it('recover reports enforced=false when it cannot re-apply the block', async () => {
    store.addSite('example.com');
    await lock.applyLock();
    await lock.startUnlock(5 * 60_000);
    const win = store.getActiveUnlock()!;
    store.setActiveUnlock({ ...win, endsAt: new Date(Date.now() - 1000).toISOString() });
    rmSync(tmpHosts.hostsPath, { force: true });

    const result = await lock.recover();
    expect(result.state).toBe('locked');
    expect(result.enforced).toBe(false);
    // still unlocked on disk — the guard task retries rather than reporting a lie
    expect(store.getActiveUnlock()).not.toBeNull();
  });

  it('locks only the chosen profile when one is set', async () => {
    const a = store.addSite('example.com');
    store.addSite('twitter.com');
    const profile = store.createProfile('work');
    store.setProfileSites(profile.id, [a.site.id]);
    await lock.setLockProfile(profile.id);
    expect(await hosts.getActiveBlock()).toEqual(['example.com']);
  });
});
