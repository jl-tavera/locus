import React, { useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import { Dashboard } from './screens/Dashboard.js';
import { Sites } from './screens/Sites.js';
import { Profiles } from './screens/Profiles.js';
import { Focus } from './screens/Focus.js';
import { Status } from './screens/Status.js';

export type ScreenName = 'dashboard' | 'sites' | 'profiles' | 'focus' | 'status' | 'quit';

interface AppProps {
  resumedFocus?: { profileName: string; endsAt: Date } | null;
}

export function App({ resumedFocus }: AppProps): React.JSX.Element {
  const { exit } = useApp();
  const [screen, setScreen] = useState<ScreenName>(resumedFocus ? 'focus' : 'dashboard');

  useInput((input, key) => {
    if (key.escape && screen !== 'dashboard') {
      setScreen('dashboard');
    } else if ((input === 'q' || (key.ctrl && input === 'c')) && screen === 'dashboard') {
      exit();
    }
  });

  if (screen === 'quit') {
    exit();
    return <Box />;
  }

  return (
    <Box>
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
      ) : screen === 'focus' ? (
        <Focus
          resumed={resumedFocus ?? undefined}
          onExit={() => setScreen('dashboard')}
        />
      ) : (
        <Status />
      )}
    </Box>
  );
}
