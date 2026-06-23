import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Heading } from '../components/Heading.js';
import { CountdownTimer } from '../components/CountdownTimer.js';

interface UnlockRunnerProps {
  label: string;
  endsAt: Date;
  onCleanup: (reason: 'completed' | 'cancelled') => Promise<void>;
}

type State = 'running' | 'relocking' | 'done';

export function UnlockRunner({ label, endsAt, onCleanup }: UnlockRunnerProps): React.JSX.Element {
  const { exit } = useApp();
  const [state, setState] = useState<State>('running');
  const [totalMs] = useState<number>(() => Math.max(1, endsAt.getTime() - Date.now()));

  const cleanupAndExit = async (reason: 'completed' | 'cancelled') => {
    setState('relocking');
    try {
      await onCleanup(reason);
    } catch {
      // best-effort
    }
    setState('done');
    setTimeout(() => exit(), reason === 'completed' ? 1500 : 0);
  };

  // Re-locking early is free — no challenge. It's the disciplined action.
  useInput((input, key) => {
    if (state === 'running' && key.ctrl && input === 'c') {
      void cleanupAndExit('cancelled');
    }
  });

  useEffect(() => {
    const handler = () => {
      if (state === 'running') void cleanupAndExit('cancelled');
    };
    process.on('SIGINT', handler);
    return () => {
      process.off('SIGINT', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onComplete = () => {
    if (state === 'running') void cleanupAndExit('completed');
  };

  return (
    <Box flexDirection="column" alignItems="center" width={64} paddingY={1}>
      <Heading>unlocked</Heading>
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>{label} · re-locks when the timer ends</Text>
      </Box>
      {state === 'relocking' || state === 'done' ? (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text bold>locked again</Text>
          <Box marginTop={1}>
            <Text dimColor>hosts re-blocked · dns flushed</Text>
          </Box>
        </Box>
      ) : (
        <CountdownTimer endsAt={endsAt} totalMs={totalMs} onComplete={onComplete} />
      )}
      <Box marginTop={2}>
        {state === 'running' ? <Text dimColor>ctrl-c to re-lock now</Text> : null}
      </Box>
    </Box>
  );
}
