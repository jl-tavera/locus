import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

// A timed arithmetic gate. The user must type the correct sum before the timer
// runs out; a wrong answer or timeout regenerates a fresh problem. Used to gate
// unlocking the locked sites.
const CHALLENGE_TIMEOUT_MS = 8000;

type Feedback = 'none' | 'wrong' | 'timeout';

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

interface ChallengeProps {
  onSolved: () => void;
  onCancel: () => void;
}

export function Challenge({ onSolved, onCancel }: ChallengeProps): React.JSX.Element {
  const [challenge, setChallenge] = useState<Challenge>(() => newChallenge());
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback>('none');
  const [endsAt, setEndsAt] = useState(() => Date.now() + CHALLENGE_TIMEOUT_MS);
  const [now, setNow] = useState(() => Date.now());

  const reset = (fb: Feedback) => {
    const start = Date.now();
    setChallenge(newChallenge());
    setAnswer('');
    setFeedback(fb);
    setEndsAt(start + CHALLENGE_TIMEOUT_MS);
    setNow(start);
  };

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel();
      return;
    }
    if (key.return) {
      if (answer.length === 0) return;
      if (parseInt(answer, 10) === challenge.expected) onSolved();
      else reset('wrong');
      return;
    }
    if (key.backspace || key.delete) {
      setAnswer((a) => a.slice(0, -1));
      return;
    }
    if (/^[0-9]$/.test(input) && answer.length < 5) {
      setAnswer((a) => a + input);
    }
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (now >= endsAt) reset('timeout');
  }, [now, endsAt]);

  const msLeft = Math.max(0, endsAt - now);
  const secondsLeft = Math.ceil(msLeft / 1000);
  const barWidth = 24;
  const filled = Math.round((msLeft / CHALLENGE_TIMEOUT_MS) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, barWidth - filled));
  const color = secondsLeft <= 2 ? 'red' : secondsLeft <= 4 ? 'yellow' : 'green';

  return (
    <Box flexDirection="column" alignItems="center">
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
    </Box>
  );
}
