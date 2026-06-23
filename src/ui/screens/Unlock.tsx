import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Heading } from '../components/Heading.js';
import { Menu, type MenuItem } from '../components/Menu.js';
import { Challenge } from '../components/Challenge.js';
import { UnlockRunner } from './UnlockRunner.js';
import {
  UNLOCK_OPTIONS_MIN,
  endUnlock,
  getLockHostnames,
  getLockLabel,
  startUnlock,
} from '../../core/lock.js';

type Step = 'pickDuration' | 'challenge' | 'running';

interface UnlockProps {
  resumed?: { endsAt: Date };
  onExit: () => void;
}

export function Unlock({ resumed, onExit }: UnlockProps): React.JSX.Element {
  const label = getLockLabel();
  const nothingLocked = getLockHostnames().length === 0;
  const [step, setStep] = useState<Step>(resumed ? 'running' : 'pickDuration');
  const [minutes, setMinutes] = useState<number>(UNLOCK_OPTIONS_MIN[0]);
  const [endsAt, setEndsAt] = useState<Date | null>(resumed?.endsAt ?? null);
  const [error, setError] = useState<string | null>(null);

  if (step === 'running' && endsAt) {
    return (
      <UnlockRunner
        label={label}
        endsAt={endsAt}
        onCleanup={async (reason) => {
          await endUnlock(reason);
          onExit();
        }}
      />
    );
  }

  if (nothingLocked) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Heading>unlock</Heading>
        <Box marginTop={1}>
          <Text dimColor>nothing is locked yet. add sites, then run locus lock.</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'challenge') {
    return (
      <Box flexDirection="column" alignItems="center" paddingX={2} paddingY={1}>
        <Heading>{`unlock · ${minutes}m`}</Heading>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>solve to unlock {label} for {minutes} minutes</Text>
        </Box>
        <Challenge
          onSolved={() => {
            void (async () => {
              try {
                const { endsAt: ea } = await startUnlock(minutes * 60_000);
                setEndsAt(ea);
                setStep('running');
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                setStep('pickDuration');
              }
            })();
          }}
          onCancel={() => setStep('pickDuration')}
        />
      </Box>
    );
  }

  // pickDuration
  const items: MenuItem[] = UNLOCK_OPTIONS_MIN.map((m) => ({
    label: `${m} minutes`,
    value: String(m),
  }));
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Heading>unlock</Heading>
      <Box marginTop={1} marginBottom={1} flexDirection="column">
        <Text dimColor>locked: {label}</Text>
        <Text dimColor>pick how long to open it (max 30 min) — you'll solve a challenge next</Text>
      </Box>
      <Menu
        items={items}
        onSelect={(item) => {
          setError(null);
          setMinutes(Number(item.value));
          setStep('challenge');
        }}
      />
      {error ? (
        <Box marginTop={1}>
          <Text bold>error: {error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
