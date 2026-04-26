#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import Conf from 'conf';

const store = new Conf({ projectName: 'locus', projectSuffix: '', defaults: {} });
const dbPath = path.join(path.dirname(store.path), 'sessions.db');

const profiles = [
  { id: '83752ace-227c-47bc-834e-e15252486301', name: 'social media' },
  { id: null, name: 'deep work' },
  { id: null, name: 'writing' },
  { id: null, name: 'reading' },
];

const DURATION_PRESETS_MS = [
  25 * 60_000,
  30 * 60_000,
  45 * 60_000,
  50 * 60_000,
  60 * 60_000,
  90 * 60_000,
  120 * 60_000,
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(p) {
  return Math.random() < p;
}

function jitterStartHour(date, hour) {
  const d = new Date(date);
  d.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return d;
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    profile_id   TEXT,
    profile_name TEXT NOT NULL,
    started_at   TEXT NOT NULL,
    ended_at     TEXT NOT NULL,
    planned_ms   INTEGER NOT NULL,
    actual_ms    INTEGER NOT NULL,
    status       TEXT NOT NULL CHECK(status IN ('completed', 'cancelled'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
`);

const args = new Set(process.argv.slice(2));
if (args.has('--reset')) {
  db.exec('DELETE FROM sessions;');
  console.log('cleared existing sessions');
}

const insert = db.prepare(`
  INSERT INTO sessions
    (id, profile_id, profile_name, started_at, ended_at, planned_ms, actual_ms, status)
  VALUES
    (@id, @profile_id, @profile_name, @started_at, @ended_at, @planned_ms, @actual_ms, @status)
`);

const today = new Date();
today.setHours(0, 0, 0, 0);

const insertMany = db.transaction(() => {
  let count = 0;
  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const day = new Date(today);
    day.setDate(day.getDate() - daysAgo);
    const dow = day.getDay();
    const isWeekend = dow === 0 || dow === 6;

    const activeChance = isWeekend ? 0.35 : 0.78;
    if (!chance(activeChance)) continue;

    const sessionsToday = isWeekend
      ? pick([1, 1, 2])
      : pick([1, 2, 2, 3, 3, 4]);

    const slots = [9, 11, 14, 16, 19, 21];
    const usedHours = new Set();

    for (let i = 0; i < sessionsToday; i++) {
      let hour = pick(slots);
      let attempts = 0;
      while (usedHours.has(hour) && attempts < 6) {
        hour = pick(slots);
        attempts++;
      }
      usedHours.add(hour);

      const profile = pick(profiles);
      const plannedMs = pick(DURATION_PRESETS_MS);
      const startedAt = jitterStartHour(day, hour);

      const cancelled = chance(0.12);
      let actualMs;
      let status;
      if (cancelled) {
        actualMs = Math.floor(plannedMs * (0.1 + Math.random() * 0.6));
        status = 'cancelled';
      } else {
        actualMs = plannedMs + Math.floor((Math.random() - 0.4) * 60_000);
        if (actualMs < plannedMs - 30_000) actualMs = plannedMs;
        status = 'completed';
      }
      const endedAt = new Date(startedAt.getTime() + actualMs);

      insert.run({
        id: randomUUID(),
        profile_id: profile.id,
        profile_name: profile.name,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        planned_ms: plannedMs,
        actual_ms: actualMs,
        status,
      });
      count++;
    }
  }
  return count;
});

const inserted = insertMany();
const total = db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;
console.log(`inserted ${inserted} mock sessions into ${dbPath}`);
console.log(`total sessions in db: ${total}`);
db.close();
