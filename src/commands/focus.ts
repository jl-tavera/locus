import React from 'react';
import { render } from 'ink';
import { findProfileByName, getActiveFocus } from '../core/store.js';
import { parseDuration } from '../utils/duration.js';
import { startFocus, endFocus } from '../core/focus.js';
import { requireElevated } from '../core/privileges.js';
import { FocusRunner } from '../ui/screens/FocusRunner.js';

export async function runFocus(profileName: string, durationStr: string): Promise<void> {
  const profile = findProfileByName(profileName);
  if (!profile) throw new Error(`profile "${profileName}" not found`);
  if (profile.siteIds.length === 0) {
    throw new Error(`profile "${profileName}" has no sites`);
  }
  const existing = getActiveFocus();
  if (existing && new Date(existing.endsAt).getTime() > Date.now()) {
    throw new Error('a focus session is already active. run "locus unblock" to end it.');
  }
  const durationMs = parseDuration(durationStr);

  await requireElevated();
  const { endsAt } = await startFocus(profile.name, durationMs);

  const { waitUntilExit } = render(
    React.createElement(FocusRunner, {
      profileName: profile.name,
      endsAt,
      onCleanup: async (reason) => {
        await endFocus(reason);
      },
    }),
    { exitOnCtrlC: false },
  );
  await waitUntilExit();
}
