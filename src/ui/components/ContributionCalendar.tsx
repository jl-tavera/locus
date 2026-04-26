import React from 'react';
import { Box, Text } from 'ink';
import { palette } from '../theme.js';
import type { CalendarData } from '../../core/calendar.js';

const WEEKDAY_LABELS: (string | null)[] = [null, 'm', null, 'w', null, 'f', null];

const GLYPHS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: '·',
  1: '░',
  2: '▒',
  3: '▓',
  4: '█',
};

const COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: palette.disabled,
  1: palette.muted,
  2: palette.secondary,
  3: palette.primary,
  4: palette.primary,
};

interface Props {
  data: CalendarData;
}

function buildMonthRow(labels: { col: number; label: string }[], width: number): string {
  const kept: { col: number; label: string }[] = [];
  for (let i = 0; i < labels.length; i++) {
    const cur = labels[i]!;
    const next = labels[i + 1];
    if (next && cur.col + cur.label.length > next.col) continue;
    kept.push(cur);
  }
  const chars = Array<string>(width).fill(' ');
  for (const { col, label } of kept) {
    for (let i = 0; i < label.length && col + i < width; i++) {
      chars[col + i] = label[i]!;
    }
  }
  return chars.join('');
}

export function ContributionCalendar({ data }: Props): React.JSX.Element {
  const monthRow = buildMonthRow(data.monthLabels, data.weeks.length);
  return (
    <Box flexDirection="column">
      <Text dimColor>{'  ' + monthRow}</Text>
      {[0, 1, 2, 3, 4, 5, 6].map((row) => (
        <Text key={row}>
          <Text dimColor>{(WEEKDAY_LABELS[row] ?? ' ') + ' '}</Text>
          {data.weeks.map((week, w) => {
            const cell = week[row]!;
            return (
              <Text key={w} color={COLORS[cell.bucket]} bold={cell.bucket === 4}>
                {cell.inRange ? GLYPHS[cell.bucket] : ' '}
              </Text>
            );
          })}
        </Text>
      ))}
    </Box>
  );
}
