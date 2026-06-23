import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import path from 'node:path';
import { setTmpConfigDir, type TmpConfigDir } from '../helpers/tmp-env.js';

let tmp: TmpConfigDir;
let store: typeof import('../../src/core/store.js');

beforeAll(async () => {
  tmp = setTmpConfigDir();
  store = await import('../../src/core/store.js');
});

afterAll(() => {
  tmp.cleanup();
});

beforeEach(() => {
  const s = store.getStore();
  s.set('sites', []);
  s.set('profiles', []);
  s.set('lockProfileId', null);
  s.set('activeUnlock', null);
});

describe('store', () => {
  it('isolates state under the tmp config dir', () => {
    expect(store.getStorePath().startsWith(tmp.configDir)).toBe(true);
  });

  it('derives sessions DB path next to the config file', () => {
    const cfg = store.getStorePath();
    const db = store.getSessionsDbPath();
    expect(db.endsWith('sessions.db')).toBe(true);
    // both should sit in the same directory (path-separator agnostic)
    expect(path.dirname(db)).toBe(path.dirname(cfg));
  });

  it('starts with empty sites and profiles', () => {
    expect(store.listSites()).toEqual([]);
    expect(store.listProfilesRaw()).toEqual([]);
  });

  it('addSite returns created=true the first time, false on duplicate', () => {
    const a = store.addSite('example.com');
    expect(a.created).toBe(true);
    expect(a.site.url).toBe('example.com');
    const b = store.addSite('example.com');
    expect(b.created).toBe(false);
    expect(b.site.id).toBe(a.site.id);
    expect(store.listSites()).toHaveLength(1);
  });

  it('removeSite removes the site and detaches it from profiles', () => {
    const { site } = store.addSite('example.com');
    const profile = store.createProfile('focus');
    store.setProfileSites(profile.id, [site.id]);
    expect(store.findProfileById(profile.id)?.siteIds).toEqual([site.id]);
    const result = store.removeSite('example.com');
    expect(result.removed).toBe(true);
    expect(store.findProfileById(profile.id)?.siteIds).toEqual([]);
  });

  it('createProfile rejects empty and duplicate names', () => {
    store.createProfile('focus');
    expect(() => store.createProfile('focus')).toThrow();
    expect(() => store.createProfile('FOCUS')).toThrow(); // case-insensitive
    expect(() => store.createProfile('   ')).toThrow();
  });

  it('deleteProfile is case-insensitive and idempotent', () => {
    store.createProfile('Deep Work');
    expect(store.deleteProfile('deep work').removed).toBe(true);
    expect(store.deleteProfile('deep work').removed).toBe(false);
  });

  it('lockProfileId round-trips', () => {
    expect(store.getLockProfileId()).toBeNull();
    store.setLockProfileId('p1');
    expect(store.getLockProfileId()).toBe('p1');
    store.setLockProfileId(null);
    expect(store.getLockProfileId()).toBeNull();
  });

  it('activeUnlock round-trips and clears', () => {
    expect(store.getActiveUnlock()).toBeNull();
    const window = {
      profileId: 'p1',
      startedAt: new Date().toISOString(),
      durationMs: 15 * 60_000,
      endsAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
    store.setActiveUnlock(window);
    expect(store.getActiveUnlock()).toEqual(window);
    store.clearActiveUnlock();
    expect(store.getActiveUnlock()).toBeNull();
  });
});
