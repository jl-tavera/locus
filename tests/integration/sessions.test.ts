import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setTmpConfigDir, type TmpConfigDir } from '../helpers/tmp-env.js';

// must set env BEFORE the Conf singleton is constructed; vitest pool: 'forks'
// guarantees each test file gets a fresh worker process so this is safe.
let tmp: TmpConfigDir;
let recordSession: typeof import('../../src/core/sessions.js').recordSession;
let listAllSessions: typeof import('../../src/core/sessions.js').listAllSessions;
let listSessionsSince: typeof import('../../src/core/sessions.js').listSessionsSince;
let closeDb: typeof import('../../src/core/sessions.js').closeDb;
let getSessionsDbPath: typeof import('../../src/core/store.js').getSessionsDbPath;

beforeAll(async () => {
  tmp = setTmpConfigDir();
  ({ recordSession, listAllSessions, listSessionsSince, closeDb } = await import('../../src/core/sessions.js'));
  ({ getSessionsDbPath } = await import('../../src/core/store.js'));
});

afterAll(() => {
  // close the sqlite handle first — Windows can't delete the dir while it's open
  closeDb();
  tmp.cleanup();
});

beforeEach(() => {
  // ensure DB is initialized at least once so the file exists
  listAllSessions();
  const cleaner = new Database(getSessionsDbPath());
  cleaner.exec('DELETE FROM sessions');
  cleaner.close();
});

function newSession(overrides: Partial<Parameters<typeof recordSession>[0]> = {}) {
  const now = new Date();
  return {
    profileId: null,
    profileName: 'test',
    startedAt: now.toISOString(),
    endedAt: now.toISOString(),
    plannedMs: 25 * 60_000,
    actualMs: 25 * 60_000,
    status: 'completed' as const,
    ...overrides,
  };
}

describe('sessions store', () => {
  it('creates the sessions table on first access', () => {
    expect(listAllSessions()).toEqual([]);
  });

  it('uses WAL journal mode', () => {
    listAllSessions(); // ensure init
    const probe = new Database(getSessionsDbPath());
    const mode = probe.pragma('journal_mode', { simple: true });
    probe.close();
    expect(mode).toBe('wal');
  });

  it('records a session and returns it with a generated id', () => {
    const created = recordSession(newSession({ profileName: 'social' }));
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.profileName).toBe('social');
    const all = listAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(created.id);
  });

  it('persists both completed and cancelled statuses', () => {
    recordSession(newSession({ status: 'completed' }));
    recordSession(newSession({ status: 'cancelled' }));
    const all = listAllSessions();
    expect(all.map((s) => s.status).sort()).toEqual(['cancelled', 'completed']);
  });

  it('listSessionsSince filters by startedAt', () => {
    const old = new Date(2026, 0, 1).toISOString();
    const recent = new Date(2026, 4, 1).toISOString();
    recordSession(newSession({ startedAt: old, endedAt: old }));
    recordSession(newSession({ startedAt: recent, endedAt: recent }));
    const sinceFeb = listSessionsSince(new Date(2026, 1, 1));
    expect(sinceFeb).toHaveLength(1);
    expect(sinceFeb[0]?.startedAt).toBe(recent);
  });

  it('round-trips all numeric fields without coercion loss', () => {
    const created = recordSession(newSession({ plannedMs: 1500_000, actualMs: 1234_567 }));
    const fetched = listAllSessions().find((s) => s.id === created.id);
    expect(fetched?.plannedMs).toBe(1500_000);
    expect(fetched?.actualMs).toBe(1234_567);
  });
});
