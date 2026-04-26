import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { recoverFocus } from '../core/focus.js';

export async function launchTui(): Promise<void> {
  const recovered = await recoverFocus();
  const resumedFocus = recovered
    ? { profileName: recovered.profileName, endsAt: recovered.endsAt }
    : null;
  const { waitUntilExit } = render(React.createElement(App, { resumedFocus }), {
    exitOnCtrlC: false,
  });
  await waitUntilExit();
}
