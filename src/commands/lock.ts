import { findProfileByName } from '../core/store.js';
import { ALL_SITES_LABEL, applyLock, getLockHostnames, getLockLabel, setLockProfile } from '../core/lock.js';
import { requireElevated } from '../core/privileges.js';

// `locus lock` re-asserts the current locked set; `locus lock <profile>` (or
// `locus lock all`) changes which set is always blocked, then applies it.
export async function runLock(profileName?: string): Promise<void> {
  await requireElevated();

  if (profileName !== undefined) {
    const lower = profileName.toLowerCase();
    if (lower === 'all' || lower === ALL_SITES_LABEL) {
      await setLockProfile(null);
    } else {
      const profile = findProfileByName(profileName);
      if (!profile) throw new Error(`profile "${profileName}" not found`);
      await setLockProfile(profile.id);
    }
  } else {
    await applyLock();
  }

  const count = getLockHostnames().length;
  if (count === 0) {
    console.log('nothing to lock — add sites to your library first.');
    return;
  }
  console.log(`locked: ${getLockLabel()} · ${count} site${count === 1 ? '' : 's'}`);
}
