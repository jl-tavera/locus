import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { formatRemaining } from '../../utils/duration.js';

interface CountdownTimerProps {
  endsAt: Date;
  totalMs: number;
  onComplete?: () => void;
}

export function CountdownTimer({
  endsAt,
  totalMs,
  onComplete,
}: CountdownTimerProps): React.JSX.Element {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const remaining = Math.max(0, endsAt.getTime() - now);
  const elapsed = Math.max(0, Math.min(totalMs, totalMs - remaining));
  const ratio = totalMs > 0 ? elapsed / totalMs : 1;

  useEffect(() => {
    if (remaining <= 0) onComplete?.();
  }, [remaining, onComplete]);

  const barWidth = 32;
  const filled = Math.round(ratio * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, barWidth - filled));

  return (
    <Box flexDirection="column" alignItems="center">
      <Text bold>{formatRemaining(remaining)}</Text>
      <Box marginTop={1}>
        <Text dimColor>[{bar}]</Text>
      </Box>
    </Box>
  );
}
