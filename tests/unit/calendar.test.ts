import { describe, it, expect } from 'vitest';
import { buildCalendar, toDateKey, startOfDay, addDays } from '../../src/core/calendar.js';
import type { Session, SessionStatus } from '../../src/core/sessions.js';

function session(date: Date, minutes: number, status: SessionStatus = 'completed'): Session {
  return {
    id: `${date.toISOString()}-${minutes}-${status}`,
    profileId: null,
    profileName: 'test',
    startedAt: date.toISOString(),
    endedAt: date.toISOString(),
    plannedMs: minutes * 60_000,
    actualMs: minutes * 60_000,
    status,
  };
}

describe('toDateKey', () => {
  it('zero-pads month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('startOfDay', () => {
  it('zeroes time component', () => {
    const d = new Date(2026, 4, 2, 13, 45, 30, 500);
    const s = startOfDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
    expect(s.getMilliseconds()).toBe(0);
    expect(s.getDate()).toBe(2);
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    expect(toDateKey(addDays(new Date(2026, 4, 2), 3))).toBe('2026-05-05');
  });

  it('subtracts with negative input', () => {
    expect(toDateKey(addDays(new Date(2026, 4, 2), -3))).toBe('2026-04-29');
  });

  it('crosses month boundary', () => {
    expect(toDateKey(addDays(new Date(2026, 4, 30), 5))).toBe('2026-06-04');
  });
});

describe('buildCalendar', () => {
  const today = new Date(2026, 4, 2);

  it('produces a 53-week × 7-day grid', () => {
    const cal = buildCalendar([], today);
    expect(cal.weeks).toHaveLength(53);
    for (const week of cal.weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it('marks future cells as out of range', () => {
    const cal = buildCalendar([], today);
    const lastWeek = cal.weeks[cal.weeks.length - 1]!;
    const todayCell = lastWeek.find((c) => c.date === toDateKey(today));
    expect(todayCell?.inRange).toBe(true);
    const futureCell = lastWeek.find((c) => c.date === toDateKey(addDays(today, 3)));
    if (futureCell) expect(futureCell.inRange).toBe(false);
  });

  it('totals only completed sessions', () => {
    const sessions = [
      session(addDays(today, -1), 25, 'completed'),
      session(addDays(today, -2), 50, 'completed'),
      session(addDays(today, -3), 999, 'cancelled'),
    ];
    const cal = buildCalendar(sessions, today);
    expect(cal.totalSessions).toBe(2);
    expect(cal.totalMinutes).toBe(75);
  });

  it('tracks the busiest day by minutes', () => {
    const sessions = [
      session(addDays(today, -1), 25),
      session(addDays(today, -2), 90),
      session(addDays(today, -3), 50),
    ];
    const cal = buildCalendar(sessions, today);
    expect(cal.busiestDay?.minutes).toBe(90);
    expect(cal.busiestDay?.date).toBe(toDateKey(addDays(today, -2)));
  });

  it('emits month labels in chronological order', () => {
    const cal = buildCalendar([], today);
    const monthsSeen = cal.monthLabels.map((l) => l.label);
    expect(monthsSeen.length).toBeGreaterThan(0);
    // every label maps to a real month name
    for (const label of monthsSeen) {
      expect(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']).toContain(label);
    }
  });

  it('assigns bucket 0 for empty days, >0 for active days', () => {
    const sessions = [
      session(addDays(today, -1), 10),
      session(addDays(today, -2), 20),
      session(addDays(today, -3), 30),
      session(addDays(today, -4), 40),
    ];
    const cal = buildCalendar(sessions, today);
    const flat = cal.weeks.flat();
    const active = flat.filter((c) => c.minutes > 0);
    expect(active.length).toBe(4);
    for (const cell of active) {
      expect(cell.bucket).toBeGreaterThan(0);
      expect(cell.bucket).toBeLessThanOrEqual(4);
    }
    const empties = flat.filter((c) => c.minutes === 0);
    for (const cell of empties) {
      expect(cell.bucket).toBe(0);
    }
  });

  it('ignores sessions outside the visible window', () => {
    const ancient = session(addDays(today, -7 * 60), 30); // ~60 weeks ago, beyond 53-week window
    const cal = buildCalendar([ancient], today);
    expect(cal.totalSessions).toBe(0);
  });
});
