import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Heading } from '../components/Heading.js';
import { getActiveBlock } from '../../core/hosts.js';
import { findProfileById, getActiveFocus } from '../../core/store.js';
import { ALL_SITES_LABEL } from '../../core/focus.js';
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

  const focus = getActiveFocus();
  const focusLabel = focus
    ? focus.profileId === null
      ? ALL_SITES_LABEL
      : findProfileById(focus.profileId)?.name ?? '(deleted profile)'
    : null;
  const remainingMs = focus ? new Date(focus.endsAt).getTime() - Date.now() : 0;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Heading>status</Heading>
      <Box marginTop={1} flexDirection="column">
        {blocked === null ? (
          <Text dimColor>reading hosts…</Text>
        ) : blocked.length === 0 ? (
          <Text dimColor>block: inactive</Text>
        ) : (
          <>
            <Text>
              block: <Text bold>active</Text>{' '}
              <Text dimColor>
                ({blocked.length} site{blocked.length === 1 ? '' : 's'})
              </Text>
            </Text>
            {blocked.map((host) => (
              <Text key={host} dimColor>
                {'  · '}{host}
              </Text>
            ))}
          </>
        )}
      </Box>
      <Box marginTop={1}>
        {!focus ? (
          <Text dimColor>focus: inactive</Text>
        ) : remainingMs <= 0 ? (
          <Text dimColor>focus: expired</Text>
        ) : (
          <Text>
            focus: <Text bold>{focusLabel}</Text>{' '}
            <Text dimColor>· {formatRemaining(remainingMs)} remaining</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
}
