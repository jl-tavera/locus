import { applyLock, recover } from '../core/lock.js';
import { isElevated } from '../core/privileges.js';

/**
 * Entry point for the permanent `locus-guard` scheduled task (at logon, then
 * every few minutes). It is the backstop for a one-shot `locus-relock` that
 * never landed — killed mid-flight, missed while the machine slept, or
 * unregistered. Without it a lost re-lock leaves the sites open indefinitely,
 * because the only other backstop (`recover()`) runs solely when you open locus.
 *
 * Deliberately NOT `relock()`: that ends *any* unlock, including a live one, so
 * running it on a timer would cut every unlock short. `recover()` leaves a live
 * window alone and re-locks only once it has expired.
 *
 * Silent on the happy path — this runs unattended every few minutes, so only
 * failures are worth writing out.
 */
export async function runGuard(): Promise<void> {
  // Not requireElevated(): a tick that can't write should report and return, not
  // process.exit(1), so the task doesn't sit in a failed state forever.
  if (!process.env.LOCUS_HOSTS_PATH && !(await isElevated())) {
    console.error('locus guard: hosts file is not writable — run  locus setup');
    return;
  }

  // main() already ran recover(); this second call is a cheap read of the
  // reconciled state, and it tells us whether the lock is actually enforced.
  const state = await recover();
  if (!state.enforced) {
    console.error('locus guard: could not re-apply the block — retrying next tick');
    return;
  }
  if (state.state === 'unlocked') return;

  // recover() only writes the block when it finds an *expired* window, so
  // re-assert it here: that heals a hosts file that was edited or wiped by
  // something other than locus. applyLock() is idempotent — it returns early
  // when the active block already matches the locked set.
  await applyLock();
}
