import type { Session } from './sessions.js';
import { addDays, startOfDay, toDateKey } from './calendar.js';

export interface StreakInfo {
  current: number;
  longest: number;
}

export function computeStreaks(sessions: Session[], today: Date): StreakInfo {
  const days = new Set<string>();
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    days.add(toDateKey(startOfDay(new Date(s.startedAt))));
  }

  let cursor = startOfDay(today);
  if (!days.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }
  let current = 0;
  while (days.has(toDateKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prevKey: string | null = null;
  for (const key of sorted) {
    if (prevKey !== null) {
      const [y, m, d] = prevKey.split('-').map(Number);
      const expected = toDateKey(addDays(new Date(y!, m! - 1, d!), 1));
      run = expected === key ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prevKey = key;
  }

  return { current, longest };
}
