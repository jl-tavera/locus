import { getActiveBlock } from '../core/hosts.js';
import { getActiveUnlock } from '../core/store.js';
import { getLockLabel, getLockHostnames } from '../core/lock.js';
import { checkGuardHealth } from '../core/scheduler.js';
import { getPlatform } from '../core/platform.js';
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

  // The guard is what re-locks you when the app is closed. If it's missing — or
  // installed but no longer running — an unlock that outlives its terminal never
  // gets re-locked. Say so here; there is nowhere else the user would find out.
  if (getPlatform() === 'win32' && !process.env.LOCUS_HOSTS_PATH) {
    const guard = await checkGuardHealth();
    if (guard.state === 'missing') {
      console.log('guard: not installed — run locus setup (auto re-lock is not guaranteed)');
    } else if (guard.state === 'stale') {
      const when = guard.lastRun ? guard.lastRun.toLocaleString() : 'never';
      console.log(
        `guard: installed but has not run since ${when} — run locus setup (auto re-lock is not guaranteed)`,
      );
    }
  }
}
