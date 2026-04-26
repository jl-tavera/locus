import {
  type ActiveFocus,
  clearActiveFocus,
  findProfileById,
  findProfileByName,
  getActiveFocus,
  listSites,
  setActiveFocus,
} from './store.js';
import { getProfileHostnames } from './profiles.js';
import { clearBlock, writeBlock } from './hosts.js';
import { flushDns } from './dns.js';
import { cycleBrowsers } from './browsers.js';
import { recordSession, type SessionStatus } from './sessions.js';

export const ALL_SITES_LABEL = 'all sites';

export interface FocusStartResult {
  endsAt: Date;
  profileName: string;
}

export interface RecoveredFocus {
  profileId: string | null;
  profileName: string;
  endsAt: Date;
  remainingMs: number;
}

export async function startFocus(
  profileName: string | null,
  durationMs: number,
): Promise<FocusStartResult> {
  if (durationMs <= 0) throw new Error('duration must be greater than zero');
  const existing = getActiveFocus();
  if (existing && new Date(existing.endsAt).getTime() > Date.now()) {
    throw new Error('a focus session is already active. end it first.');
  }

  let hostnames: string[];
  let profileId: string | null;
  let displayName: string;
  if (profileName === null) {
    hostnames = listSites().map((s) => s.url);
    if (hostnames.length === 0) {
      throw new Error('no sites in library. add some first.');
    }
    profileId = null;
    displayName = ALL_SITES_LABEL;
  } else {
    hostnames = getProfileHostnames(profileName);
    if (hostnames.length === 0) {
      throw new Error(`profile "${profileName}" has no sites`);
    }
    const profile = findProfileByName(profileName);
    if (!profile) throw new Error(`profile "${profileName}" not found`);
    profileId = profile.id;
    displayName = profile.name;
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + durationMs);

  await writeBlock(hostnames);
  await flushDns();
  await cycleBrowsers();

  const focus: ActiveFocus = {
    profileId,
    startedAt: startedAt.toISOString(),
    durationMs,
    endsAt: endsAt.toISOString(),
  };
  setActiveFocus(focus);
  return { endsAt, profileName: displayName };
}

export async function endFocus(status: SessionStatus = 'completed'): Promise<void> {
  const focus = getActiveFocus();
  if (focus) {
    const endedAt = new Date();
    const startedAtMs = new Date(focus.startedAt).getTime();
    const profileName =
      focus.profileId === null
        ? ALL_SITES_LABEL
        : findProfileById(focus.profileId)?.name ?? '(deleted profile)';
    try {
      recordSession({
        profileId: focus.profileId,
        profileName,
        startedAt: focus.startedAt,
        endedAt: endedAt.toISOString(),
        plannedMs: focus.durationMs,
        actualMs: Math.max(0, endedAt.getTime() - startedAtMs),
        status,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`warning: failed to record session (${msg})`);
    }
  }
  await clearBlock();
  await flushDns();
  clearActiveFocus();
}

export function peekActiveFocus(): { profileName: string; endsAt: Date } | null {
  const focus = getActiveFocus();
  if (!focus) return null;
  const endsAt = new Date(focus.endsAt);
  if (endsAt.getTime() <= Date.now()) return null;
  const profileName =
    focus.profileId === null
      ? ALL_SITES_LABEL
      : findProfileById(focus.profileId)?.name ?? '(deleted profile)';
  return { profileName, endsAt };
}

export async function recoverFocus(): Promise<RecoveredFocus | null> {
  const focus = getActiveFocus();
  if (!focus) return null;
  const endsAt = new Date(focus.endsAt);
  if (endsAt.getTime() <= Date.now()) {
    await endFocus('completed');
    return null;
  }
  if (focus.profileId === null) {
    return {
      profileId: null,
      profileName: ALL_SITES_LABEL,
      endsAt,
      remainingMs: endsAt.getTime() - Date.now(),
    };
  }
  const profile = findProfileById(focus.profileId);
  return {
    profileId: focus.profileId,
    profileName: profile?.name ?? '(deleted profile)',
    endsAt,
    remainingMs: endsAt.getTime() - Date.now(),
  };
}
