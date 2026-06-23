import { getActiveBlock } from '../core/hosts.js';
import { getActiveUnlock } from '../core/store.js';
import { getLockLabel, getLockHostnames } from '../core/lock.js';
import { formatRemaining } from '../utils/duration.js';

export async function runStatus(): Promise<void> {
  const blocked = await getActiveBlock();
  const unlock = getActiveUnlock();
  const remaining = unlock ? new Date(unlock.endsAt).getTime() - Date.now() : 0;

  console.log('— status —');
  if (unlock && remaining > 0) {
    console.log(`unlocked: ${getLockLabel()} · ${formatRemaining(remaining)} until re-lock`);
  } else if (blocked.length > 0) {
    console.log(`locked: ${getLockLabel()} (${blocked.length} site${blocked.length === 1 ? '' : 's'})`);
    for (const host of blocked) console.log(`  · ${host}`);
  } else {
    const count = getLockHostnames().length;
    if (count === 0) {
      console.log('locked: nothing yet — add sites, then run locus lock');
    } else {
      console.log('locked: inactive — run locus lock to block the set');
    }
  }
}
