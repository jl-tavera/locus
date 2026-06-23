import { relock } from '../core/lock.js';
import { requireElevated } from '../core/privileges.js';

// Entry point for the scheduled task (and manual use): re-apply the block now,
// ending any active unlock window.
export async function runRelock(): Promise<void> {
  await requireElevated();
  await relock();
  console.log('re-locked.');
}
