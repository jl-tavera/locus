import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setTmpXdg, type TmpXdg } from '../helpers/tmp-env.js';

let xdg: TmpXdg;
let store: typeof import('../../src/core/store.js');

beforeAll(async () => {
  xdg = setTmpXdg();
  store = await import('../../src/core/store.js');
});

afterAll(() => {
  xdg.cleanup();
});

beforeEach(() => {
  const s = store.getStore();
  s.set('sites', []);
  s.set('profiles', []);
  s.set('activeFocus', null);
});

describe('store', () => {
  it('isolates state under the tmp XDG_CONFIG_HOME', () => {
    expect(store.getStorePath().startsWith(xdg.configHome)).toBe(true);
  });

  it('derives sessions DB path next to the config file', () => {
    const cfg = store.getStorePath();
    const db = store.getSessionsDbPath();
    expect(db.endsWith('sessions.db')).toBe(true);
    // both should sit in the same directory
    expect(db.slice(0, db.lastIndexOf('/'))).toBe(cfg.slice(0, cfg.lastIndexOf('/')));
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

  it('activeFocus round-trips and clears', () => {
    expect(store.getActiveFocus()).toBeNull();
    const focus = {
      profileId: 'p1',
      startedAt: new Date().toISOString(),
      durationMs: 25 * 60_000,
      endsAt: new Date(Date.now() + 25 * 60_000).toISOString(),
    };
    store.setActiveFocus(focus);
    expect(store.getActiveFocus()).toEqual(focus);
    store.clearActiveFocus();
    expect(store.getActiveFocus()).toBeNull();
  });
});
