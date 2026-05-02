import { describe, it, expect } from 'vitest';
import { computeStreaks } from '../../src/core/streak.js';
import type { Session, SessionStatus } from '../../src/core/sessions.js';

function session(daysAgo: number, status: SessionStatus, today: Date): Session {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(10, 0, 0, 0);
  return {
    id: `id-${daysAgo}-${status}`,
    profileId: null,
    profileName: 'test',
    startedAt: d.toISOString(),
    endedAt: d.toISOString(),
    plannedMs: 25 * 60_000,
    actualMs: 25 * 60_000,
    status,
  };
}

describe('computeStreaks', () => {
  const today = new Date(2026, 4, 2); // 2026-05-02 (local time)

  it('returns 0/0 for empty input', () => {
    expect(computeStreaks([], today)).toEqual({ current: 0, longest: 0 });
  });

  it('ignores cancelled sessions', () => {
    const sessions = [
      session(0, 'cancelled', today),
      session(1, 'cancelled', today),
    ];
    expect(computeStreaks(sessions, today)).toEqual({ current: 0, longest: 0 });
  });

  it('counts a single completed session today as 1/1', () => {
    expect(computeStreaks([session(0, 'completed', today)], today)).toEqual({
      current: 1,
      longest: 1,
    });
  });

  it('builds a streak across consecutive days ending today', () => {
    const sessions = [0, 1, 2, 3].map((d) => session(d, 'completed', today));
    expect(computeStreaks(sessions, today)).toEqual({ current: 4, longest: 4 });
  });

  it('considers yesterday-only as still current (today not yet logged)', () => {
    const sessions = [1, 2, 3].map((d) => session(d, 'completed', today));
    expect(computeStreaks(sessions, today)).toEqual({ current: 3, longest: 3 });
  });

  it('breaks current when neither today nor yesterday has a session', () => {
    const sessions = [3, 4, 5].map((d) => session(d, 'completed', today));
    const result = computeStreaks(sessions, today);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(3);
  });

  it('preserves longest across a gap', () => {
    const sessions = [
      ...[0, 1].map((d) => session(d, 'completed', today)),
      ...[5, 6, 7, 8, 9].map((d) => session(d, 'completed', today)),
    ];
    const result = computeStreaks(sessions, today);
    expect(result.current).toBe(2);
    expect(result.longest).toBe(5);
  });

  it('dedupes multiple sessions on the same day', () => {
    const d = session(0, 'completed', today);
    const dupe: Session = { ...d, id: 'other' };
    expect(computeStreaks([d, dupe], today)).toEqual({ current: 1, longest: 1 });
  });
});
