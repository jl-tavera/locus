import type { Session } from './sessions.js';

export interface DayCell {
  date: string;
  inRange: boolean;
  minutes: number;
  sessions: number;
  bucket: 0 | 1 | 2 | 3 | 4;
}

export interface MonthLabel {
  col: number;
  label: string;
}

export interface CalendarData {
  weeks: DayCell[][];
  monthLabels: MonthLabel[];
  totalSessions: number;
  totalMinutes: number;
  busiestDay: { date: string; sessions: number; minutes: number } | null;
}

const WEEKS = 53;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeekSunday(d: Date): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function quartiles(sortedAsc: number[]): { q1: number; q2: number; q3: number } {
  const n = sortedAsc.length;
  const at = (p: number) => sortedAsc[Math.min(n - 1, Math.floor(p * n))]!;
  return { q1: at(0.25), q2: at(0.5), q3: at(0.75) };
}

function bucketize(minutes: number, q: { q1: number; q2: number; q3: number }): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes <= q.q1) return 1;
  if (minutes <= q.q2) return 2;
  if (minutes <= q.q3) return 3;
  return 4;
}

export function buildCalendar(sessions: Session[], today: Date): CalendarData {
  const todayStart = startOfDay(today);
  const lastSunday = startOfWeekSunday(today);
  const firstSunday = addDays(lastSunday, -(WEEKS - 1) * 7);

  const dayMap = new Map<string, { minutes: number; sessions: number }>();
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const day = startOfDay(new Date(s.startedAt));
    if (day.getTime() < firstSunday.getTime() || day.getTime() > todayStart.getTime()) continue;
    const key = toDateKey(day);
    const entry = dayMap.get(key) ?? { minutes: 0, sessions: 0 };
    entry.minutes += s.actualMs / 60000;
    entry.sessions += 1;
    dayMap.set(key, entry);
  }

  const distinctMinutes = [...new Set([...dayMap.values()].map((v) => v.minutes).filter((m) => m > 0))].sort(
    (a, b) => a - b,
  );
  const q = distinctMinutes.length >= 4 ? quartiles(distinctMinutes) : { q1: 1, q2: 2, q3: 3 };

  const weeks: DayCell[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: DayCell[] = [];
    for (let row = 0; row < 7; row++) {
      const cellDate = addDays(firstSunday, w * 7 + row);
      const inRange = cellDate.getTime() <= todayStart.getTime();
      const key = toDateKey(cellDate);
      const data = inRange ? dayMap.get(key) : undefined;
      col.push({
        date: key,
        inRange,
        minutes: data?.minutes ?? 0,
        sessions: data?.sessions ?? 0,
        bucket: data ? bucketize(data.minutes, q) : 0,
      });
    }
    weeks.push(col);
  }

  const monthLabels: MonthLabel[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const sundayKey = weeks[w]![0]!.date;
    const m = parseInt(sundayKey.slice(5, 7), 10) - 1;
    if (m !== lastMonth) {
      monthLabels.push({ col: w, label: MONTHS[m]! });
      lastMonth = m;
    }
  }

  let totalSessions = 0;
  let totalMinutes = 0;
  let busiestDay: CalendarData['busiestDay'] = null;
  for (const [date, v] of dayMap) {
    totalSessions += v.sessions;
    totalMinutes += v.minutes;
    if (
      !busiestDay ||
      v.minutes > busiestDay.minutes ||
      (v.minutes === busiestDay.minutes && v.sessions > busiestDay.sessions)
    ) {
      busiestDay = { date, sessions: v.sessions, minutes: v.minutes };
    }
  }

  return { weeks, monthLabels, totalSessions, totalMinutes, busiestDay };
}
