import { grantHostsWriteAccess } from '../core/install.js';
import { registerGuardTask } from '../core/scheduler.js';

// Install (or refresh) the background watchdog. Separate from the hosts grant so
// an existing user re-running `locus setup` picks it up even when the grant is
// already in place. Best-effort — never fail setup over it.
async function installGuard(): Promise<void> {
  const guard = await registerGuardTask();
  if (guard.ok) {
    console.log('background guard installed — locus re-locks itself even if the app is closed.');
  } else if (guard.detail && guard.detail !== 'scheduling disabled') {
    console.error(`warning: could not install the background guard: ${guard.detail}`);
  }
}

export async function runSetup(): Promise<void> {
  const result = await grantHostsWriteAccess();

  if (result.ok && result.reason === 'already-writable') {
    console.log('already set up — nothing to do.');
    await installGuard();
    return;
  }
  if (result.ok) {
    console.log('setup complete. you can now run locus from any terminal.');
    await installGuard();
    return;
  }

  switch (result.reason) {
    case 'not-windows':
      console.log('setup is only needed on Windows — nothing to do.');
      return;
    case 'declined':
      console.error('cancelled. (UAC prompt was declined.)');
      process.exit(1);
    case 'failed':
    default:
      console.error(`setup failed: ${result.detail ?? 'unknown error'}`);
      process.exit(1);
  }
}
