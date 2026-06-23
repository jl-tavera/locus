import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { Heading } from '../components/Heading.js';
import { ContributionCalendar } from '../components/ContributionCalendar.js';
import { listAllSessions } from '../../core/sessions.js';
import { buildCalendar, type CalendarData } from '../../core/calendar.js';
import { computeStreaks, type StreakInfo } from '../../core/streak.js';

interface Props {
  cliMode?: boolean;
}

function formatMinutes(totalMinutes: number): string {
  const m = Math.round(totalMinutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function Streak({ cliMode = false }: Props): React.JSX.Element {
  const { exit } = useApp();
  const [data, setData] = useState<{ cal: CalendarData; streak: StreakInfo } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const sessions = listAllSessions();
      const today = new Date();
      const cal = buildCalendar(sessions, today);
      const streak = computeStreaks(sessions, today);
      setData({ cal, streak });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!cliMode) return;
    if (!data && !error) return;
    const t = setTimeout(() => exit(), 50);
    return () => clearTimeout(t);
  }, [cliMode, data, error, exit]);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Heading>streak</Heading>
      <Box marginTop={1} flexDirection="column">
        {error ? (
          <Text dimColor>error: {error}</Text>
        ) : !data ? (
          <Text dimColor>loading…</Text>
        ) : (
          <>
            <ContributionCalendar data={data.cal} />
            <Box marginTop={1} flexDirection="column">
              <Text>
                <Text dimColor>total: </Text>
                <Text bold>
                  {data.cal.totalSessions} unlock{data.cal.totalSessions === 1 ? '' : 's'}
                </Text>
                <Text dimColor> · {formatMinutes(data.cal.totalMinutes)}</Text>
              </Text>
              <Text>
                <Text dimColor>current streak: </Text>
                <Text bold>
                  {data.streak.current} day{data.streak.current === 1 ? '' : 's'}
                </Text>
                <Text dimColor>
                  {' · longest: '}
                  {data.streak.longest} day{data.streak.longest === 1 ? '' : 's'}
                </Text>
              </Text>
              {data.cal.busiestDay && data.cal.totalSessions > 0 ? (
                <Text dimColor>
                  busiest: {data.cal.busiestDay.date} ({data.cal.busiestDay.sessions} unlock
                  {data.cal.busiestDay.sessions === 1 ? '' : 's'},{' '}
                  {formatMinutes(data.cal.busiestDay.minutes)})
                </Text>
              ) : null}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
