import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Heading } from '../components/Heading.js';
import { getActiveBlock } from '../../core/hosts.js';
import { getActiveUnlock } from '../../core/store.js';
import { getLockLabel, getLockHostnames } from '../../core/lock.js';
import { formatRemaining } from '../../utils/duration.js';

export function Status(): React.JSX.Element {
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    void getActiveBlock().then((list) => {
      if (active) setBlocked(list);
    });
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const label = getLockLabel();
  const unlock = getActiveUnlock();
  const remainingMs = unlock ? new Date(unlock.endsAt).getTime() - Date.now() : 0;
  const unlocked = unlock !== null && remainingMs > 0;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Heading>status</Heading>
      <Box marginTop={1} flexDirection="column">
        {blocked === null ? (
          <Text dimColor>reading hosts…</Text>
        ) : unlocked ? (
          <Text>
            <Text bold>unlocked</Text>{' '}
            <Text dimColor>
              ({label}) · {formatRemaining(remainingMs)} until re-lock
            </Text>
          </Text>
        ) : blocked.length > 0 ? (
          <>
            <Text>
              <Text bold>locked</Text>{' '}
              <Text dimColor>
                ({label}, {blocked.length} site{blocked.length === 1 ? '' : 's'})
              </Text>
            </Text>
            {blocked.map((host) => (
              <Text key={host} dimColor>
                {'  · '}{host}
              </Text>
            ))}
          </>
        ) : getLockHostnames().length === 0 ? (
          <Text dimColor>nothing locked yet — add sites, then run locus lock</Text>
        ) : (
          <Text dimColor>not enforced — run locus lock to block the set</Text>
        )}
      </Box>
    </Box>
  );
}
