import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Heading } from '../components/Heading.js';
import { CountdownTimer } from '../components/CountdownTimer.js';

interface FocusRunnerProps {
  profileName: string;
  endsAt: Date;
  onCleanup: (reason: 'completed' | 'cancelled') => Promise<void>;
}

type State = 'running' | 'confirming' | 'challenge' | 'completing' | 'done';
type ChallengeFeedback = 'none' | 'wrong' | 'timeout';

const CHALLENGE_TIMEOUT_MS = 8000;

interface Challenge {
  a: number;
  b: number;
  expected: number;
}

function newChallenge(): Challenge {
  const a = Math.floor(Math.random() * 900) + 100;
  const b = Math.floor(Math.random() * 900) + 100;
  return { a, b, expected: a + b };
}

export function FocusRunner({
  profileName,
  endsAt,
  onCleanup,
}: FocusRunnerProps): React.JSX.Element {
  const { exit } = useApp();
  const [state, setState] = useState<State>('running');
  const [totalMs] = useState<number>(() => Math.max(1, endsAt.getTime() - Date.now()));
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState<string>('');
  const [feedback, setFeedback] = useState<ChallengeFeedback>('none');
  const [challengeEndsAt, setChallengeEndsAt] = useState<number>(0);
  const [challengeNow, setChallengeNow] = useState<number>(0);

  const cleanupAndExit = async (reason: 'completed' | 'cancelled') => {
    setState(reason === 'completed' ? 'completing' : 'done');
    try {
      await onCleanup(reason);
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

  const startChallenge = () => {
    const start = Date.now();
    setChallenge(newChallenge());
    setAnswer('');
    setFeedback('none');
    setChallengeEndsAt(start + CHALLENGE_TIMEOUT_MS);
    setChallengeNow(start);
    setState('challenge');
  };

  const cancelChallenge = () => {
    setChallenge(null);
    setAnswer('');
    setFeedback('none');
    setState('running');
  };

  useInput((input, key) => {
    if (state === 'running' && key.ctrl && input === 'c') {
      setState('confirming');
      return;
    }
    if (state === 'confirming') {
      if (input.toLowerCase() === 'y') {
        startChallenge();
      } else if (key.escape || input.toLowerCase() === 'n' || (key.ctrl && input === 'c')) {
        setState('running');
      }
      return;
    }
    if (state === 'challenge' && challenge) {
      if (key.escape || (key.ctrl && input === 'c')) {
        cancelChallenge();
        return;
      }
      if (key.return) {
        if (answer.length === 0) return;
        if (parseInt(answer, 10) === challenge.expected) {
          void cleanupAndExit('cancelled');
        } else {
          const start = Date.now();
          setChallenge(newChallenge());
          setAnswer('');
          setFeedback('wrong');
          setChallengeEndsAt(start + CHALLENGE_TIMEOUT_MS);
          setChallengeNow(start);
        }
        return;
      }
      if (key.backspace || key.delete) {
        setAnswer((a) => a.slice(0, -1));
        return;
      }
      if (/^[0-9]$/.test(input) && answer.length < 5) {
        setAnswer((a) => a + input);
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

  useEffect(() => {
    if (state !== 'challenge') return;
    const interval = setInterval(() => setChallengeNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    if (state !== 'challenge' || !challenge) return;
    if (challengeNow >= challengeEndsAt) {
      const start = Date.now();
      setChallenge(newChallenge());
      setAnswer('');
      setFeedback('timeout');
      setChallengeEndsAt(start + CHALLENGE_TIMEOUT_MS);
      setChallengeNow(start);
    }
  }, [challengeNow, challengeEndsAt, state, challenge]);

  const onComplete = () => {
    if (state === 'running') void cleanupAndExit('completed');
  };

  return (
    <Box flexDirection="column" alignItems="center" width={64} paddingY={1}>
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
      <Box marginTop={2} flexDirection="column" alignItems="center">
        {state === 'confirming' ? (
          <Text bold>end focus early? (y/N)</Text>
        ) : state === 'challenge' && challenge ? (
          (() => {
            const msLeft = Math.max(0, challengeEndsAt - challengeNow);
            const secondsLeft = Math.ceil(msLeft / 1000);
            const barWidth = 24;
            const filled = Math.round((msLeft / CHALLENGE_TIMEOUT_MS) * barWidth);
            const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, barWidth - filled));
            const color = secondsLeft <= 2 ? 'red' : secondsLeft <= 4 ? 'yellow' : 'green';
            return (
              <>
                <Text bold>
                  {challenge.a} + {challenge.b} = {answer || '_'}
                </Text>
                <Box marginTop={1}>
                  <Text bold color={color}>
                    {secondsLeft}s [{bar}]
                  </Text>
                </Box>
                <Box marginTop={1}>
                  <Text dimColor>
                    {feedback === 'wrong'
                      ? 'wrong — new problem · '
                      : feedback === 'timeout'
                        ? 'timed out — new problem · '
                        : ''}
                    enter submit · esc cancel
                  </Text>
                </Box>
              </>
            );
          })()
        ) : state === 'running' ? (
          <Text dimColor>ctrl-c to end early</Text>
        ) : null}
      </Box>
    </Box>
  );
}
