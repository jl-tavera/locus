import { getActiveBlock } from '../core/hosts.js';
import { findProfileById, getActiveFocus } from '../core/store.js';
import { ALL_SITES_LABEL } from '../core/focus.js';
import { formatRemaining } from '../utils/duration.js';

export async function runStatus(): Promise<void> {
  const blocked = await getActiveBlock();
  const focus = getActiveFocus();

  console.log('— status —');
  if (blocked.length === 0) {
    console.log('block: inactive');
  } else {
    console.log(`block: active (${blocked.length} site${blocked.length === 1 ? '' : 's'})`);
    for (const host of blocked) console.log(`  · ${host}`);
  }

  if (!focus) {
    console.log('focus: inactive');
    return;
  }
  const remaining = new Date(focus.endsAt).getTime() - Date.now();
  if (remaining <= 0) {
    console.log('focus: expired (will auto-clean on next command)');
    return;
  }
  const label =
    focus.profileId === null
      ? ALL_SITES_LABEL
      : findProfileById(focus.profileId)?.name ?? '(deleted profile)';
  console.log(`focus: ${label} · ${formatRemaining(remaining)} remaining`);
}
