import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { applyLock, recover } from '../core/lock.js';
import { getPlatform } from '../core/platform.js';
import { isElevated } from '../core/privileges.js';
import { grantHostsWriteAccess } from '../core/install.js';

export async function launchTui(): Promise<void> {
  await maybeFirstRunSetup();
  const recovered = await recover();

  // Re-assert the locked-by-default state whenever the app opens (unless we're
  // mid-unlock). Best-effort: don't block the TUI if the grant is missing.
  if (recovered.state === 'locked') {
    try {
      await applyLock();
    } catch {
      // hosts not writable yet — status screen will show it's not enforced
    }
  }

  const resumedUnlock =
    recovered.state === 'unlocked' && recovered.endsAt ? { endsAt: recovered.endsAt } : null;
  const { waitUntilExit } = render(React.createElement(App, { resumedUnlock }), {
    exitOnCtrlC: false,
  });
  await waitUntilExit();
}

async function maybeFirstRunSetup(): Promise<void> {
  if (process.env.LOCUS_HOSTS_PATH) return;
  if (getPlatform() !== 'win32') return;
  if (await isElevated()) return;

  console.log('first-run setup: requesting admin to grant hosts file access...');
  const result = await grantHostsWriteAccess();
  if (result.ok) return;
  if (result.reason === 'declined') {
    console.log("skipped — read-only mode (run 'locus setup' later to enable locking)");
  } else if (result.reason === 'failed') {
    console.log(`setup failed: ${result.detail ?? 'unknown error'}`);
    console.log("continuing in read-only mode — run 'locus setup' to retry");
  }
}
