import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { getSessionsDbPath } from './store.js';

export type SessionStatus = 'completed' | 'cancelled';

export interface Session {
  id: string;
  profileId: string | null;
  profileName: string;
  startedAt: string;
  endedAt: string;
  plannedMs: number;
  actualMs: number;
  status: SessionStatus;
}

export interface NewSession {
  profileId: string | null;
  profileName: string;
  startedAt: string;
  endedAt: string;
  plannedMs: number;
  actualMs: number;
  status: SessionStatus;
}

interface Row {
  id: string;
  profile_id: string | null;
  profile_name: string;
  started_at: string;
  ended_at: string;
  planned_ms: number;
  actual_ms: number;
  status: SessionStatus;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const conn = new Database(getSessionsDbPath());
  conn.pragma('journal_mode = WAL');
  conn.exec(`
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
  db = conn;
  return conn;
}

function rowToSession(r: Row): Session {
  return {
    id: r.id,
    profileId: r.profile_id,
    profileName: r.profile_name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    plannedMs: r.planned_ms,
    actualMs: r.actual_ms,
    status: r.status,
  };
}

export function recordSession(s: NewSession): Session {
  const id = randomUUID();
  const stmt = getDb().prepare(`
    INSERT INTO sessions
      (id, profile_id, profile_name, started_at, ended_at, planned_ms, actual_ms, status)
    VALUES
      (@id, @profile_id, @profile_name, @started_at, @ended_at, @planned_ms, @actual_ms, @status)
  `);
  stmt.run({
    id,
    profile_id: s.profileId,
    profile_name: s.profileName,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    planned_ms: s.plannedMs,
    actual_ms: s.actualMs,
    status: s.status,
  });
  return { id, ...s };
}

export function listSessionsSince(since: Date): Session[] {
  const stmt = getDb().prepare(
    'SELECT * FROM sessions WHERE started_at >= ? ORDER BY started_at ASC',
  );
  const rows = stmt.all(since.toISOString()) as Row[];
  return rows.map(rowToSession);
}

export function listAllSessions(): Session[] {
  const rows = getDb()
    .prepare('SELECT * FROM sessions ORDER BY started_at ASC')
    .all() as Row[];
  return rows.map(rowToSession);
}
