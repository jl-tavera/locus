import React from 'react';
import { render } from 'ink';
import { Streak } from '../ui/screens/Streak.js';

export async function runStreak(): Promise<void> {
  const { waitUntilExit } = render(React.createElement(Streak, { cliMode: true }), {
    exitOnCtrlC: true,
  });
  await waitUntilExit();
}
