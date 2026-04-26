import React, { useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import { Dashboard } from './screens/Dashboard.js';
import { Sites } from './screens/Sites.js';
import { Profiles } from './screens/Profiles.js';
import { Focus } from './screens/Focus.js';
import { Status } from './screens/Status.js';
import { Streak } from './screens/Streak.js';
import { Logo } from './components/Logo.js';
import { peekActiveFocus } from '../core/focus.js';

export type ScreenName = 'dashboard' | 'sites' | 'profiles' | 'focus' | 'status' | 'streak' | 'quit';

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
      ) : screen === 'focus' ? (
        <Focus
          resumed={peekActiveFocus() ?? resumedFocus ?? undefined}
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
