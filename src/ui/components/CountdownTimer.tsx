import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { formatRemaining } from '../../utils/duration.js';

interface CountdownTimerProps {
  endsAt: Date;
  totalMs: number;
  onComplete?: () => void;
}

const BAR_WIDTH = 40;

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

  const filled = Math.round(ratio * BAR_WIDTH);
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, BAR_WIDTH - filled));
  const percent = Math.min(100, Math.round(ratio * 100));

  return (
    <Box flexDirection="column" alignItems="center">
      <Box>
        <Text dimColor>remaining </Text>
        <Text bold>{formatRemaining(remaining)}</Text>
        <Text dimColor>  ·  total </Text>
        <Text bold>{formatRemaining(totalMs)}</Text>
        <Text dimColor>  ·  </Text>
        <Text bold>{percent}%</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{bar}</Text>
      </Box>
    </Box>
  );
}
