import {
  type UnlockWindow,
  clearActiveUnlock,
  findProfileById,
  getActiveUnlock,
  getLockProfileId,
  listSites,
  setActiveUnlock,
  setLockProfileId,
} from './store.js';
import { getProfileHostnames } from './profiles.js';
import { clearBlock, getActiveBlock, writeBlock } from './hosts.js';
import { flushDns } from './dns.js';
import { cycleBrowsers } from './browsers.js';
import { recordSession, type SessionStatus } from './sessions.js';
import { cancelRelock, scheduleRelock } from './scheduler.js';

export const ALL_SITES_LABEL = 'all sites';

// Allowed unlock durations, in minutes — the user picks one (max 30).
export const UNLOCK_OPTIONS_MIN = [5, 10, 15, 30] as const;
const MAX_UNLOCK_MS = 30 * 60_000;

export type LockState = 'locked' | 'unlocked';

export interface RecoverResult {
  state: LockState;
  endsAt?: Date;
  remainingMs?: number;
}

/** Human label for whatever is currently the locked set. */
export function getLockLabel(): string {
  const id = getLockProfileId();
  if (id === null) return ALL_SITES_LABEL;
  return findProfileById(id)?.name ?? ALL_SITES_LABEL;
}

/** Hostnames of the always-locked set (the whole library, or one profile). */
export function getLockHostnames(): string[] {
  const id = getLockProfileId();
  if (id === null) return listSites().map((s) => s.url);
  const profile = findProfileById(id);
  if (!profile) return listSites().map((s) => s.url);
  return getProfileHostnames(profile.name);
}

/**
 * (Re)assert the persistent block so the locked set is blocked by default.
 * Idempotent: only rewrites the hosts file when the active block differs from
 * the desired set, to avoid needless writes/backups.
 */
export async function applyLock(): Promise<void> {
  const desired = getLockHostnames();
  if (desired.length === 0) {
    // nothing to lock — make sure no stale block lingers
    await clearBlock();
    await flushDns();
    return;
  }
  const current = await getActiveBlock();
  const want = [...new Set(desired)].sort();
  const have = [...current].sort();
  if (want.length === have.length && want.every((h, i) => h === have[i])) return;
  await writeBlock(desired);
  await flushDns();
}

/** Choose which profile (or all sites, via null) is the always-locked set. */
export async function setLockProfile(profileId: string | null): Promise<void> {
  setLockProfileId(profileId);
  if (!getActiveUnlock()) await applyLock();
}

/**
 * Open the locked sites for `durationMs`, then schedule an automatic re-lock.
 * The challenge gate is enforced by the caller (UI) before this runs.
 */
export async function startUnlock(durationMs: number): Promise<{ endsAt: Date }> {
  if (durationMs <= 0) throw new Error('duration must be greater than zero');
  if (durationMs > MAX_UNLOCK_MS) throw new Error('unlock is capped at 30 minutes');
  const existing = getActiveUnlock();
  if (existing && new Date(existing.endsAt).getTime() > Date.now()) {
    throw new Error('already unlocked. re-lock first.');
  }
  if (getLockHostnames().length === 0) {
    throw new Error('nothing is locked. add sites first.');
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + durationMs);

  await clearBlock();
  await flushDns();

  const window: UnlockWindow = {
    profileId: getLockProfileId(),
    startedAt: startedAt.toISOString(),
    durationMs,
    endsAt: endsAt.toISOString(),
  };
  setActiveUnlock(window);
  await scheduleRelock(endsAt);
  return { endsAt };
}

/** Re-lock now, recording the unlock as a session, and clear the scheduled task. */
export async function endUnlock(status: SessionStatus = 'completed'): Promise<void> {
  const window = getActiveUnlock();
  if (window) {
    const endedAt = new Date();
    const startedAtMs = new Date(window.startedAt).getTime();
    const profileName =
      window.profileId === null
        ? ALL_SITES_LABEL
        : findProfileById(window.profileId)?.name ?? '(deleted profile)';
    try {
      recordSession({
        profileId: window.profileId,
        profileName,
        startedAt: window.startedAt,
        endedAt: endedAt.toISOString(),
        plannedMs: window.durationMs,
        actualMs: Math.max(0, endedAt.getTime() - startedAtMs),
        status,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`warning: failed to record unlock (${msg})`);
    }
  }
  await applyLock();
  // Restart Brave (Windows) so it drops its cached resolution and the re-blocked
  // site stops loading immediately — symmetric with the restart in startUnlock.
  await cycleBrowsers();
  clearActiveUnlock();
  await cancelRelock();
}

/** Entry point for the scheduled task / `locus relock`: re-lock if needed. */
export async function relock(): Promise<void> {
  if (getActiveUnlock()) {
    await endUnlock('completed');
  } else {
    await applyLock();
    await cancelRelock();
  }
}

/** Non-destructive check for a live unlock window. */
export function peekActiveUnlock(): { endsAt: Date } | null {
  const window = getActiveUnlock();
  if (!window) return null;
  const endsAt = new Date(window.endsAt);
  if (endsAt.getTime() <= Date.now()) return null;
  return { endsAt };
}

/**
 * Startup reconciliation. Runs at the top of the CLI and the TUI:
 * - an expired unlock → re-lock immediately
 * - a live unlock → report remaining time so the TUI can resume the countdown
 * - otherwise → locked (the persistent block is already in the hosts file)
 */
export async function recover(): Promise<RecoverResult> {
  const window = getActiveUnlock();
  if (!window) return { state: 'locked' };
  const endsAt = new Date(window.endsAt);
  if (endsAt.getTime() <= Date.now()) {
    try {
      await endUnlock('completed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`warning: failed to re-lock expired unlock (${msg})`);
    }
    return { state: 'locked' };
  }
  return { state: 'unlocked', endsAt, remainingMs: endsAt.getTime() - Date.now() };
}
