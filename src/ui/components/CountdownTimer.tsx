import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { formatRemaining } from '../../utils/duration.js';

interface CountdownTimerProps {
  endsAt: Date;
  totalMs: number;
  onComplete?: () => void;
}

const BAR_WIDTH = 62;

const DIGIT_HEIGHT = 5;

const DIGITS: Record<string, string[]> = {
  '0': ['███', '█ █', '█ █', '█ █', '███'],
  '1': ['  █', '  █', '  █', '  █', '  █'],
  '2': ['███', '  █', '███', '█  ', '███'],
  '3': ['███', '  █', '███', '  █', '███'],
  '4': ['█ █', '█ █', '███', '  █', '  █'],
  '5': ['███', '█  ', '███', '  █', '███'],
  '6': ['███', '█  ', '███', '█ █', '███'],
  '7': ['███', '  █', '  █', '  █', '  █'],
  '8': ['███', '█ █', '███', '█ █', '███'],
  '9': ['███', '█ █', '███', '  █', '███'],
  ':': [' ', '█', ' ', '█', ' '],
};

function renderBigTime(text: string): string[] {
  const rows: string[] = Array(DIGIT_HEIGHT).fill('');
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!ch) continue;
    const glyph = DIGITS[ch];
    if (!glyph) continue;
    const sep = i < chars.length - 1 ? ' ' : '';
    for (let r = 0; r < DIGIT_HEIGHT; r++) {
      rows[r] += (glyph[r] ?? '') + sep;
    }
  }
  return rows;
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

  const filled = Math.round(ratio * BAR_WIDTH);
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, BAR_WIDTH - filled));

  const bigRows = renderBigTime(formatRemaining(remaining));

  return (
    <Box flexDirection="column" alignItems="center">
      <Box flexDirection="column" alignItems="center">
        {bigRows.map((row, i) => (
          <Text key={i} bold>
            {row}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[{bar}]</Text>
      </Box>
    </Box>
  );
}
