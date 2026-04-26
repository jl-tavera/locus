import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Heading } from '../components/Heading.js';
import { CountdownTimer } from '../components/CountdownTimer.js';

interface FocusRunnerProps {
  profileName: string;
  endsAt: Date;
  onCleanup: () => Promise<void>;
}

type State = 'running' | 'confirming' | 'completing' | 'done';

export function FocusRunner({
  profileName,
  endsAt,
  onCleanup,
}: FocusRunnerProps): React.JSX.Element {
  const { exit } = useApp();
  const [state, setState] = useState<State>('running');
  const [totalMs] = useState<number>(() => Math.max(1, endsAt.getTime() - Date.now()));

  const cleanupAndExit = async (reason: 'completed' | 'cancelled') => {
    setState(reason === 'completed' ? 'completing' : 'done');
    try {
      await onCleanup();
    } catch {
      // best-effort cleanup
    }
    if (reason === 'completed') {
      setTimeout(() => {
        setState('done');
        exit();
      }, 1500);
    } else {
      exit();
    }
  };

  useInput((input, key) => {
    if (state === 'running' && key.ctrl && input === 'c') {
      setState('confirming');
      return;
    }
    if (state === 'confirming') {
      if (input.toLowerCase() === 'y') {
        void cleanupAndExit('cancelled');
      } else if (key.escape || input.toLowerCase() === 'n' || (key.ctrl && input === 'c')) {
        setState('running');
      }
    }
  });

  useEffect(() => {
    const handler = () => setState((s) => (s === 'running' ? 'confirming' : s));
    process.on('SIGINT', handler);
    return () => {
      process.off('SIGINT', handler);
    };
  }, []);

  const onComplete = () => {
    if (state === 'running') void cleanupAndExit('completed');
  };

  return (
    <Box flexDirection="column" alignItems="center" paddingX={4} paddingY={2}>
      <Heading>focus</Heading>
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>profile: {profileName}</Text>
      </Box>
      {state === 'completing' || state === 'done' ? (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text bold>focus complete</Text>
          <Box marginTop={1}>
            <Text dimColor>hosts unblocked · dns flushed</Text>
          </Box>
        </Box>
      ) : (
        <CountdownTimer endsAt={endsAt} totalMs={totalMs} onComplete={onComplete} />
      )}
      <Box marginTop={2}>
        {state === 'confirming' ? (
          <Text bold>end focus early? (y/N)</Text>
        ) : state === 'running' ? (
          <Text dimColor>ctrl-c to end early</Text>
        ) : null}
      </Box>
    </Box>
  );
}
