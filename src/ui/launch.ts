import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { recoverFocus } from '../core/focus.js';
import { getPlatform } from '../core/platform.js';
import { isElevated } from '../core/privileges.js';
import { grantHostsWriteAccess } from '../core/install.js';

export async function launchTui(): Promise<void> {
  await maybeFirstRunSetup();
  const recovered = await recoverFocus();
  const resumedFocus = recovered
    ? { profileName: recovered.profileName, endsAt: recovered.endsAt }
    : null;
  const { waitUntilExit } = render(React.createElement(App, { resumedFocus }), {
    exitOnCtrlC: false,
  });
  await waitUntilExit();
}

async function maybeFirstRunSetup(): Promise<void> {
  if (process.env.LOCUS_HOSTS_PATH) return;
  if (getPlatform() !== 'wsl') return;
  if (await isElevated()) return;

  console.log('first-run setup: requesting admin to grant hosts file access...');
  const result = await grantHostsWriteAccess();
  if (result.ok) return;
  if (result.reason === 'declined') {
    console.log("skipped — read-only mode (run 'locus setup' later to enable blocking)");
  } else if (result.reason === 'failed') {
    console.log(`setup failed: ${result.detail ?? 'unknown error'}`);
    console.log("continuing in read-only mode — run 'locus setup' to retry");
  }
}
