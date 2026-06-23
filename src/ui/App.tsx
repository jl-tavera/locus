import React, { useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import { Dashboard } from './screens/Dashboard.js';
import { Sites } from './screens/Sites.js';
import { Profiles } from './screens/Profiles.js';
import { Unlock } from './screens/Unlock.js';
import { Status } from './screens/Status.js';
import { Streak } from './screens/Streak.js';
import { Logo } from './components/Logo.js';
import { peekActiveUnlock } from '../core/lock.js';

export type ScreenName = 'dashboard' | 'sites' | 'profiles' | 'unlock' | 'status' | 'streak' | 'quit';

interface AppProps {
  resumedUnlock?: { endsAt: Date } | null;
}

export function App({ resumedUnlock }: AppProps): React.JSX.Element {
  const { exit } = useApp();
  const [screen, setScreen] = useState<ScreenName>(resumedUnlock ? 'unlock' : 'dashboard');

  useInput((input, key) => {
    if (key.escape && screen !== 'dashboard') {
      const unlockRunning = screen === 'unlock' && peekActiveUnlock() !== null;
      if (!unlockRunning) setScreen('dashboard');
    } else if ((input === 'q' || (key.ctrl && input === 'c')) && screen === 'dashboard') {
      exit();
    }
  });

  if (screen === 'quit') {
    exit();
    return <Box />;
  }

  return (
    <Box flexDirection="column">
      <Box paddingX={2} paddingTop={1}>
        <Logo />
      </Box>
      {screen === 'dashboard' ? (
        <Dashboard
          onNavigate={(s) => {
            if (s === 'quit') exit();
            else setScreen(s);
          }}
        />
      ) : screen === 'sites' ? (
        <Sites />
      ) : screen === 'profiles' ? (
        <Profiles />
      ) : screen === 'unlock' ? (
        <Unlock
          resumed={peekActiveUnlock() ?? resumedUnlock ?? undefined}
          onExit={() => setScreen('dashboard')}
        />
      ) : screen === 'streak' ? (
        <Streak />
      ) : (
        <Status />
      )}
    </Box>
  );
}
